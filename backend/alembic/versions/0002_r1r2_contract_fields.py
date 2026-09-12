"""R1/R2 integration: frozen NEXUSVehicle contract fields (2026-09-12).

Additive only — no existing column is dropped or retyped:

- observations: frame_id, vehicle_bbox (JSONB), trajectory (JSONB),
  vehicle_crop_reference; latitude/longitude become nullable (payload →
  camera-row → null fallback, decision C7).
- plate_reads: plate_bbox (JSONB), ocr_confidence, detection_confidence,
  source (OCR engine tag). Rows are now written on ingest (C9).

Revision ID: 0002_r1r2_contract_fields
Revises: 0001_initial
Create Date: 2026-09-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002_r1r2_contract_fields"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- observations -------------------------------------------------------
    op.add_column(
        "observations", sa.Column("frame_id", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "observations",
        sa.Column("vehicle_bbox", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "observations", sa.Column("trajectory", postgresql.JSONB(), nullable=True)
    )
    op.add_column(
        "observations",
        sa.Column("vehicle_crop_reference", sa.String(length=512), nullable=True),
    )
    op.alter_column("observations", "latitude", existing_type=sa.Float(), nullable=True)
    op.alter_column("observations", "longitude", existing_type=sa.Float(), nullable=True)

    # --- plate_reads --------------------------------------------------------
    op.add_column(
        "plate_reads", sa.Column("plate_bbox", postgresql.JSONB(), nullable=True)
    )
    op.add_column("plate_reads", sa.Column("ocr_confidence", sa.Float(), nullable=True))
    op.add_column(
        "plate_reads", sa.Column("detection_confidence", sa.Float(), nullable=True)
    )
    op.add_column("plate_reads", sa.Column("source", sa.String(length=64), nullable=True))


def downgrade() -> None:
    # Reverse of upgrade: existing rows with null-lat/lon or new-field data
    # cannot survive a downgrade — drop the columns and restore NOT NULL.
    op.drop_column("plate_reads", "source")
    op.drop_column("plate_reads", "detection_confidence")
    op.drop_column("plate_reads", "ocr_confidence")
    op.drop_column("plate_reads", "plate_bbox")

    op.alter_column("observations", "longitude", existing_type=sa.Float(), nullable=False)
    op.alter_column("observations", "latitude", existing_type=sa.Float(), nullable=False)
    op.drop_column("observations", "vehicle_crop_reference")
    op.drop_column("observations", "trajectory")
    op.drop_column("observations", "vehicle_bbox")
    op.drop_column("observations", "frame_id")
