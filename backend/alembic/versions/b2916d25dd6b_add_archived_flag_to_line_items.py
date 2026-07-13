"""add archived flag to line items

Archived line items are hidden from the category dropdowns (Quick Add,
Bulk Upload, transaction edit) but keep their transaction history, so the
matrix still shows past months. This replaces "delete" for items that have
been used before.

Note: autogenerate also proposed recreating indexes/constraints that the
multiuser migration script created outside Alembic; those were dropped from
this revision on purpose — it must only add the column.

Revision ID: b2916d25dd6b
Revises: ff2fa3bf58b5
Create Date: 2026-07-13 13:33:27.356911

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2916d25dd6b'
down_revision: Union[str, None] = 'ff2fa3bf58b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sa.false() compiles to 0 on SQLite and false on Postgres, so the same
    # migration runs against both dev and prod databases.
    op.add_column(
        'line_items',
        sa.Column('archived', sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    with op.batch_alter_table('line_items', schema=None) as batch_op:
        batch_op.drop_column('archived')
