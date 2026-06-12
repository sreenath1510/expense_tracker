"""CRUD routes for Blocks (macro-categories). Scoped to the current user."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Block, User
from app.schemas import BlockCreate, BlockOut, BlockUpdate
from app.security import get_current_user

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("", response_model=list[BlockOut])
def list_blocks(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[Block]:
    return list(
        db.scalars(
            select(Block).where(Block.user_id == user.id).order_by(Block.sort_order, Block.id)
        )
    )


@router.post("", response_model=BlockOut, status_code=status.HTTP_201_CREATED)
def create_block(
    payload: BlockCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Block:
    block = Block(user_id=user.id, **payload.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


def _owned_block(db: Session, block_id: int, user: User) -> Block:
    block = db.get(Block, block_id)
    if not block or block.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Block not found")
    return block


@router.put("/{block_id}", response_model=BlockOut)
def update_block(
    block_id: int,
    payload: BlockUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Block:
    block = _owned_block(db, block_id, user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(block, k, v)
    db.commit()
    db.refresh(block)
    return block


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    block = _owned_block(db, block_id, user)
    # Cascade in the model drops child line items; transactions reference
    # line items with RESTRICT, so the DB will refuse if any are bound.
    db.delete(block)
    db.commit()
