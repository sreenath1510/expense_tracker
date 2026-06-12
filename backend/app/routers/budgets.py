"""Per-block monthly budget routes. User-scoped.

Budgets are stored sparsely: one row per (block, year, month) the user has
explicitly set. The frontend carries the most recent value forward to later
months, so "set once" behaves like a recurring target while still allowing a
per-month override.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Block, Budget, User
from app.schemas import BudgetOut, BudgetUpsert
from app.security import get_current_user

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetOut])
def list_budgets(
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Budget]:
    stmt = select(Budget).where(Budget.user_id == user.id)
    if year is not None:
        stmt = stmt.where(Budget.year == year)
    return list(db.scalars(stmt.order_by(Budget.year, Budget.month)))


@router.put("", response_model=BudgetOut)
def upsert_budget(
    payload: BudgetUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Budget:
    block = db.get(Block, payload.block_id)
    if not block or block.user_id != user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Block not found")

    existing = db.scalar(
        select(Budget).where(
            Budget.user_id == user.id,
            Budget.block_id == payload.block_id,
            Budget.year == payload.year,
            Budget.month == payload.month,
        )
    )
    if existing:
        existing.amount = payload.amount
        db.commit()
        db.refresh(existing)
        return existing

    budget = Budget(user_id=user.id, **payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    budget = db.get(Budget, budget_id)
    if not budget or budget.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Budget not found")
    db.delete(budget)
    db.commit()
