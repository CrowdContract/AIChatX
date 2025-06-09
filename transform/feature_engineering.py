"""
Feature Engineering Layer — derives business KPIs from the cleaned data.

New columns created
-------------------
- order_year, order_month, order_quarter  (time dimensions)
- delivery_days_actual                    (actual shipping duration)
- delivery_delay_days                     (actual − scheduled; positive = late)
- is_late                                 (bool flag)
- profit_margin_pct                       (profit / sales × 100)
- discount_pct                            (discount / product price × 100)
- revenue_per_item                        (sales / quantity)
- customer_lifetime_value (CLV)           (total sales per customer)
- avg_order_value (AOV)                   (mean order total per customer)
- is_repeat_customer                      (ordered more than once)
"""

import os
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

TRANSFORMED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "transformed")
OUT_PATH = os.path.join(TRANSFORMED_DIR, "supply_chain_features.csv")


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived columns to the cleaned supply chain DataFrame."""
    logger.info("Feature engineering started — %d rows.", len(df))
    df = df.copy()

    # ── Time dimensions ───────────────────────────────────────────────────────
    df["order_year"] = df["order_date"].dt.year
    df["order_month"] = df["order_date"].dt.month
    df["order_quarter"] = df["order_date"].dt.quarter
    df["order_month_name"] = df["order_date"].dt.strftime("%b")

    # ── Delivery metrics ──────────────────────────────────────────────────────
    df["delivery_days_actual"] = df["days_for_shipping_real"]
    df["delivery_delay_days"] = (
        df["days_for_shipping_real"] - df["days_for_shipment_scheduled"]
    )
    df["is_late"] = df["delivery_delay_days"] > 0

    # ── Financial metrics ─────────────────────────────────────────────────────
    df["profit_margin_pct"] = np.where(
        df["sales"] != 0,
        (df["order_profit_per_order"] / df["sales"] * 100).round(2),
        0,
    )
    df["discount_pct"] = np.where(
        df["order_item_product_price"] != 0,
        (df["order_item_discount"] / df["order_item_product_price"] * 100).round(2),
        0,
    )
    df["revenue_per_item"] = np.where(
        df["order_item_quantity"] != 0,
        (df["sales"] / df["order_item_quantity"]).round(2),
        0,
    )

    # ── Customer-level aggregates ─────────────────────────────────────────────
    clv = df.groupby("customer_id")["sales"].sum().rename("customer_lifetime_value")
    aov = df.groupby("customer_id")["sales"].mean().rename("avg_order_value")
    order_count = df.groupby("customer_id")["order_id"].nunique().rename("order_count")

    df = df.join(clv, on="customer_id")
    df = df.join(aov, on="customer_id")
    df = df.join(order_count, on="customer_id")
    df["is_repeat_customer"] = df["order_count"] > 1

    # ── Save ──────────────────────────────────────────────────────────────────
    os.makedirs(TRANSFORMED_DIR, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)
    logger.info("Feature-engineered data saved → %s  (%d rows)", OUT_PATH, len(df))
    return df


if __name__ == "__main__":
    cleaned = pd.read_csv(
        os.path.join(os.path.dirname(__file__), "..", "data", "cleaned", "supply_chain_cleaned.csv"),
        parse_dates=["order_date", "ship_date"],
    )
    result = engineer_features(cleaned)
    print(result[["order_year", "is_late", "profit_margin_pct", "customer_lifetime_value"]].head())
