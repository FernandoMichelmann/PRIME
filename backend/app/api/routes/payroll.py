from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_company_permission
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.payroll_employee import PayrollEmployee
from app.models.user import User
from app.schemas.payroll import (
    PayrollEmployeeCreate,
    PayrollEmployeeResponse,
    PayrollEmployeeUpdate,
)

router = APIRouter(prefix="/payroll", tags=["payroll"])


@router.get("/employees", response_model=list[PayrollEmployeeResponse])
def list_employees(
    membership=Depends(require_company_permission("payroll.read")),
    db: Session = Depends(get_db),
) -> list[PayrollEmployee]:
    return list(
        db.scalars(
            select(PayrollEmployee)
            .where(PayrollEmployee.company_id == membership.company_id)
            .order_by(PayrollEmployee.is_active.desc(), PayrollEmployee.name.asc())
        ).all()
    )


@router.post(
    "/employees",
    response_model=PayrollEmployeeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_employee(
    payload: PayrollEmployeeCreate,
    request: Request,
    membership=Depends(require_company_permission("payroll.write")),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayrollEmployee:
    employee = PayrollEmployee(company_id=membership.company_id, **payload.model_dump())
    db.add(employee)
    try:
        db.flush()
        db.add(
            AuditLog(
                company_id=membership.company_id,
                actor_user_id=user.id,
                action="payroll.employee.created",
                resource_type="payroll_employee",
                resource_id=str(employee.id),
                details={"name": employee.name},
                ip_address=request.client.host if request.client else None,
            )
        )
        db.commit()
        db.refresh(employee)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um funcionário com esse documento nesta transportadora.",
        ) from None
    return employee


@router.patch("/employees/{employee_id}", response_model=PayrollEmployeeResponse)
def update_employee(
    employee_id: UUID,
    payload: PayrollEmployeeUpdate,
    request: Request,
    membership=Depends(require_company_permission("payroll.write")),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayrollEmployee:
    employee = db.scalar(
        select(PayrollEmployee).where(
            PayrollEmployee.id == employee_id,
            PayrollEmployee.company_id == membership.company_id,
        )
    )
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funcionário não encontrado.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)

    if employee.salary_split and (
        (employee.salary_day5_amount + employee.salary_day20_amount).quantize(__import__("decimal").Decimal("0.01"))
        != employee.salary.quantize(__import__("decimal").Decimal("0.01"))
    ):
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A soma das parcelas do 5º dia útil e do dia 20 deve ser igual à remuneração mensal.",
        )

    try:
        db.add(
            AuditLog(
                company_id=membership.company_id,
                actor_user_id=user.id,
                action="payroll.employee.updated",
                resource_type="payroll_employee",
                resource_id=str(employee.id),
                details={"fields": sorted(payload.model_fields_set)},
                ip_address=request.client.host if request.client else None,
            )
        )
        db.commit()
        db.refresh(employee)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um funcionário com esse documento nesta transportadora.",
        ) from None
    return employee


@router.patch("/employees/{employee_id}/status", response_model=PayrollEmployeeResponse)
def set_employee_status(
    employee_id: UUID,
    is_active: bool,
    request: Request,
    membership=Depends(require_company_permission("payroll.write")),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayrollEmployee:
    employee = db.scalar(
        select(PayrollEmployee).where(
            PayrollEmployee.id == employee_id,
            PayrollEmployee.company_id == membership.company_id,
        )
    )
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funcionário não encontrado.")

    employee.is_active = is_active
    db.add(
        AuditLog(
            company_id=membership.company_id,
            actor_user_id=user.id,
            action="payroll.employee.status_changed",
            resource_type="payroll_employee",
            resource_id=str(employee.id),
            details={"is_active": is_active},
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()
    db.refresh(employee)
    return employee


# Competências e pagamentos: persistência no PostgreSQL, sempre no escopo da empresa.

from app.models.payroll_period import PayrollPeriod
from app.models.payroll_payment import PayrollPayment
from app.schemas.payroll_records import (
    PayrollPeriodCreate,
    PayrollPeriodResponse,
    PayrollPeriodUpdate,
    PayrollPaymentCreate,
    PayrollPaymentResponse,
    PayrollPaymentUpdate,
)


def _validate_period_items(items: list[dict], company_id, db: Session) -> None:
    employee_ids = {UUID(str(item["employee_id"])) for item in items}
    if not employee_ids:
        return
    employees = db.scalars(
        select(PayrollEmployee).where(
            PayrollEmployee.company_id == company_id,
            PayrollEmployee.id.in_(employee_ids),
        )
    ).all()
    if {employee.id for employee in employees} != employee_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uma ou mais rubricas apontam para funcionários inexistentes nesta transportadora.",
        )


@router.get("/periods", response_model=list[PayrollPeriodResponse])
def list_payroll_periods(
    month: str | None = None,
    membership=Depends(require_company_permission("payroll.read")),
    db: Session = Depends(get_db),
):
    statement = select(PayrollPeriod).where(PayrollPeriod.company_id == membership.company_id)
    if month is not None:
        if len(month) != 7 or month[4:5] != "-" or not month[:4].isdigit() or not month[5:].isdigit() or not 1 <= int(month[5:]) <= 12:
            raise HTTPException(status_code=422, detail="Competência deve estar no formato AAAA-MM.")
        statement = statement.where(PayrollPeriod.month == month)
    return list(db.scalars(statement.order_by(PayrollPeriod.month.desc())).all())


@router.post("/periods", response_model=PayrollPeriodResponse, status_code=status.HTTP_201_CREATED)
def create_payroll_period(
    payload: PayrollPeriodCreate,
    request: Request,
    membership=Depends(require_company_permission("payroll.write")),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_period_items([item.model_dump(mode="json") for item in payload.items], membership.company_id, db)
    period = PayrollPeriod(
        company_id=membership.company_id,
        month=payload.month,
        status=payload.status,
        items=[item.model_dump(mode="json") for item in payload.items],
        approved_at=payload.approved_at,
    )
    db.add(period)
    try:
        db.flush()
        db.add(AuditLog(
            company_id=membership.company_id, actor_user_id=user.id,
            action="payroll.period.created", resource_type="payroll_period",
            resource_id=str(period.id), details={"month": period.month},
            ip_address=request.client.host if request.client else None,
        ))
        db.commit()
        db.refresh(period)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Já existe uma folha para esta competência.") from None
    return period


@router.patch("/periods/{period_id}", response_model=PayrollPeriodResponse)
def update_payroll_period(
    period_id: UUID,
    payload: PayrollPeriodUpdate,
    request: Request,
    membership=Depends(require_company_permission("payroll.write")),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    period = db.scalar(select(PayrollPeriod).where(
        PayrollPeriod.id == period_id,
        PayrollPeriod.company_id == membership.company_id,
    ))
    if period is None:
        raise HTTPException(status_code=404, detail="Competência não encontrada.")
    values = payload.model_dump(exclude_unset=True)
    if "items" in values and values["items"] is not None:
        serialized = [item.model_dump(mode="json") for item in payload.items or []]
        _validate_period_items(serialized, membership.company_id, db)
        values["items"] = serialized
    for field, value in values.items():
        setattr(period, field, value)
    db.add(AuditLog(
        company_id=membership.company_id, actor_user_id=user.id,
        action="payroll.period.updated", resource_type="payroll_period",
        resource_id=str(period.id), details={"fields": sorted(values)},
        ip_address=request.client.host if request.client else None,
    ))
    db.commit()
    db.refresh(period)
    return period


@router.get("/payments", response_model=list[PayrollPaymentResponse])
def list_payroll_payments(
    month: str | None = None,
    membership=Depends(require_company_permission("payroll.read")),
    db: Session = Depends(get_db),
):
    statement = select(PayrollPayment).where(PayrollPayment.company_id == membership.company_id)
    if month is not None:
        if len(month) != 7 or month[4:5] != "-" or not month[:4].isdigit() or not month[5:].isdigit() or not 1 <= int(month[5:]) <= 12:
            raise HTTPException(status_code=422, detail="Competência deve estar no formato AAAA-MM.")
        statement = statement.where(PayrollPayment.month == month)
    return list(db.scalars(statement.order_by(PayrollPayment.due_date.desc())).all())


@router.post("/payments", response_model=PayrollPaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payroll_payment(
    payload: PayrollPaymentCreate,
    request: Request,
    membership=Depends(require_company_permission("payroll.write")),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.scalar(select(PayrollEmployee).where(
        PayrollEmployee.id == payload.employee_id,
        PayrollEmployee.company_id == membership.company_id,
    ))
    if employee is None:
        raise HTTPException(status_code=422, detail="Funcionário não encontrado nesta transportadora.")
    payment = PayrollPayment(company_id=membership.company_id, **payload.model_dump())
    db.add(payment)
    db.flush()
    db.add(AuditLog(
        company_id=membership.company_id, actor_user_id=user.id,
        action="payroll.payment.created", resource_type="payroll_payment",
        resource_id=str(payment.id), details={"month": payment.month, "amount": str(payment.amount)},
        ip_address=request.client.host if request.client else None,
    ))
    db.commit()
    db.refresh(payment)
    return payment


@router.patch("/payments/{payment_id}", response_model=PayrollPaymentResponse)
def update_payroll_payment(
    payment_id: UUID,
    payload: PayrollPaymentUpdate,
    request: Request,
    membership=Depends(require_company_permission("payroll.write")),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment = db.scalar(select(PayrollPayment).where(
        PayrollPayment.id == payment_id,
        PayrollPayment.company_id == membership.company_id,
    ))
    if payment is None:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    values = payload.model_dump(exclude_unset=True)
    if values.get("status") == "pago" and values.get("paid_at") is None and payment.paid_at is None:
        raise HTTPException(status_code=422, detail="Informe a data efetiva do pagamento.")
    for field, value in values.items():
        setattr(payment, field, value)
    if payment.status == "pago" and payment.paid_at is None:
        raise HTTPException(status_code=422, detail="Informe a data efetiva do pagamento.")
    db.add(AuditLog(
        company_id=membership.company_id, actor_user_id=user.id,
        action="payroll.payment.updated", resource_type="payroll_payment",
        resource_id=str(payment.id), details={"fields": sorted(values)},
        ip_address=request.client.host if request.client else None,
    ))
    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payroll_payment(
    payment_id: UUID,
    request: Request,
    membership=Depends(require_company_permission("payroll.write")),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment = db.scalar(select(PayrollPayment).where(
        PayrollPayment.id == payment_id,
        PayrollPayment.company_id == membership.company_id,
    ))
    if payment is None:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    db.add(AuditLog(
        company_id=membership.company_id, actor_user_id=user.id,
        action="payroll.payment.deleted", resource_type="payroll_payment",
        resource_id=str(payment.id),
        details={"month": payment.month, "amount": str(payment.amount), "status": payment.status},
        ip_address=request.client.host if request.client else None,
    ))
    db.delete(payment)
    db.commit()
    return None
