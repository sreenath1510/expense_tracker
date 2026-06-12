"""
AggregationService — computes the dashboard matrix from raw rows.

The matrix is NEVER stored. It's derived on demand by grouping transactions
and income entries by month, then rolling up to block totals. This keeps a
single source of truth and means re-categorizing one transaction correctly
updates every roll-up everywhere.

The summary engine uses the Block.type flag to decide what counts where:
  totalExpenditure  = sum of subtotals for EXPENSE blocks
  totalInvestments  = sum of subtotals for INVESTMENT blocks
  balance           = totalIncome − totalExpenditure
  liquidSavings     = balance − totalInvestments
"""

from collections import defaultdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Block,
    IncomeEntry,
    LineItem,
    MonthlyRemark,
    Transaction,
)
from app.schemas import (
    MatrixBlockGroup,
    MatrixLineItemRow,
    MatrixResponse,
    MatrixSummary,
)


def _month_key(d: date) -> str:
    """Date → 'YYYY-MM' (the canonical month key used everywhere)."""
    return f"{d.year:04d}-{d.month:02d}"


def _last_n_months(n: int) -> list[str]:
    """Default set of months when there's no data yet."""
    today = date.today()
    keys: list[str] = []
    y, m = today.year, today.month
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(keys))


def build_matrix(db: Session, user_id: int) -> MatrixResponse:
    # --- 1. Determine the month columns ------------------------------------
    # Take every month that appears in any of this user's data sources. Fall
    # back to the last four months when there's no data yet.
    txn_months = db.scalars(
        select(func.strftime("%Y-%m", Transaction.txn_date))
        .where(Transaction.user_id == user_id)
        .distinct()
    ).all()
    income_months = db.scalars(
        select(func.strftime("%Y-%m", IncomeEntry.entry_date))
        .where(IncomeEntry.user_id == user_id)
        .distinct()
    ).all()
    remark_months = db.execute(
        select(MonthlyRemark.year, MonthlyRemark.month).where(
            MonthlyRemark.user_id == user_id
        )
    ).all()
    remark_month_keys = [f"{y:04d}-{m:02d}" for y, m in remark_months]

    months = sorted(
        set(txn_months) | set(income_months) | set(remark_month_keys)
    )
    if not months:
        months = _last_n_months(4)

    # --- 2. Aggregate transactions: (line_item_id, month) → sum -----------
    txn_rows = db.execute(
        select(
            Transaction.line_item_id,
            func.strftime("%Y-%m", Transaction.txn_date),
            func.sum(Transaction.amount),
        )
        .where(Transaction.user_id == user_id)
        .group_by(Transaction.line_item_id, func.strftime("%Y-%m", Transaction.txn_date))
    ).all()

    txn_totals: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for line_item_id, month, total in txn_rows:
        if total is not None:
            txn_totals[line_item_id][month] = float(total)

    # --- 3. Build block groups with their line items and subtotals --------
    blocks = list(
        db.scalars(
            select(Block).where(Block.user_id == user_id).order_by(Block.sort_order, Block.id)
        )
    )
    block_groups: list[MatrixBlockGroup] = []
    expense_subtotals: dict[str, float] = defaultdict(float)
    invest_subtotals: dict[str, float] = defaultdict(float)

    for block in blocks:
        line_items = list(
            db.scalars(
                select(LineItem)
                .where(LineItem.block_id == block.id)
                .order_by(LineItem.sort_order, LineItem.id)
            )
        )
        rows: list[MatrixLineItemRow] = []
        block_subs: dict[str, float] = {m: 0.0 for m in months}

        for li in line_items:
            cells = {m: txn_totals[li.id].get(m, 0.0) for m in months}
            rows.append(
                MatrixLineItemRow(
                    line_item_id=li.id, line_item_name=li.name, cells=cells
                )
            )
            for m, v in cells.items():
                block_subs[m] += v

        block_groups.append(
            MatrixBlockGroup(
                block_id=block.id,
                block_name=block.name,
                block_type=block.type,  # type: ignore[arg-type]
                rows=rows,
                subtotals=block_subs,
            )
        )

        target = expense_subtotals if block.type == "EXPENSE" else invest_subtotals
        for m, v in block_subs.items():
            target[m] += v

    # --- 4. Income totals per month ---------------------------------------
    income_rows = db.execute(
        select(
            func.strftime("%Y-%m", IncomeEntry.entry_date),
            func.sum(IncomeEntry.amount),
        )
        .where(IncomeEntry.user_id == user_id)
        .group_by(func.strftime("%Y-%m", IncomeEntry.entry_date))
    ).all()
    income_totals: dict[str, float] = {m: 0.0 for m in months}
    for month, total in income_rows:
        if month in income_totals and total is not None:
            income_totals[month] = float(total)

    # --- 5. Summary engine -------------------------------------------------
    # Investments are carved out of income alongside expenses, so:
    #   income = expenditure + investments + balance
    #   => balance = income - expenditure - investments  (the true leftover).
    total_expenditure = {m: expense_subtotals.get(m, 0.0) for m in months}
    total_investments = {m: invest_subtotals.get(m, 0.0) for m in months}
    balance = {
        m: income_totals[m] - total_expenditure[m] - total_investments[m]
        for m in months
    }
    # Liquid savings now coincides with balance (kept for schema compatibility).
    liquid_savings = {m: balance[m] for m in months}

    summary = MatrixSummary(
        total_income=income_totals,
        total_expenditure=total_expenditure,
        balance=balance,
        total_investments=total_investments,
        liquid_savings=liquid_savings,
    )

    # --- 6. Remarks --------------------------------------------------------
    remarks: dict[str, str] = {}
    for r in db.scalars(select(MonthlyRemark).where(MonthlyRemark.user_id == user_id)):
        remarks[f"{r.year:04d}-{r.month:02d}"] = r.body

    return MatrixResponse(
        months=months, blocks=block_groups, summary=summary, remarks=remarks
    )
