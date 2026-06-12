"""Monthly remarks: free-text notes pinned to (year, month). User-scoped."""

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MonthlyRemark, User
from app.schemas import RemarkUpsert
from app.security import get_current_user

router = APIRouter(prefix="/remarks", tags=["remarks"])


@router.put("", status_code=status.HTTP_204_NO_CONTENT)
def upsert_remark(
    payload: RemarkUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Idempotent upsert — replaces the body for that month, or creates it."""
    existing = db.scalar(
        select(MonthlyRemark).where(
            MonthlyRemark.user_id == user.id,
            MonthlyRemark.year == payload.year,
            MonthlyRemark.month == payload.month,
        )
    )
    if existing:
        existing.body = payload.body
    else:
        db.add(
            MonthlyRemark(
                user_id=user.id,
                year=payload.year,
                month=payload.month,
                body=payload.body,
            )
        )
    db.commit()
