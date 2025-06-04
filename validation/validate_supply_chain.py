"""
Validation Layer — checks data quality and writes a validation_report.csv.

Checks performed
----------------
1. Missing values per column
2. Duplicate order-item rows
3. Negative prices / sales
4. Invalid dates
5. Null customer IDs
6. Unknown delivery statuses
"""

import os
import logging
import pandas as pd

logger = logging.getLogger(__name__)

CLEANED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cleaned")
REPORT_PATH = os.path.join(CLEANED_DIR, "validation_report.csv")

VALID_DELIVERY_STATUSES = {
    "Advance shipping",
    "Late delivery",
    "Shipping on time",
    "Shipping canceled",
}


def validate(df: pd.DataFrame) -> dict:
    """
    Run all quality checks on *df* and return a summary dict.
    Also saves a CSV report to data/cleaned/validation_report.csv.
    """
    logger.info("Validation started — %d rows.", len(df))
    issues = []

    # 1. Missing values
    null_counts = df.isnull().sum()
    for col, cnt in null_counts[null_counts > 0].items():
        pct = cnt / len(df) * 100
        issues.append({"check": "missing_values", "column": col, "count": int(cnt), "pct": round(pct, 2)})
        logger.warning("Missing values — %s: %d (%.1f%%)", col, cnt, pct)

    # 2. Duplicate rows (Order Item Id is the grain)
    dup_count = df.duplicated(subset=["Order Item Id"]).sum()
    issues.append({"check": "duplicates", "column": "Order Item Id", "count": int(dup_count), "pct": 0})
    if dup_count:
        logger.warning("Duplicate Order Item Ids: %d", dup_count)

    # 3. Negative prices
    neg_price = (df["Product Price"] < 0).sum()
    neg_sales = (df["Sales"] < 0).sum()
    issues.append({"check": "negative_price", "column": "Product Price", "count": int(neg_price), "pct": 0})
    issues.append({"check": "negative_sales", "column": "Sales", "count": int(neg_sales), "pct": 0})
    if neg_price:
        logger.warning("Negative Product Price rows: %d", neg_price)
    if neg_sales:
        logger.warning("Negative Sales rows: %d", neg_sales)

    # 4. Invalid dates
    for col in ["order date (DateOrders)", "shipping date (DateOrders)"]:
        bad = pd.to_datetime(df[col], errors="coerce").isna().sum()
        issues.append({"check": "invalid_date", "column": col, "count": int(bad), "pct": 0})
        if bad:
            logger.warning("Invalid dates in %s: %d", col, bad)

    # 5. Null customer IDs
    null_cust = df["Customer Id"].isna().sum()
    issues.append({"check": "null_customer_id", "column": "Customer Id", "count": int(null_cust), "pct": 0})
    if null_cust:
        logger.warning("Null Customer IDs: %d", null_cust)

    # 6. Unknown delivery statuses
    bad_status = (~df["Delivery Status"].isin(VALID_DELIVERY_STATUSES)).sum()
    issues.append({"check": "unknown_delivery_status", "column": "Delivery Status", "count": int(bad_status), "pct": 0})
    if bad_status:
        logger.warning("Unknown Delivery Status values: %d", bad_status)

    report_df = pd.DataFrame(issues)
    os.makedirs(CLEANED_DIR, exist_ok=True)
    report_df.to_csv(REPORT_PATH, index=False)
    logger.info("Validation report saved → %s", REPORT_PATH)

    total_issues = sum(i["count"] for i in issues)
    logger.info("Validation complete — %d total issues flagged.", total_issues)
    return {"issues": issues, "total_issues": total_issues}


if __name__ == "__main__":
    from extract.extract_supply_chain import extract_supply_chain
    df = extract_supply_chain()
    result = validate(df)
    print(result)
