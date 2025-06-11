"""
Gold Layer — Business-ready aggregates and the Star Schema.

Takes Silver output and produces analytics-ready tables:

  gold_monthly_revenue      — revenue, profit, orders by year/month
  gold_market_performance   — KPIs by market and region
  gold_product_performance  — revenue, units, margin by product/category
  gold_customer_segments    — CLV, AOV, retention by segment
  gold_late_delivery_risk   — late % and avg delay by shipping mode
  gold_shipping_efficiency  — actual vs scheduled days by mode

  Plus the full Star Schema tables (fact_sales + 5 dimensions).

Gold tables are what the Streamlit dashboard and SQL analytics query.
Saves to data/gold/  (Parquet preferred, CSV fallback).
"""

import os
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

GOLD_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "gold")


def _save(df: pd.DataFrame, name: str) -> None:
    """Save a Gold table as Parquet (CSV fallback)."""
    os.makedirs(GOLD_DIR, exist_ok=True)
    path_pq  = os.path.join(GOLD_DIR, f"{name}.parquet")
    path_csv = os.path.join(GOLD_DIR, f"{name}.csv")
    try:
        df.to_parquet(path_pq, index=False, engine="pyarrow")
        logger.info("Gold %-35s → %d rows (Parquet)", name, len(df))
    except ImportError:
        df.to_csv(path_csv, index=False)
        logger.info("Gold %-35s → %d rows (CSV)", name, len(df))


def _prep(silver_df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalise Silver column names and add derived columns needed for Gold.
    Works whether Silver came from Parquet (already renamed) or raw Bronze.
    """
    df = silver_df.copy()

    # Rename raw-style columns if they still exist (CSV fallback path)
    rename_map = {
        "Order Item Id":                  "order_item_id",
        "Order Id":                       "order_id",
        "Customer Id":                    "customer_id",
        "Product Card Id":                "product_card_id",
        "Category Name":                  "category_name",
        "Department Name":                "department_name",
        "Product Name":                   "product_name",
        "Product Price":                  "product_price",
        "Market":                         "market",
        "Order Region":                   "order_region",
        "Order Country":                  "order_country",
        "Order City":                     "order_city",
        "Order State":                    "order_state",
        "Delivery Status":                "delivery_status",
        "Shipping Mode":                  "shipping_mode",
        "Customer Segment":               "customer_segment",
        "Sales":                          "sales",
        "Order Profit Per Order":         "order_profit_per_order",
        "Benefit per order":              "benefit_per_order",
        "Order Item Quantity":            "order_item_quantity",
        "Order Item Discount":            "order_item_discount",
        "Order Item Product Price":       "order_item_product_price",
        "Days for shipping (real)":       "days_for_shipping_real",
        "Days for shipment (scheduled)":  "days_for_shipment_scheduled",
        "Late_delivery_risk":             "late_delivery_risk",
        "Latitude":                       "latitude",
        "Longitude":                      "longitude",
        "Category Id":                    "category_id",
        "Department Id":                  "department_id",
        "Product Status":                 "product_status",
        "Order Status":                   "order_status",
        "Type":                           "type",
        "Customer Fname":                 "customer_fname",
        "Customer Lname":                 "customer_lname",
        "Customer City":                  "customer_city",
        "Customer State":                 "customer_state",
        "Customer Country":               "customer_country",
        "Customer Zipcode":               "customer_zipcode",
        "Order Zipcode":                  "order_zipcode",
        "Order Item Total":               "order_item_total",
    }
    df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns}, inplace=True)

    # Ensure order_date is datetime
    if "order_date" in df.columns:
        df["order_date"] = pd.to_datetime(df["order_date"], errors="coerce")

    # Derived columns
    df["order_year"]     = df["order_date"].dt.year
    df["order_month"]    = df["order_date"].dt.month
    df["order_quarter"]  = df["order_date"].dt.quarter
    df["order_month_name"] = df["order_date"].dt.strftime("%b")

    df["delivery_delay_days"] = df["days_for_shipping_real"] - df["days_for_shipment_scheduled"]
    df["is_late"]             = df["delivery_delay_days"] > 0

    df["profit_margin_pct"] = np.where(
        df["sales"] != 0,
        (df["order_profit_per_order"] / df["sales"] * 100).round(2), 0
    )
    df["discount_pct"] = np.where(
        df["order_item_product_price"] != 0,
        (df["order_item_discount"] / df["order_item_product_price"] * 100).round(2), 0
    )
    return df


# ── Gold table builders ───────────────────────────────────────────────────────

def _build_monthly_revenue(df: pd.DataFrame) -> pd.DataFrame:
    monthly = (
        df.groupby(["order_year", "order_month", "order_month_name"])
        .agg(
            total_revenue  = ("sales",                  "sum"),
            total_profit   = ("order_profit_per_order", "sum"),
            total_orders   = ("order_id",               "nunique"),
            total_items    = ("order_item_id",           "count"),
            avg_order_value= ("sales",                  "mean"),
        )
        .round(2)
        .reset_index()
        .sort_values(["order_year", "order_month"])
    )
    monthly["mom_revenue_growth_pct"] = (
        monthly["total_revenue"].pct_change() * 100
    ).round(2)
    return monthly


def _build_market_performance(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["market", "order_region", "order_country"])
        .agg(
            total_revenue  = ("sales",                  "sum"),
            total_profit   = ("order_profit_per_order", "sum"),
            total_orders   = ("order_id",               "nunique"),
            avg_margin_pct = ("profit_margin_pct",      "mean"),
            late_shipments = ("is_late",                "sum"),
            total_shipments= ("order_item_id",          "count"),
        )
        .assign(late_pct=lambda x: (x["late_shipments"] / x["total_shipments"] * 100).round(2))
        .round(2)
        .reset_index()
        .sort_values("total_revenue", ascending=False)
    )


def _build_product_performance(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["product_card_id", "product_name", "category_name", "department_name"])
        .agg(
            total_revenue  = ("sales",             "sum"),
            units_sold     = ("order_item_quantity","sum"),
            avg_margin_pct = ("profit_margin_pct", "mean"),
            avg_discount   = ("discount_pct",      "mean"),
            order_count    = ("order_id",           "nunique"),
        )
        .round(2)
        .reset_index()
        .sort_values("total_revenue", ascending=False)
    )


def _build_customer_segments(df: pd.DataFrame) -> pd.DataFrame:
    cust = (
        df.groupby(["customer_id", "customer_segment"])
        .agg(
            clv         = ("sales",    "sum"),
            aov         = ("sales",    "mean"),
            order_count = ("order_id", "nunique"),
        )
        .reset_index()
    )
    cust["is_repeat"] = cust["order_count"] > 1

    seg = (
        cust.groupby("customer_segment")
        .agg(
            total_customers  = ("customer_id",   "nunique"),
            avg_clv          = ("clv",            "mean"),
            avg_aov          = ("aov",            "mean"),
            repeat_customers = ("is_repeat",      "sum"),
            total_revenue    = ("clv",            "sum"),
        )
        .assign(repeat_rate_pct=lambda x: (x["repeat_customers"] / x["total_customers"] * 100).round(2))
        .round(2)
        .reset_index()
    )
    return seg


def _build_late_delivery_risk(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["shipping_mode", "delivery_status"])
        .agg(
            total_shipments = ("order_item_id",         "count"),
            late_shipments  = ("is_late",               "sum"),
            avg_delay_days  = ("delivery_delay_days",   "mean"),
            avg_revenue     = ("sales",                 "mean"),
        )
        .assign(late_pct=lambda x: (x["late_shipments"] / x["total_shipments"] * 100).round(2))
        .round(2)
        .reset_index()
        .sort_values("late_pct", ascending=False)
    )


def _build_shipping_efficiency(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby("shipping_mode")
        .agg(
            avg_actual_days    = ("days_for_shipping_real",        "mean"),
            avg_scheduled_days = ("days_for_shipment_scheduled",   "mean"),
            avg_delay          = ("delivery_delay_days",           "mean"),
            late_pct           = ("is_late",                       "mean"),
            shipment_count     = ("order_item_id",                 "count"),
            avg_revenue        = ("sales",                         "mean"),
        )
        .assign(late_pct=lambda x: (x["late_pct"] * 100).round(2))
        .round(2)
        .reset_index()
    )


# ── Star Schema (same logic as transform/star_schema.py but Gold-native) ─────

def _build_star_schema(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Build and return the six star-schema tables."""

    dim_customer = (
        df.assign(
            customer_lifetime_value=df.groupby("customer_id")["sales"].transform("sum"),
            avg_order_value        =df.groupby("customer_id")["sales"].transform("mean"),
            order_count            =df.groupby("customer_id")["order_id"].transform("nunique"),
        )[[
            "customer_id","customer_fname","customer_lname",
            "customer_segment","customer_city","customer_state",
            "customer_country","customer_zipcode",
            "customer_lifetime_value","avg_order_value","order_count",
        ]]
        .drop_duplicates(subset=["customer_id"])
        .assign(is_repeat_customer=lambda x: x["order_count"] > 1)
        .reset_index(drop=True)
    )

    dim_product = (
        df[[
            "product_card_id","product_name","product_price",
            "category_id","category_name","department_id","department_name","product_status",
        ]]
        .drop_duplicates(subset=["product_card_id"])
        .reset_index(drop=True)
    )

    dates = df["order_date"].drop_duplicates().sort_values().reset_index(drop=True)
    dim_date = pd.DataFrame({
        "date_id":      range(1, len(dates)+1),
        "full_date":    dates,
        "year":         dates.dt.year,
        "quarter":      dates.dt.quarter,
        "month":        dates.dt.month,
        "month_name":   dates.dt.strftime("%B"),
        "day":          dates.dt.day,
        "day_of_week":  dates.dt.day_name(),
        "week_of_year": dates.dt.isocalendar().week.astype(int),
    })
    date_map = dict(zip(dim_date["full_date"], dim_date["date_id"]))

    loc_cols = ["order_city","order_state","order_country","order_region","market"]
    dim_location = (
        df[loc_cols + ["latitude","longitude"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )
    dim_location.insert(0, "location_id", range(1, len(dim_location)+1))
    loc_map = dim_location.set_index(loc_cols)["location_id"].to_dict()

    dim_shipping = (
        df[["shipping_mode","delivery_status"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )
    dim_shipping.insert(0, "shipping_id", range(1, len(dim_shipping)+1))
    ship_map = dim_shipping.set_index(["shipping_mode","delivery_status"])["shipping_id"].to_dict()

    fact = df.copy()
    fact["date_id"]     = fact["order_date"].map(date_map)
    fact["location_id"] = list(zip(fact["order_city"],fact["order_state"],
                                   fact["order_country"],fact["order_region"],fact["market"]))
    fact["location_id"] = fact["location_id"].map(loc_map)
    fact["shipping_id"] = list(zip(fact["shipping_mode"], fact["delivery_status"]))
    fact["shipping_id"] = fact["shipping_id"].map(ship_map)

    fact_sales = fact[[
        "order_item_id","order_id","customer_id","product_card_id",
        "date_id","location_id","shipping_id",
        "order_item_quantity","sales","order_item_discount",
        "order_profit_per_order","benefit_per_order",
        "order_item_product_price","order_item_total",
        "days_for_shipping_real","delivery_delay_days",
        "is_late","profit_margin_pct","discount_pct",
        "order_status","type",
    ]].reset_index(drop=True)

    return {
        "dim_customer": dim_customer,
        "dim_product":  dim_product,
        "dim_date":     dim_date,
        "dim_location": dim_location,
        "dim_shipping": dim_shipping,
        "fact_sales":   fact_sales,
    }


# ── Main orchestrator ─────────────────────────────────────────────────────────

def build_gold(silver_df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """
    Build all Gold tables from Silver data.

    Returns
    -------
    dict[str, pd.DataFrame]  keyed by table name
    """
    logger.info("Gold layer — building aggregates from %d Silver rows.", len(silver_df))

    df = _prep(silver_df)

    tables = {
        # ── Aggregated KPI tables ─────────────────────────────────────────────
        "gold_monthly_revenue":    _build_monthly_revenue(df),
        "gold_market_performance": _build_market_performance(df),
        "gold_product_performance":_build_product_performance(df),
        "gold_customer_segments":  _build_customer_segments(df),
        "gold_late_delivery_risk": _build_late_delivery_risk(df),
        "gold_shipping_efficiency":_build_shipping_efficiency(df),
        # ── Star schema ───────────────────────────────────────────────────────
        **_build_star_schema(df),
    }

    for name, tbl in tables.items():
        _save(tbl, name)

    logger.info("Gold layer complete — %d tables written to %s", len(tables), GOLD_DIR)
    return tables


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from extract.extract_supply_chain import extract_supply_chain
    from medallion.bronze_layer import ingest_bronze
    from medallion.silver_layer import refine_silver

    raw    = extract_supply_chain()
    bronze = ingest_bronze(raw)
    silver = refine_silver(bronze)
    gold   = build_gold(silver)

    for name, tbl in gold.items():
        print(f"  {name:<35} {tbl.shape}")
