"""
Bronze Layer — Raw ingestion, zero transformation.

Philosophy
----------
- Accept data exactly as received from the source.
- Never modify values, only add metadata columns.
- Append-only: every pipeline run stamps a new ingestion_timestamp,
  so you can always replay history.
- Saves to data/bronze/supply_chain_bronze.parquet  (Parquet preserves
  types better than CSV for a lakehouse pattern; CSV fallback included).

Bronze is the "single source of truth" for the raw data.
"""

import os
import logging
import hashlib
from datetime import datetime, timezone

import pandas as pd

logger = logging.getLogger(__name__)

BRONZE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "bronze")
OUT_PARQUET = os.path.join(BRONZE_DIR, "supply_chain_bronze.parquet")
OUT_CSV     = os.path.join(BRONZE_DIR, "supply_chain_bronze.csv")


def _row_hash(df: pd.DataFrame) -> pd.Series:
    """SHA-256 fingerprint per row for dedup / lineage tracking."""
    return df.apply(
        lambda row: hashlib.sha256("|".join(str(v) for v in row).encode()).hexdigest()[:16],
        axis=1,
    )


def ingest_bronze(raw_df: pd.DataFrame) -> pd.DataFrame:
    """
    Stamp raw data with metadata and persist to the Bronze layer.

    Added metadata columns
    ----------------------
    _ingestion_ts   : UTC timestamp of this pipeline run
    _source_file    : hard-coded source identifier
    _row_hash       : short hash of raw row content (for lineage)
    _row_number     : original row index in the source file

    Parameters
    ----------
    raw_df : pd.DataFrame
        Unmodified DataFrame straight from extract_supply_chain().

    Returns
    -------
    pd.DataFrame  — raw data + metadata columns
    """
    logger.info("Bronze layer — ingesting %d rows.", len(raw_df))

    df = raw_df.copy()

    # ── Metadata columns ──────────────────────────────────────────────────────
    now = datetime.now(timezone.utc).isoformat()
    df["_ingestion_ts"]  = now
    df["_source_file"]   = "DataCoSupplyChainDataset.csv"
    df["_row_number"]    = range(1, len(df) + 1)
    df["_row_hash"]      = _row_hash(raw_df)

    # ── Persist ───────────────────────────────────────────────────────────────
    os.makedirs(BRONZE_DIR, exist_ok=True)

    try:
        df.to_parquet(OUT_PARQUET, index=False, engine="pyarrow")
        logger.info("Bronze saved as Parquet → %s  (%d rows)", OUT_PARQUET, len(df))
    except ImportError:
        # pyarrow not installed — fall back to CSV
        logger.warning("pyarrow not found, falling back to CSV for Bronze layer.")
        df.to_csv(OUT_CSV, index=False)
        logger.info("Bronze saved as CSV → %s  (%d rows)", OUT_CSV, len(df))

    # ── Quality snapshot ──────────────────────────────────────────────────────
    logger.info(
        "Bronze stats — rows: %d | columns: %d | null cells: %d | duplicate hashes: %d",
        len(df),
        len(df.columns),
        int(df.isnull().sum().sum()),
        int(df["_row_hash"].duplicated().sum()),
    )

    return df


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from extract.extract_supply_chain import extract_supply_chain
    raw = extract_supply_chain()
    bronze = ingest_bronze(raw)
    print(bronze[["Customer Id", "_ingestion_ts", "_row_hash"]].head())
