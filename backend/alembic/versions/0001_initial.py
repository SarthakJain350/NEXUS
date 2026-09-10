"""Initial schema: cameras, vehicles, observations, plate_reads.

Single migration per Plan §11 — tables, the nullable-unique ingest_id
index (§6.2), the composite (vehicle_id, timestamp) journey index
(§6.5), and all other §18 indexes are baked in from day one.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- cameras -----------------------------------------------------------
    op.create_table(
        "cameras",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("camera_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("location", sa.String(length=256), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_cameras_camera_id", "cameras", ["camera_id"], unique=True
    )

    # --- vehicles ----------------------------------------------------------
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("global_vehicle_id", sa.String(length=64), nullable=True),
        sa.Column("plate_number_best_guess", sa.String(length=16), nullable=True),
        sa.Column("vehicle_type", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_vehicles_global_vehicle_id", "vehicles", ["global_vehicle_id"], unique=True
    )
    op.create_index(
        "ix_vehicles_plate_number_best_guess",
        "vehicles",
        ["plate_number_best_guess"],
        unique=False,
    )

    # --- observations (main event table) ------------------------------------
    op.create_table(
        "observations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "vehicle_id",
            sa.Integer(),
            sa.ForeignKey("vehicles.id"),
            nullable=True,
        ),
        sa.Column(
            "camera_id",
            sa.String(length=64),
            sa.ForeignKey("cameras.camera_id"),
            nullable=False,
        ),
        sa.Column("track_id", sa.Integer(), nullable=False),
        sa.Column("plate_number", sa.String(length=16), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("vehicle_type", sa.String(length=16), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("ingest_id", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_observations_vehicle_id", "observations", ["vehicle_id"], unique=False)
    op.create_index("ix_observations_camera_id", "observations", ["camera_id"], unique=False)
    op.create_index("ix_observations_plate_number", "observations", ["plate_number"], unique=False)
    op.create_index("ix_observations_timestamp", "observations", ["timestamp"], unique=False)
    # Idempotency key: nullable-unique — Postgres allows multiple NULLs,
    # which is exactly what §6.2 needs (ingest_id optional per client).
    op.create_index("ix_observations_ingest_id", "observations", ["ingest_id"], unique=True)
    # Journey queries: out-of-order inserts, timestamp-sorted reads (§6.5).
    op.create_index(
        "ix_observations_vehicle_timestamp",
        "observations",
        ["vehicle_id", "timestamp"],
        unique=False,
    )

    # --- plate_reads (raw OCR trail, D5) ------------------------------------
    op.create_table(
        "plate_reads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "observation_id",
            sa.Integer(),
            sa.ForeignKey("observations.id"),
            nullable=False,
        ),
        sa.Column("plate_number_raw", sa.String(length=64), nullable=False),
        sa.Column("plate_number_normalized", sa.String(length=16), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_plate_reads_observation_id", "plate_reads", ["observation_id"], unique=False
    )


def downgrade() -> None:
    op.drop_table("plate_reads")
    op.drop_table("observations")
    op.drop_table("vehicles")
    op.drop_table("cameras")
