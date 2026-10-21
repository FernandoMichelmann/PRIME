from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_company_permission
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.revenue import ReceivableTitle, ReceiptAllocation, Revenue, RevenueReceipt
from app.models.user import User
from app.schemas.revenue import (
    InvoiceRevenueRequest,
    ReceivableTitleResponse,
    ReceiptCreate,
    ReceiptResponse,
    RevenueCreate,
    RevenueDashboardResponse,
    RevenueResponse,
    RevenueUpdate,
)

router = APIRouter(prefix="/revenue", tags=["revenue"])
ZERO = Decimal("0.00")


def _total(base: Decimal, additions: Decimal, toll: Decimal, discount: Decimal) -> Decimal:
    return (base + additions + toll - discount).quantize(Decimal("0.01"))


def _audit(db: Session, user: User, company_id: UUID, request: Request,
           action: str, resource_type: str, resource_id: str, details: dict) -> None:
    db.add(AuditLog(
        company_id=company_id, actor_user_id=user.id, action=action,
        resource_type=resource_type, resource_id=resource_id, details=details,
        ip_address=request.client.host if request.client else None,
    ))


def _title_response(title: ReceivableTitle) -> dict:
    balance = max(ZERO, title.original_amount - title.received_amount)
    if balance == ZERO:
        state = "recebido_integralmente"
    elif title.received_amount > ZERO:
        state = "parcialmente_recebido"
    elif title.due_date < date.today():
        state = "vencido"
    else:
        state = "a_vencer"
    return {
        "id": title.id, "company_id": title.company_id, "revenue_id": title.revenue_id,
        "title_number": title.title_number, "customer_name": title.customer_name,
        "issue_date": title.issue_date, "due_date": title.due_date,
        "original_amount": title.original_amount, "received_amount": title.received_amount,
        "balance": balance, "status": state, "created_at": title.created_at,
        "updated_at": title.updated_at,
    }


@router.get("/dashboard", response_model=RevenueDashboardResponse)
def dashboard(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    membership=Depends(require_company_permission("finance.read")),
    db: Session = Depends(get_db),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="A data inicial não pode ser posterior à data final.")
    company_id = membership.company_id
    revenue_query = select(Revenue).where(Revenue.company_id == company_id)
    if start_date:
        revenue_query = revenue_query.where(func.coalesce(Revenue.issue_date, Revenue.service_date, Revenue.competency_date) >= start_date)
    if end_date:
        revenue_query = revenue_query.where(func.coalesce(Revenue.issue_date, Revenue.service_date, Revenue.competency_date) <= end_date)
    revenues = list(db.scalars(revenue_query).all())
    titles = list(db.scalars(select(ReceivableTitle).where(ReceivableTitle.company_id == company_id)).all())
    receipts_query = select(RevenueReceipt).where(RevenueReceipt.company_id == company_id)
    if start_date:
        receipts_query = receipts_query.where(RevenueReceipt.payment_date >= start_date)
    if end_date:
        receipts_query = receipts_query.where(RevenueReceipt.payment_date <= end_date)
    receipts = list(db.scalars(receipts_query).all())
    return RevenueDashboardResponse(
        billing_total=sum((r.total_amount for r in revenues if r.billing_status == "faturada"), ZERO),
        received_total=sum((r.amount for r in receipts), ZERO),
        receivable_balance=sum((max(ZERO, t.original_amount - t.received_amount) for t in titles), ZERO),
        overdue_balance=sum((max(ZERO, t.original_amount - t.received_amount) for t in titles if t.due_date < date.today()), ZERO),
        pending_billing_total=sum((r.total_amount for r in revenues if r.billing_status == "pendente"), ZERO),
        revenues_count=len(revenues),
        receivables_count=len(titles),
    )


@router.get("", response_model=list[RevenueResponse])
def list_revenues(
    search: str | None = None,
    billing_status: str | None = None,
    customer_name: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    membership=Depends(require_company_permission("finance.read")),
    db: Session = Depends(get_db),
):
    statement = select(Revenue).where(Revenue.company_id == membership.company_id)
    if search:
        term = f"%{search.strip()}%"
        statement = statement.where(
            Revenue.reference.ilike(term) | Revenue.customer_name.ilike(term)
            | Revenue.description.ilike(term) | Revenue.cte_number.ilike(term)
            | Revenue.invoice_number.ilike(term)
        )
    if billing_status:
        statement = statement.where(Revenue.billing_status == billing_status)
    if customer_name:
        statement = statement.where(Revenue.customer_name.ilike(f"%{customer_name.strip()}%"))
    if start_date:
        statement = statement.where(func.coalesce(Revenue.issue_date, Revenue.service_date, Revenue.competency_date) >= start_date)
    if end_date:
        statement = statement.where(func.coalesce(Revenue.issue_date, Revenue.service_date, Revenue.competency_date) <= end_date)
    return list(db.scalars(statement.order_by(Revenue.created_at.desc()).limit(limit).offset(offset)).all())


@router.post("", response_model=RevenueResponse, status_code=status.HTTP_201_CREATED)
def create_revenue(
    payload: RevenueCreate, request: Request,
    membership=Depends(require_company_permission("finance.write")),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    total = _total(payload.base_amount, payload.additions_amount, payload.toll_amount, payload.discount_amount)
    if total <= ZERO:
        raise HTTPException(status_code=422, detail="O total da receita precisa ser maior que zero.")
    revenue = Revenue(
        company_id=membership.company_id, created_by=user.id,
        **payload.model_dump(), total_amount=total,
    )
    db.add(revenue)
    try:
        db.flush()
        _audit(db, user, membership.company_id, request, "revenue.created", "revenue",
               str(revenue.id), {"reference": revenue.reference, "total_amount": str(total)})
        db.commit()
        db.refresh(revenue)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Já existe uma receita com esta referência nesta empresa.") from None
    return revenue


@router.patch("/{revenue_id}", response_model=RevenueResponse)
def update_revenue(
    revenue_id: UUID, payload: RevenueUpdate, request: Request,
    membership=Depends(require_company_permission("finance.write")),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    revenue = db.scalar(select(Revenue).where(
        Revenue.id == revenue_id, Revenue.company_id == membership.company_id
    ))
    if revenue is None:
        raise HTTPException(status_code=404, detail="Receita não encontrada.")
    if revenue.billing_status != "pendente":
        raise HTTPException(status_code=409, detail="Somente receitas ainda não faturadas podem ser editadas nesta etapa.")
    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(revenue, key, value)
    revenue.total_amount = _total(
        revenue.base_amount, revenue.additions_amount, revenue.toll_amount, revenue.discount_amount
    )
    if revenue.total_amount <= ZERO:
        raise HTTPException(status_code=422, detail="O total da receita precisa ser maior que zero.")
    _audit(db, user, membership.company_id, request, "revenue.updated", "revenue",
           str(revenue.id), {"fields": sorted(fields)})
    db.commit()
    db.refresh(revenue)
    return revenue


@router.post("/{revenue_id}/invoice", response_model=ReceivableTitleResponse, status_code=status.HTTP_201_CREATED)
def invoice_revenue(
    revenue_id: UUID, payload: InvoiceRevenueRequest, request: Request,
    membership=Depends(require_company_permission("finance.write")),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    if payload.due_date < payload.issue_date:
        raise HTTPException(status_code=422, detail="O vencimento não pode ser anterior à emissão.")
    revenue = db.scalar(select(Revenue).where(
        Revenue.id == revenue_id, Revenue.company_id == membership.company_id
    ).with_for_update())
    if revenue is None:
        raise HTTPException(status_code=404, detail="Receita não encontrada.")
    if revenue.billing_status != "pendente":
        raise HTTPException(status_code=409, detail="Esta receita já foi faturada ou não está disponível para faturamento.")
    title = ReceivableTitle(
        company_id=membership.company_id, revenue_id=revenue.id,
        title_number=payload.title_number, customer_name=revenue.customer_name,
        issue_date=payload.issue_date, due_date=payload.due_date,
        original_amount=revenue.total_amount, received_amount=ZERO, status="a_vencer",
    )
    revenue.billing_status = "faturada"
    revenue.issue_date = payload.issue_date
    revenue.invoice_number = payload.invoice_number
    revenue.due_date = payload.due_date
    db.add(title)
    _audit(db, user, membership.company_id, request, "revenue.invoiced", "revenue",
           str(revenue.id), {"invoice_number": payload.invoice_number, "title_number": payload.title_number})
    db.commit()
    db.refresh(title)
    return _title_response(title)


@router.get("/receivables", response_model=list[ReceivableTitleResponse])
def list_receivables(
    status_filter: str | None = None,
    customer_name: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    membership=Depends(require_company_permission("finance.read")),
    db: Session = Depends(get_db),
):
    statement = select(ReceivableTitle).where(ReceivableTitle.company_id == membership.company_id)
    if customer_name:
        statement = statement.where(ReceivableTitle.customer_name.ilike(f"%{customer_name.strip()}%"))
    if due_from:
        statement = statement.where(ReceivableTitle.due_date >= due_from)
    if due_to:
        statement = statement.where(ReceivableTitle.due_date <= due_to)
    titles = db.scalars(statement.order_by(ReceivableTitle.due_date.asc()).limit(limit).offset(offset)).all()
    rows = [_title_response(title) for title in titles]
    return [row for row in rows if not status_filter or row["status"] == status_filter]


@router.post("/receipts", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_receipt(
    payload: ReceiptCreate, request: Request,
    membership=Depends(require_company_permission("finance.write")),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    amount = sum((item.amount for item in payload.allocations), ZERO).quantize(Decimal("0.01"))
    if amount <= ZERO:
        raise HTTPException(status_code=422, detail="O valor do recebimento precisa ser maior que zero.")
    title_ids = [item.title_id for item in payload.allocations]
    titles = db.scalars(select(ReceivableTitle).where(
        ReceivableTitle.company_id == membership.company_id,
        ReceivableTitle.id.in_(title_ids),
    ).with_for_update()).all()
    by_id = {title.id: title for title in titles}
    if set(by_id) != set(title_ids):
        raise HTTPException(status_code=404, detail="Um ou mais títulos não foram encontrados nesta empresa.")
    for allocation in payload.allocations:
        title = by_id[allocation.title_id]
        balance = title.original_amount - title.received_amount
        if allocation.amount > balance:
            raise HTTPException(status_code=422, detail=f"O valor alocado supera o saldo do título {title.title_number}.")
    receipt = RevenueReceipt(
        company_id=membership.company_id, payment_date=payload.payment_date,
        amount=amount, method=payload.method, transaction_reference=payload.transaction_reference,
        notes=payload.notes, created_by=user.id,
    )
    db.add(receipt)
    db.flush()
    for allocation in payload.allocations:
        title = by_id[allocation.title_id]
        title.received_amount += allocation.amount
        title.status = "recebido_integralmente" if title.received_amount >= title.original_amount else "parcialmente_recebido"
        db.add(ReceiptAllocation(
            company_id=membership.company_id, receipt_id=receipt.id,
            title_id=title.id, amount=allocation.amount,
        ))
    _audit(db, user, membership.company_id, request, "revenue.receipt.created", "revenue_receipt",
           str(receipt.id), {"amount": str(amount), "allocations": len(payload.allocations)})
    db.commit()
    db.refresh(receipt)
    return receipt
