"""CRUD routes for Payment Sources. User-scoped."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PaymentSource, Transaction, User
from app.schemas import PaymentSourceCreate, PaymentSourceOut, PaymentSourceUpdate
from app.security import get_current_user

router = APIRouter(prefix="/payment-sources", tags=["payment-sources"])


@router.get("", response_model=list[PaymentSourceOut])
def list_payment_sources(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[PaymentSource]:
    return list(
        db.scalars(
            select(PaymentSource)
            .where(PaymentSource.user_id == user.id)
            .order_by(PaymentSource.sort_order, PaymentSource.id)
        )
    )


@router.post("", response_model=PaymentSourceOut, status_code=status.HTTP_201_CREATED)
def create_payment_source(
    payload: PaymentSourceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaymentSource:
    ps = PaymentSource(user_id=user.id, **payload.model_dump())
    db.add(ps)
    db.commit()
    db.refresh(ps)
    return ps


def _owned(db: Session, ps_id: int, user: User) -> PaymentSource:
    ps = db.get(PaymentSource, ps_id)
    if not ps or ps.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment source not found")
    return ps


@router.put("/{ps_id}", response_model=PaymentSourceOut)
def update_payment_source(
    ps_id: int,
    payload: PaymentSourceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaymentSource:
    ps = _owned(db, ps_id, user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(ps, k, v)
    db.commit()
    db.refresh(ps)
    return ps


@router.delete("/{ps_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_source(
    ps_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    ps = _owned(db, ps_id, user)
    bound = db.scalar(
        select(Transaction.id).where(Transaction.payment_source_id == ps_id).limit(1)
    )
    if bound is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This payment source has transactions attached. Reassign or delete them first.",
        )
    db.delete(ps)
    db.commit()
