"""Transaction and income-entry routes. Every row is scoped to its owner."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Block,
    IncomeEntry,
    IncomeSource,
    LineItem,
    PaymentSource,
    Transaction,
    User,
)
from app.schemas import (
    BatchInsertResult,
    IncomeEntryCreate,
    IncomeEntryDetailOut,
    IncomeEntryOut,
    TransactionCreate,
    TransactionDetailOut,
    TransactionOut,
    TransactionUpdate,
)
from app.security import get_current_user

router = APIRouter(tags=["transactions"])


def _owns_line_item(db: Session, line_item_id: int, user: User) -> bool:
    li = db.get(LineItem, line_item_id)
    return li is not None and li.user_id == user.id


def _owns_payment_source(db: Session, ps_id: int, user: User) -> bool:
    ps = db.get(PaymentSource, ps_id)
    return ps is not None and ps.user_id == user.id


@router.get("/transactions", response_model=list[TransactionDetailOut])
def list_transactions(
    month: str | None = Query(
        default=None,
        pattern=r"^\d{4}-\d{2}$",
        description="Filter to a single month, format YYYY-MM.",
    ),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TransactionDetailOut]:
    """List the user's transactions (optionally for one month) joined with the
    block, line-item and payment-source names the drilldown view needs."""
    stmt = (
        select(Transaction, LineItem, Block, PaymentSource)
        .join(LineItem, Transaction.line_item_id == LineItem.id)
        .join(Block, LineItem.block_id == Block.id)
        .join(PaymentSource, Transaction.payment_source_id == PaymentSource.id)
        .where(Transaction.user_id == user.id)
    )
    if month:
        y, m = (int(p) for p in month.split("-"))
        stmt = stmt.where(
            extract("year", Transaction.txn_date) == y,
            extract("month", Transaction.txn_date) == m,
        )
    stmt = stmt.order_by(Transaction.txn_date.desc(), Transaction.id.desc())

    return [
        TransactionDetailOut(
            id=txn.id,
            txn_date=txn.txn_date,
            amount=float(txn.amount),
            block_id=block.id,
            block_name=block.name,
            block_type=block.type,  # type: ignore[arg-type]
            line_item_id=li.id,
            line_item_name=li.name,
            payment_source_id=ps.id,
            payment_source_name=ps.name,
            description=txn.description,
        )
        for txn, li, block, ps in db.execute(stmt).all()
    ]


@router.post(
    "/transactions",
    response_model=TransactionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Transaction:
    if not _owns_line_item(db, payload.line_item_id, user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Line item not found")
    if not _owns_payment_source(db, payload.payment_source_id, user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment source not found")

    txn = Transaction(user_id=user.id, **payload.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.put("/transactions/{txn_id}", response_model=TransactionOut)
def update_transaction(
    txn_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Transaction:
    txn = db.get(Transaction, txn_id)
    if not txn or txn.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")

    data = payload.model_dump(exclude_unset=True)
    if "line_item_id" in data and not _owns_line_item(db, data["line_item_id"], user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Line item not found")
    if "payment_source_id" in data and not _owns_payment_source(db, data["payment_source_id"], user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment source not found")

    for k, v in data.items():
        setattr(txn, k, v)
    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/transactions/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    txn_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    txn = db.get(Transaction, txn_id)
    if not txn or txn.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")
    db.delete(txn)
    db.commit()


@router.post(
    "/transactions/batch",
    response_model=BatchInsertResult,
    status_code=status.HTTP_201_CREATED,
)
def batch_create_transactions(
    payload: list[TransactionCreate],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BatchInsertResult:
    """Bulk insert from the upload mapping table. One transaction wraps the lot,
    so a single bad row rolls back everything."""
    if not payload:
        return BatchInsertResult(inserted=0)

    # Validate every referenced line item + payment source belongs to the user.
    line_item_ids = {p.line_item_id for p in payload}
    ps_ids = {p.payment_source_id for p in payload}
    owned_li = db.scalar(
        select(func.count())
        .select_from(LineItem)
        .where(LineItem.id.in_(line_item_ids), LineItem.user_id == user.id)
    )
    if owned_li != len(line_item_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more line items not found")
    owned_ps = db.scalar(
        select(func.count())
        .select_from(PaymentSource)
        .where(PaymentSource.id.in_(ps_ids), PaymentSource.user_id == user.id)
    )
    if owned_ps != len(ps_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more payment sources not found")

    db.add_all([Transaction(user_id=user.id, **p.model_dump()) for p in payload])
    db.commit()
    return BatchInsertResult(inserted=len(payload))


@router.get("/income-entries", response_model=list[IncomeEntryDetailOut])
def list_income_entries(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[IncomeEntryDetailOut]:
    stmt = (
        select(IncomeEntry, IncomeSource)
        .join(IncomeSource, IncomeEntry.income_source_id == IncomeSource.id)
        .where(IncomeEntry.user_id == user.id)
    )
    if month:
        y, m = (int(p) for p in month.split("-"))
        stmt = stmt.where(
            extract("year", IncomeEntry.entry_date) == y,
            extract("month", IncomeEntry.entry_date) == m,
        )
    stmt = stmt.order_by(IncomeEntry.entry_date.desc(), IncomeEntry.id.desc())

    return [
        IncomeEntryDetailOut(
            id=entry.id,
            entry_date=entry.entry_date,
            amount=float(entry.amount),
            income_source_id=src.id,
            income_source_name=src.name,
            description=entry.description,
        )
        for entry, src in db.execute(stmt).all()
    ]


@router.post(
    "/income-entries",
    response_model=IncomeEntryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_income_entry(
    payload: IncomeEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> IncomeEntry:
    src = db.get(IncomeSource, payload.income_source_id)
    if not src or src.user_id != user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Income source not found")
    entry = IncomeEntry(user_id=user.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/income-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    entry = db.get(IncomeEntry, entry_id)
    if not entry or entry.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Income entry not found")
    db.delete(entry)
    db.commit()
