"""Default categories/sources seeded for every new user.

Used by both `scripts.init_db` (for the bootstrap admin) and the registration
route (so each new account starts with a usable, editable taxonomy).
"""

from sqlalchemy.orm import Session

from app.models import Block, IncomeSource, LineItem, PaymentSource

SEED_BLOCKS: list[tuple[str, str, list[str]]] = [
    ("Mandatory", "EXPENSE", ["Home", "Rent", "Cook", "EB", "Gas Cylinder"]),
    ("Add On", "EXPENSE", ["Tour", "Local Treks", "Hospital", "Marriage"]),
    ("Self Help", "EXPENSE", ["Courses / Books", "Doctor", "Medics"]),
    ("Transport", "EXPENSE", ["Petrol", "Cab", "Bus/Train/Metro"]),
    ("Junk", "EXPENSE", ["Hotel", "Snacks", "Food Delivery", "OTT Subscription"]),
    ("Invest Block", "INVESTMENT", ["Stocks", "Mutual Funds", "T-Bill / Emergency"]),
]

SEED_PAYMENT_SOURCES = ["Credit Card", "Debit Card", "Cash", "UPI"]
SEED_INCOME_SOURCES = ["Salary", "Reimbursements", "Other"]


def seed_user_defaults(db: Session, user_id: int) -> None:
    """Create the starter blocks, line items, and sources owned by `user_id`.
    Caller is responsible for committing."""
    for sort_order, (name, type_, items) in enumerate(SEED_BLOCKS):
        block = Block(user_id=user_id, name=name, type=type_, sort_order=sort_order)
        db.add(block)
        db.flush()  # populate block.id
        for li_order, item_name in enumerate(items):
            db.add(
                LineItem(
                    user_id=user_id,
                    block_id=block.id,
                    name=item_name,
                    sort_order=li_order,
                )
            )

    db.add_all(
        PaymentSource(user_id=user_id, name=n, sort_order=i)
        for i, n in enumerate(SEED_PAYMENT_SOURCES)
    )
    db.add_all(
        IncomeSource(user_id=user_id, name=n, sort_order=i)
        for i, n in enumerate(SEED_INCOME_SOURCES)
    )
