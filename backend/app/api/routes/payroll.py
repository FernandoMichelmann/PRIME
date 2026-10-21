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
