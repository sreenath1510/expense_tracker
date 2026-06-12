"""CRUD routes for Line Items (micro-categories under blocks). User-scoped."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Block, LineItem, Transaction, User
from app.schemas import LineItemCreate, LineItemOut, LineItemUpdate
from app.security import get_current_user

router = APIRouter(prefix="/line-items", tags=["line-items"])


def _owned_block(db: Session, block_id: int, user: User) -> Block | None:
    block = db.get(Block, block_id)
    return block if block and block.user_id == user.id else None


@router.get("", response_model=list[LineItemOut])
def list_line_items(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[LineItem]:
    return list(
        db.scalars(
            select(LineItem)
            .where(LineItem.user_id == user.id)
            .order_by(LineItem.block_id, LineItem.sort_order)
        )
    )


@router.post("", response_model=LineItemOut, status_code=status.HTTP_201_CREATED)
def create_line_item(
    payload: LineItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LineItem:
    if not _owned_block(db, payload.block_id, user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Parent block not found")
    item = LineItem(user_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _owned_item(db: Session, item_id: int, user: User) -> LineItem:
    item = db.get(LineItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Line item not found")
    return item


@router.put("/{item_id}", response_model=LineItemOut)
def update_line_item(
    item_id: int,
    payload: LineItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LineItem:
    item = _owned_item(db, item_id, user)
    data = payload.model_dump(exclude_unset=True)
    if "block_id" in data and not _owned_block(db, data["block_id"], user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Parent block not found")
    for k, v in data.items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_line_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    item = _owned_item(db, item_id, user)
    # Pre-flight check so we can give a friendly message instead of letting
    # the FK RESTRICT raise an opaque IntegrityError.
    bound = db.scalar(
        select(Transaction.id).where(Transaction.line_item_id == item_id).limit(1)
    )
    if bound is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This line item has transactions attached. Reassign or delete them first.",
        )
    db.delete(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Line item is still referenced.")
