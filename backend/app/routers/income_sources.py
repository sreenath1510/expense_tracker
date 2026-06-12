"""CRUD routes for Income Sources. User-scoped."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import IncomeEntry, IncomeSource, User
from app.schemas import IncomeSourceCreate, IncomeSourceOut, IncomeSourceUpdate
from app.security import get_current_user

router = APIRouter(prefix="/income-sources", tags=["income-sources"])


@router.get("", response_model=list[IncomeSourceOut])
def list_income_sources(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[IncomeSource]:
    return list(
        db.scalars(
            select(IncomeSource)
            .where(IncomeSource.user_id == user.id)
            .order_by(IncomeSource.sort_order, IncomeSource.id)
        )
    )


@router.post("", response_model=IncomeSourceOut, status_code=status.HTTP_201_CREATED)
def create_income_source(
    payload: IncomeSourceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> IncomeSource:
    inc = IncomeSource(user_id=user.id, **payload.model_dump())
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return inc


def _owned(db: Session, inc_id: int, user: User) -> IncomeSource:
    inc = db.get(IncomeSource, inc_id)
    if not inc or inc.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Income source not found")
    return inc


@router.put("/{inc_id}", response_model=IncomeSourceOut)
def update_income_source(
    inc_id: int,
    payload: IncomeSourceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> IncomeSource:
    inc = _owned(db, inc_id, user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(inc, k, v)
    db.commit()
    db.refresh(inc)
    return inc


@router.delete("/{inc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income_source(
    inc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    inc = _owned(db, inc_id, user)
    bound = db.scalar(
        select(IncomeEntry.id).where(IncomeEntry.income_source_id == inc_id).limit(1)
    )
    if bound is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This income source has entries attached. Reassign or delete them first.",
        )
    db.delete(inc)
    db.commit()
