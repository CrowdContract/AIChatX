"""
Star Schema Builder — splits the feature-engineered flat table into:

  Dimensions                    Fact
  ──────────                    ────
  dim_customer                  fact_sales
  dim_product
  dim_date
  dim_location
  dim_shipping

Saves each table as a CSV under data/transformed/star/.
"""

import os
import logging
import pandas as pd

logger = logging.getLogger(__name__)

STAR_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "transformed", "star")


def build_star_schema(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """
    Build and return a dict of {table_name: DataFrame}.

    Parameters
    ----------
    df : pd.DataFrame
        Feature-engineered supply chain data.
    """
    logger.info("Building star schema from %d rows.", len(df))
    os.makedirs(STAR_DIR, exist_ok=True)

    # ── dim_customer ──────────────────────────────────────────────────────────
    dim_customer = (
        df[[
            "customer_id", "customer_fname", "customer_lname",
            "customer_segment", "customer_city", "customer_state",
            "customer_country", "customer_zipcode",
            "customer_lifetime_value", "avg_order_value",
            "order_count", "is_repeat_customer",
        ]]
        .drop_duplicates(subset=["customer_id"])
        .reset_index(drop=True)
    )
    logger.info("dim_customer: %d rows", len(dim_customer))

    # ── dim_product ───────────────────────────────────────────────────────────
    dim_product = (
        df[[
            "product_card_id", "product_name", "product_price",
            "category_id", "category_name",
            "department_id", "department_name", "product_status",
        ]]
        .drop_duplicates(subset=["product_card_id"])
        .reset_index(drop=True)
    )
    logger.info("dim_product: %d rows", len(dim_product))

    # ── dim_date ──────────────────────────────────────────────────────────────
    dates = df["order_date"].drop_duplicates().sort_values().reset_index(drop=True)
    dim_date = pd.DataFrame({
        "date_id": range(1, len(dates) + 1),
        "full_date": dates,
        "year": dates.dt.year,
        "quarter": dates.dt.quarter,
        "month": dates.dt.month,
        "month_name": dates.dt.strftime("%B"),
        "day": dates.dt.day,
        "day_of_week": dates.dt.day_name(),
        "week_of_year": dates.dt.isocalendar().week.astype(int),
    })
    # map date → date_id back onto df
    date_map = dict(zip(dim_date["full_date"], dim_date["date_id"]))
    logger.info("dim_date: %d rows", len(dim_date))

    # ── dim_location ──────────────────────────────────────────────────────────
    dim_location = (
        df[[
            "order_city", "order_state", "order_country",
            "order_region", "market", "latitude", "longitude",
        ]]
        .drop_duplicates()
        .reset_index(drop=True)
    )
    dim_location.insert(0, "location_id", range(1, len(dim_location) + 1))
    logger.info("dim_location: %d rows", len(dim_location))

    # location_id map
    loc_key = ["order_city", "order_state", "order_country", "order_region", "market"]
    loc_map = dim_location.set_index(loc_key)["location_id"].to_dict()

    # ── dim_shipping ──────────────────────────────────────────────────────────
    dim_shipping = (
        df[["shipping_mode", "delivery_status"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )
    dim_shipping.insert(0, "shipping_id", range(1, len(dim_shipping) + 1))
    logger.info("dim_shipping: %d rows", len(dim_shipping))

    ship_map = (
        dim_shipping.set_index(["shipping_mode", "delivery_status"])["shipping_id"].to_dict()
    )

    # ── fact_sales ────────────────────────────────────────────────────────────
    fact = df.copy()
    fact["date_id"] = fact["order_date"].map(date_map)
    fact["location_id"] = fact.set_index(loc_key).index.map(loc_map)
    fact["shipping_id"] = list(
        zip(fact["shipping_mode"], fact["delivery_status"])
    )
    fact["shipping_id"] = fact["shipping_id"].map(ship_map)

    fact_sales = fact[[
        "order_item_id", "order_id",
        "customer_id", "product_card_id",
        "date_id", "location_id", "shipping_id",
        "order_item_quantity", "sales", "order_item_discount",
        "order_profit_per_order", "benefit_per_order",
        "order_item_product_price", "order_item_total",
        "delivery_days_actual", "delivery_delay_days",
        "is_late", "profit_margin_pct", "discount_pct",
        "revenue_per_item", "order_status", "type",
    ]].reset_index(drop=True)
    logger.info("fact_sales: %d rows", len(fact_sales))

    tables = {
        "dim_customer": dim_customer,
        "dim_product": dim_product,
        "dim_date": dim_date,
        "dim_location": dim_location,
        "dim_shipping": dim_shipping,
        "fact_sales": fact_sales,
    }

    for name, tbl in tables.items():
        path = os.path.join(STAR_DIR, f"{name}.csv")
        tbl.to_csv(path, index=False)
        logger.info("Saved %s → %s", name, path)

    return tables


if __name__ == "__main__":
    features = pd.read_csv(
        os.path.join(os.path.dirname(__file__), "..", "data", "transformed", "supply_chain_features.csv"),
        parse_dates=["order_date", "ship_date"],
    )
    tables = build_star_schema(features)
    for t, d in tables.items():
        print(t, d.shape)
