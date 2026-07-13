"""
Pydantic schemas for every request and response.

These ARE the API contract — they must stay in sync with `src/types/index.ts`
on the frontend. The alias_generator emits camelCase JSON keys while Python
code internally uses snake_case, so neither side has to compromise its
conventions.

`from_attributes=True` lets us return SQLAlchemy model instances directly
from routes and Pydantic will read attributes off them (replacing the old
`orm_mode`).
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

BlockType = Literal["EXPENSE", "INVESTMENT"]


class CamelModel(BaseModel):
    """Base for every schema. Emits/accepts camelCase keys."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # accept snake_case OR camelCase on input
        from_attributes=True,   # read directly from ORM instances
    )


# --- Auth -------------------------------------------------------------------
class LoginRequest(CamelModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=200)


class RegisterRequest(CamelModel):
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=6, max_length=200)


class UserOut(CamelModel):
    id: int
    username: str


class AuthResponse(CamelModel):
    token: str
    user: UserOut


# --- Blocks -----------------------------------------------------------------
class BlockCreate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    type: BlockType
    sort_order: int = 0


class BlockUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: BlockType | None = None
    sort_order: int | None = None


class BlockOut(CamelModel):
    id: int
    name: str
    type: BlockType
    sort_order: int


# --- Line Items -------------------------------------------------------------
class LineItemCreate(CamelModel):
    block_id: int
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = 0


class LineItemUpdate(CamelModel):
    block_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=100)
    sort_order: int | None = None
    archived: bool | None = None


class LineItemOut(CamelModel):
    id: int
    block_id: int
    name: str
    sort_order: int
    archived: bool


# --- Payment Sources --------------------------------------------------------
class PaymentSourceCreate(CamelModel):
    name: str = Field(min_length=1, max_length=60)
    sort_order: int = 0


class PaymentSourceUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    sort_order: int | None = None


class PaymentSourceOut(CamelModel):
    id: int
    name: str
    sort_order: int


# --- Income Sources ---------------------------------------------------------
class IncomeSourceCreate(CamelModel):
    name: str = Field(min_length=1, max_length=60)
    sort_order: int = 0


class IncomeSourceUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    sort_order: int | None = None


class IncomeSourceOut(CamelModel):
    id: int
    name: str
    sort_order: int


# --- Transactions -----------------------------------------------------------
class TransactionCreate(CamelModel):
    txn_date: date
    amount: float = Field(gt=0)
    line_item_id: int
    payment_source_id: int
    description: str | None = None


class TransactionUpdate(CamelModel):
    txn_date: date | None = None
    amount: float | None = Field(default=None, gt=0)
    line_item_id: int | None = None
    payment_source_id: int | None = None
    description: str | None = None


class TransactionOut(CamelModel):
    id: int
    txn_date: date
    amount: float
    line_item_id: int
    payment_source_id: int
    description: str | None


class TransactionDetailOut(CamelModel):
    """A transaction enriched with the names the month drilldown displays,
    so the frontend doesn't have to re-join against the lookup collections."""

    id: int
    txn_date: date
    amount: float
    block_id: int
    block_name: str
    block_type: BlockType
    line_item_id: int
    line_item_name: str
    payment_source_id: int
    payment_source_name: str
    description: str | None


class BatchInsertResult(CamelModel):
    inserted: int


# --- Income entries ---------------------------------------------------------
class IncomeEntryCreate(CamelModel):
    entry_date: date
    amount: float = Field(gt=0)
    income_source_id: int
    description: str | None = None


class IncomeEntryOut(CamelModel):
    id: int
    entry_date: date
    amount: float
    income_source_id: int
    description: str | None


class IncomeEntryDetailOut(CamelModel):
    id: int
    entry_date: date
    amount: float
    income_source_id: int
    income_source_name: str
    description: str | None


# --- Budgets ----------------------------------------------------------------
class BudgetUpsert(CamelModel):
    block_id: int
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    amount: float = Field(ge=0)


class BudgetOut(CamelModel):
    id: int
    block_id: int
    year: int
    month: int
    amount: float


# --- Remarks ----------------------------------------------------------------
class RemarkUpsert(CamelModel):
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    body: str


# --- Upload -----------------------------------------------------------------
class RawStatementRow(CamelModel):
    row_id: str
    date: str
    amount: float
    description: str


# --- Matrix -----------------------------------------------------------------
class MatrixLineItemRow(CamelModel):
    line_item_id: int
    line_item_name: str
    cells: dict[str, float]


class MatrixBlockGroup(CamelModel):
    block_id: int
    block_name: str
    block_type: BlockType
    rows: list[MatrixLineItemRow]
    subtotals: dict[str, float]


class MatrixSummary(CamelModel):
    total_income: dict[str, float]
    total_expenditure: dict[str, float]
    balance: dict[str, float]
    total_investments: dict[str, float]
    liquid_savings: dict[str, float]


class MatrixResponse(CamelModel):
    months: list[str]
    blocks: list[MatrixBlockGroup]
    summary: MatrixSummary
    remarks: dict[str, str]
