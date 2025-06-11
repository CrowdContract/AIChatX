"""
Silver Layer — Cleaned, validated, conformed data.

Takes Bronze output and applies:
  1. Schema enforcement  (correct dtypes for every column)
  2. Deduplication       (on Order Item Id)
  3. Null handling       (fill / drop strategy per column)
  4. Date parsing        (standardise to datetime64)
  5. String normalisation (strip, title-case)
  6. Outlier removal     (IQR on Sales)
  7. Derived safety cols (_is_duplicate, _null_flag)

Silver is "trusted data" — analysts can query it directly and rely on it.
Saves to data/silver/supply_chain_silver.parquet
"""

import os
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

SILVER_DIR  = os.path.join(os.path.dirname(__file__), "..", "data", "silver")
OUT_PARQUET = os.path.join(SILVER_DIR, "supply_chain_silver.parquet")
OUT_CSV     = os.path.join(SILVER_DIR, "supply_chain_silver.csv")

# Columns to drop at Silver (contain PII or are 100 % null)
DROP_COLS = ["Customer Password", "Product Description", "Product Image",
             "_row_hash", "_source_file", "_ingestion_ts", "_row_number"]

DATE_COL_MAP = {
    "order date (DateOrders)":    "order_date",
    "shipping date (DateOrders)": "ship_date",
}

STRING_COLS = [
    "Customer City", "Customer Country", "Customer State",
    "Order City", "Order Country", "Order State", "Order Region",
    "Category Name", "Department Name", "Market",
    "Delivery Status", "Order Status", "Shipping Mode",
    "Customer Segment", "Product Name",
]

NUMERIC_COLS = [
    "Days for shipping (real)", "Days for shipment (scheduled)",
    "Benefit per order", "Sales per customer",
    "Order Item Discount", "Order Item Discount Rate",
    "Order Item Product Price", "Order Item Profit Ratio",
    "Order Item Quantity", "Sales", "Order Item Total",
    "Order Profit Per Order", "Product Price",
]


def _enforce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce numeric columns to float and integer IDs to Int64 (nullable)."""
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    int_id_cols = ["Customer Id", "Order Id", "Order Item Id",
                   "Product Card Id", "Category Id", "Department Id"]
    for col in int_id_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")

    return df


def refine_silver(bronze_df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform Bronze → Silver.

    Parameters
    ----------
    bronze_df : pd.DataFrame
        Output of bronze_layer.ingest_bronze().

    Returns
    -------
    pd.DataFrame  — clean, typed, conformed records
    """
    logger.info("Silver layer — refining %d Bronze rows.", len(bronze_df))
    df = bronze_df.copy()

    # ── 1. Drop noise columns ─────────────────────────────────────────────────
    drop_existing = [c for c in DROP_COLS if c in df.columns]
    df.drop(columns=drop_existing, inplace=True)

    # ── 2. Type enforcement ───────────────────────────────────────────────────
    df = _enforce_types(df)

    # ── 3. Parse dates ────────────────────────────────────────────────────────
    for raw_col, clean_col in DATE_COL_MAP.items():
        if raw_col in df.columns:
            df[clean_col] = pd.to_datetime(df[raw_col], errors="coerce")
            df.drop(columns=[raw_col], inplace=True)

    bad_dates = df["order_date"].isna().sum()
    if bad_dates:
        logger.warning("Dropping %d rows with unparseable order_date.", bad_dates)
        df = df[df["order_date"].notna()].copy()

    # ── 4. Deduplication ──────────────────────────────────────────────────────
    before = len(df)
    df["_is_duplicate"] = df.duplicated(subset=["Order Item Id"], keep="first")
    df = df[~df["_is_duplicate"]].copy()
    logger.info("Silver — duplicates removed: %d", before - len(df))

    # ── 5. Null handling ──────────────────────────────────────────────────────
    df["Customer Lname"]    = df["Customer Lname"].fillna("Unknown")
    df["Customer Zipcode"]  = df["Customer Zipcode"].fillna(0).astype(float)
    df["Order Zipcode"]     = df["Order Zipcode"].fillna(0).astype(float)

    # ── 6. String normalisation ───────────────────────────────────────────────
    for col in STRING_COLS:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.title()

    # ── 7. Outlier removal (Sales: 1st–99th percentile) ───────────────────────
    q1  = df["Sales"].quantile(0.01)
    q99 = df["Sales"].quantile(0.99)
    before = len(df)
    df = df[(df["Sales"] >= q1) & (df["Sales"] <= q99)].copy()
    logger.info("Silver — outlier rows removed: %d", before - len(df))

    # ── 8. Add Silver audit column ────────────────────────────────────────────
    df["_silver_processed"] = True

    # ── Persist ───────────────────────────────────────────────────────────────
    os.makedirs(SILVER_DIR, exist_ok=True)
    try:
        df.to_parquet(OUT_PARQUET, index=False, engine="pyarrow")
        logger.info("Silver saved as Parquet → %s  (%d rows)", OUT_PARQUET, len(df))
    except ImportError:
        df.to_csv(OUT_CSV, index=False)
        logger.info("Silver saved as CSV → %s  (%d rows)", OUT_CSV, len(df))

    logger.info(
        "Silver stats — rows: %d | nulls remaining: %d",
        len(df),
        int(df.isnull().sum().sum()),
    )
    return df


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from extract.extract_supply_chain import extract_supply_chain
    from medallion.bronze_layer import ingest_bronze

    raw    = extract_supply_chain()
    bronze = ingest_bronze(raw)
    silver = refine_silver(bronze)
    print(silver.dtypes)
    print(silver.shape)
