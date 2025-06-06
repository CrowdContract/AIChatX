"""
Cleaning Layer — removes noise and standardises the raw supply chain data.

Steps
-----
1. Drop fully-empty columns (Product Description, Product Image)
2. Remove duplicate Order Item Ids
3. Fill minor nulls
4. Parse and standardise date columns
5. Normalise string columns (strip, title-case)
6. Remove statistical outliers in Sales using IQR
7. Save to data/cleaned/supply_chain_cleaned.csv
"""

import os
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

CLEANED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cleaned")
OUT_PATH = os.path.join(CLEANED_DIR, "supply_chain_cleaned.csv")

# Columns that are entirely useless (>99 % null or just URLs / passwords)
DROP_COLS = ["Product Description", "Product Image", "Customer Password"]

DATE_COLS = {
    "order date (DateOrders)": "order_date",
    "shipping date (DateOrders)": "ship_date",
}

STRING_COLS = [
    "Customer City", "Customer Country", "Customer State",
    "Order City", "Order Country", "Order State", "Order Region",
    "Category Name", "Department Name", "Market",
    "Delivery Status", "Order Status", "Shipping Mode",
    "Customer Segment", "Product Name",
]


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Clean *df* and return a sanitised DataFrame."""
    logger.info("Cleaning started — %d rows.", len(df))
    df = df.copy()

    # ── 1. Drop useless columns ───────────────────────────────────────────────
    existing_drop = [c for c in DROP_COLS if c in df.columns]
    df.drop(columns=existing_drop, inplace=True)
    logger.info("Dropped columns: %s", existing_drop)

    # ── 2. Rename columns: lowercase + underscores ────────────────────────────
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(r"[\s\(\)]+", "_", regex=True)
        .str.replace(r"_+", "_", regex=True)
        .str.strip("_")
    )

    # ── 3. Remove duplicates ─────────────────────────────────────────────────
    before = len(df)
    df.drop_duplicates(subset=["order_item_id"], inplace=True)
    logger.info("Duplicates removed: %d", before - len(df))

    # ── 4. Parse dates ────────────────────────────────────────────────────────
    df["order_date"] = pd.to_datetime(df["order_date_dateorders"], errors="coerce")
    df["ship_date"]  = pd.to_datetime(df["shipping_date_dateorders"], errors="coerce")
    df.drop(columns=["order_date_dateorders", "shipping_date_dateorders"], inplace=True, errors="ignore")

    # Drop rows where order_date is unparseable
    bad_dates = df["order_date"].isna().sum()
    if bad_dates:
        logger.warning("Dropping %d rows with unparseable order_date.", bad_dates)
        df = df[df["order_date"].notna()]

    # ── 5. Fill minor nulls ───────────────────────────────────────────────────
    df["customer_lname"] = df["customer_lname"].fillna("Unknown")
    df["customer_zipcode"] = df["customer_zipcode"].fillna(0).astype(float)
    df["order_zipcode"] = df["order_zipcode"].fillna(0).astype(float)

    # ── 6. Normalise string columns ───────────────────────────────────────────
    str_cols_lower = [c.lower().replace(" ", "_") for c in STRING_COLS]
    for col in str_cols_lower:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.title()

    # ── 7. Remove negative sales outliers ────────────────────────────────────
    q1 = df["sales"].quantile(0.01)
    q3 = df["sales"].quantile(0.99)
    before = len(df)
    df = df[(df["sales"] >= q1) & (df["sales"] <= q3)]
    logger.info("Outlier rows removed: %d", before - len(df))

    # ── Save ──────────────────────────────────────────────────────────────────
    os.makedirs(CLEANED_DIR, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)
    logger.info("Cleaned data saved → %s  (%d rows)", OUT_PATH, len(df))
    return df


if __name__ == "__main__":
    from extract.extract_supply_chain import extract_supply_chain
    raw = extract_supply_chain()
    cleaned = clean(raw)
    print(cleaned.dtypes)
    print(cleaned.shape)
