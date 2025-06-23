"""
Unit Tests — Supply Chain ETL Pipeline
Run: pytest tests/ -v
"""

import os
import sys
import pytest
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from extract.extract_supply_chain import extract_supply_chain
from validation.validate_supply_chain import validate
from transform.clean_orders import clean
from transform.feature_engineering import engineer_features
from transform.star_schema import build_star_schema

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def minimal_raw_df():
    """Minimal valid raw DataFrame mimicking the DataCo schema."""
    return pd.DataFrame({
        "Type": ["DEBIT", "TRANSFER"],
        "Days for shipping (real)": [3, 5],
        "Days for shipment (scheduled)": [4, 4],
        "Benefit per order": [91.25, -249.09],
        "Sales per customer": [314.64, 311.36],
        "Delivery Status": ["Advance shipping", "Late delivery"],
        "Late_delivery_risk": [0, 1],
        "Category Id": [73, 73],
        "Category Name": ["Sporting Goods", "Sporting Goods"],
        "Customer City": ["Caguas", "Caguas"],
        "Customer Country": ["Puerto Rico", "Puerto Rico"],
        "Customer Email": ["a@x.com", "b@x.com"],
        "Customer Fname": ["Alice", "Bob"],
        "Customer Id": [1001, 1002],
        "Customer Lname": ["Smith", None],
        "Customer Password": ["xxx", "yyy"],
        "Customer Segment": ["Consumer", "Consumer"],
        "Customer State": ["PR", "PR"],
        "Customer Street": ["123 Main St", "456 Elm St"],
        "Customer Zipcode": [725, None],
        "Department Id": [2, 2],
        "Department Name": ["Fitness", "Fitness"],
        "Latitude": [18.25, 18.28],
        "Longitude": [-66.04, -66.04],
        "Market": ["Pacific Asia", "Pacific Asia"],
        "Order City": ["Bekasi", "Bikaner"],
        "Order Country": ["Indonesia", "India"],
        "Order Customer Id": [1001, 1002],
        "order date (DateOrders)": ["1/31/2018 22:56", "1/13/2018 12:27"],
        "Order Id": [77202, 75939],
        "Order Item Cardprod Id": [1360, 1360],
        "Order Item Discount": [13.11, 16.39],
        "Order Item Discount Rate": [0.04, 0.05],
        "Order Item Id": [180517, 179254],
        "Order Item Product Price": [327.75, 327.75],
        "Order Item Profit Ratio": [0.29, -0.80],
        "Order Item Quantity": [1, 1],
        "Sales": [327.75, 311.36],
        "Order Item Total": [314.64, 311.36],
        "Order Profit Per Order": [91.25, -249.09],
        "Order Region": ["Southeast Asia", "South Asia"],
        "Order State": ["Java Occidental", "Rajastán"],
        "Order Status": ["COMPLETE", "PENDING"],
        "Order Zipcode": [None, None],
        "Product Card Id": [1360, 1360],
        "Product Category Id": [73, 73],
        "Product Description": [None, None],
        "Product Image": [None, None],
        "Product Name": ["Smart watch", "Smart watch"],
        "Product Price": [327.75, 327.75],
        "Product Status": [0, 0],
        "shipping date (DateOrders)": ["2/3/2018 22:56", "1/18/2018 12:27"],
        "Shipping Mode": ["Standard Class", "Standard Class"],
    })


# ── Extraction Tests ──────────────────────────────────────────────────────────

class TestExtract:
    def test_missing_file_raises(self):
        with pytest.raises(FileNotFoundError):
            extract_supply_chain("/nonexistent/path/file.csv")

    def test_returns_dataframe(self, minimal_raw_df, tmp_path):
        """Write to temp CSV and reload — should return DataFrame."""
        p = tmp_path / "test.csv"
        minimal_raw_df.to_csv(p, index=False, encoding="latin1")
        df = extract_supply_chain(str(p))
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2

    def test_correct_column_count(self, minimal_raw_df, tmp_path):
        p = tmp_path / "test.csv"
        minimal_raw_df.to_csv(p, index=False, encoding="latin1")
        df = extract_supply_chain(str(p))
        assert df.shape[1] == 53


# ── Validation Tests ──────────────────────────────────────────────────────────

class TestValidation:
    def test_detects_null_customer_id(self, minimal_raw_df):
        df = minimal_raw_df.copy()
        df.loc[0, "Customer Id"] = None
        result = validate(df)
        null_checks = [i for i in result["issues"] if i["check"] == "null_customer_id"]
        assert null_checks[0]["count"] == 1

    def test_detects_negative_price(self, minimal_raw_df):
        df = minimal_raw_df.copy()
        df.loc[0, "Product Price"] = -10
        result = validate(df)
        neg_checks = [i for i in result["issues"] if i["check"] == "negative_price"]
        assert neg_checks[0]["count"] == 1

    def test_detects_duplicates(self, minimal_raw_df):
        df = pd.concat([minimal_raw_df, minimal_raw_df], ignore_index=True)
        result = validate(df)
        dup_checks = [i for i in result["issues"] if i["check"] == "duplicates"]
        assert dup_checks[0]["count"] > 0

    def test_returns_dict(self, minimal_raw_df):
        result = validate(minimal_raw_df)
        assert isinstance(result, dict)
        assert "total_issues" in result


# ── Cleaning Tests ────────────────────────────────────────────────────────────

class TestCleaning:
    def test_removes_password_column(self, minimal_raw_df):
        cleaned = clean(minimal_raw_df)
        assert "customer_password" not in cleaned.columns

    def test_parses_dates(self, minimal_raw_df):
        cleaned = clean(minimal_raw_df)
        assert pd.api.types.is_datetime64_any_dtype(cleaned["order_date"])

    def test_fills_null_lname(self, minimal_raw_df):
        cleaned = clean(minimal_raw_df)
        assert cleaned["customer_lname"].isna().sum() == 0

    def test_no_duplicate_order_items(self, minimal_raw_df):
        dup = pd.concat([minimal_raw_df, minimal_raw_df], ignore_index=True)
        cleaned = clean(dup)
        assert cleaned["order_item_id"].duplicated().sum() == 0

    def test_returns_dataframe(self, minimal_raw_df):
        cleaned = clean(minimal_raw_df)
        assert isinstance(cleaned, pd.DataFrame)


# ── Feature Engineering Tests ─────────────────────────────────────────────────

class TestFeatureEngineering:
    @pytest.fixture
    def cleaned_df(self, minimal_raw_df):
        return clean(minimal_raw_df)

    def test_is_late_column_exists(self, cleaned_df):
        fe = engineer_features(cleaned_df)
        assert "is_late" in fe.columns

    def test_is_late_correct_values(self, minimal_raw_df):
        """Test on raw (uncleaned) data so IQR filter doesn't discard rows."""
        from transform.feature_engineering import engineer_features
        import pandas as pd

        # Build a minimal cleaned-like frame directly without going through clean()
        df = pd.DataFrame({
            "days_for_shipping_real":      [3, 5],
            "days_for_shipment_scheduled": [4, 4],
            "sales":                       [100.0, 200.0],
            "order_profit_per_order":      [20.0, 40.0],
            "order_item_product_price":    [100.0, 200.0],
            "order_item_discount":         [5.0, 10.0],
            "order_item_quantity":         [1, 2],
            "customer_id":                 [1, 2],
            "order_id":                    [101, 102],
            "order_date":                  pd.to_datetime(["2018-01-31", "2018-01-13"]),
        })
        fe = engineer_features(df)
        assert fe.iloc[0]["is_late"] == False   # delay = 3-4 = -1
        assert fe.iloc[1]["is_late"] == True    # delay = 5-4 = +1

    def test_time_dimensions(self, cleaned_df):
        fe = engineer_features(cleaned_df)
        assert "order_year" in fe.columns
        assert "order_month" in fe.columns
        assert "order_quarter" in fe.columns

    def test_clv_positive(self, cleaned_df):
        fe = engineer_features(cleaned_df)
        assert (fe["customer_lifetime_value"] > 0).all()


# ── Star Schema Tests ──────────────────────────────────────────────────────────

class TestStarSchema:
    @pytest.fixture
    def features_df(self, minimal_raw_df):
        cleaned = clean(minimal_raw_df)
        return engineer_features(cleaned)

    def test_all_tables_present(self, features_df):
        tables = build_star_schema(features_df)
        expected = {"dim_customer", "dim_product", "dim_date",
                    "dim_location", "dim_shipping", "fact_sales"}
        assert expected == set(tables.keys())

    def test_fact_sales_row_count(self, features_df):
        tables = build_star_schema(features_df)
        assert len(tables["fact_sales"]) == len(features_df)

    def test_dim_customer_unique_ids(self, features_df):
        tables = build_star_schema(features_df)
        dim = tables["dim_customer"]
        assert dim["customer_id"].nunique() == len(dim)

    def test_fact_has_all_keys(self, features_df):
        tables = build_star_schema(features_df)
        fact = tables["fact_sales"]
        for key in ["customer_id", "product_card_id", "date_id", "location_id", "shipping_id"]:
            assert key in fact.columns
