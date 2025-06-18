"""
FastAPI — Supply Chain Analytics API
Serves pre-computed Gold layer Parquet tables as JSON endpoints.
"""

import os
import math
from functools import lru_cache
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Supply Chain Analytics API",
    description="Medallion-architecture data served from Gold layer Parquet files.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Data paths ────────────────────────────────────────────────────────────────
GOLD_DIR = Path(__file__).resolve().parent.parent / "data" / "gold"


def _load(name: str) -> pd.DataFrame:
    path = GOLD_DIR / f"{name}.parquet"
    if not path.exists():
        raise HTTPException(status_code=503, detail=f"Data not ready: {name}")
    df = pd.read_parquet(path)
    # replace NaN / Inf so JSON serialisation doesn't break
    return df.replace([float("inf"), float("-inf")], None).fillna(
        {c: 0 for c in df.select_dtypes("number").columns}
    )


def _clean(df: pd.DataFrame) -> list[dict]:
    """Convert DataFrame to JSON-safe list of dicts."""
    records = df.to_dict(orient="records")
    cleaned = []
    for row in records:
        cleaned.append(
            {
                k: (None if (isinstance(v, float) and math.isnan(v)) else v)
                for k, v in row.items()
            }
        )
    return cleaned


# ── KPI summary ───────────────────────────────────────────────────────────────
@app.get("/api/kpis")
def get_kpis():
    rev  = _load("gold_monthly_revenue")
    fact = _load("fact_sales")
    cust = _load("dim_customer")
    late = _load("gold_late_delivery_risk")

    total_revenue   = round(float(rev["total_revenue"].sum()), 2)
    total_orders    = int(rev["total_orders"].sum())
    avg_order_value = round(total_revenue / total_orders if total_orders else 0, 2)
    total_profit    = round(float(rev["total_profit"].sum()), 2)
    total_customers = int(len(cust))
    late_pct        = round(
        float(late["late_shipments"].sum() / late["total_shipments"].sum() * 100), 1
    )
    profit_margin   = round(total_profit / total_revenue * 100, 1) if total_revenue else 0

    return {
        "total_revenue":   total_revenue,
        "total_orders":    total_orders,
        "avg_order_value": avg_order_value,
        "total_profit":    total_profit,
        "total_customers": total_customers,
        "late_pct":        late_pct,
        "profit_margin":   profit_margin,
    }


# ── Revenue trend ─────────────────────────────────────────────────────────────
@app.get("/api/revenue/monthly")
def get_monthly_revenue(year: int = Query(None)):
    df = _load("gold_monthly_revenue").sort_values(["order_year", "order_month"])
    if year:
        df = df[df["order_year"] == year]
    return _clean(df)


@app.get("/api/revenue/years")
def get_years():
    df = _load("gold_monthly_revenue")
    return sorted(df["order_year"].dropna().unique().astype(int).tolist())


# ── Market performance ────────────────────────────────────────────────────────
@app.get("/api/market")
def get_market(limit: int = Query(20)):
    df = _load("gold_market_performance").sort_values("total_revenue", ascending=False)
    return _clean(df.head(limit))


@app.get("/api/market/by-region")
def get_market_by_region():
    df = _load("gold_market_performance")
    grouped = (
        df.groupby("market")
        .agg(
            total_revenue=("total_revenue", "sum"),
            total_orders =("total_orders",  "sum"),
            late_pct     =("late_pct",      "mean"),
        )
        .round(2)
        .reset_index()
        .sort_values("total_revenue", ascending=False)
    )
    return _clean(grouped)


# ── Products ──────────────────────────────────────────────────────────────────
@app.get("/api/products/top")
def get_top_products(limit: int = Query(10)):
    df = _load("gold_product_performance").sort_values("total_revenue", ascending=False)
    return _clean(df.head(limit))


@app.get("/api/products/categories")
def get_categories():
    df = _load("gold_product_performance")
    grouped = (
        df.groupby("category_name")
        .agg(
            total_revenue =("total_revenue",  "sum"),
            units_sold    =("units_sold",      "sum"),
            avg_margin_pct=("avg_margin_pct",  "mean"),
        )
        .round(2)
        .reset_index()
        .sort_values("total_revenue", ascending=False)
    )
    return _clean(grouped)


# ── Customers ─────────────────────────────────────────────────────────────────
@app.get("/api/customers/segments")
def get_customer_segments():
    return _clean(_load("gold_customer_segments"))


@app.get("/api/customers/top")
def get_top_customers(limit: int = Query(10)):
    df = _load("dim_customer").sort_values("customer_lifetime_value", ascending=False)
    cols = [
        "customer_id", "customer_fname", "customer_lname",
        "customer_segment", "customer_country",
        "customer_lifetime_value", "avg_order_value",
        "order_count", "is_repeat_customer",
    ]
    return _clean(df[cols].head(limit))


# ── Delivery / shipping ───────────────────────────────────────────────────────
@app.get("/api/delivery/risk")
def get_delivery_risk():
    return _clean(_load("gold_late_delivery_risk").sort_values("late_pct", ascending=False))


@app.get("/api/delivery/shipping-efficiency")
def get_shipping_efficiency():
    return _clean(_load("gold_shipping_efficiency"))


# ── Export ────────────────────────────────────────────────────────────────────
from fastapi.responses import StreamingResponse
import io

@app.get("/api/export/{table}")
def export_csv(table: str):
    allowed = {
        "monthly_revenue", "market_performance", "product_performance",
        "customer_segments", "late_delivery_risk", "shipping_efficiency",
    }
    if table not in allowed:
        raise HTTPException(status_code=400, detail="Unknown table")
    df = _load(f"gold_{table}")
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={table}.csv"},
    )


# ── Metadata ──────────────────────────────────────────────────────────────────
import os as _os
from datetime import datetime as _dt

@app.get("/api/meta")
def get_meta():
    fact_path = GOLD_DIR / "fact_sales.parquet"
    last_refresh = (
        _dt.fromtimestamp(fact_path.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
        if fact_path.exists() else "unknown"
    )
    return {
        "last_refresh":    last_refresh,
        "source":          "DataCo Supply Chain Dataset (Kaggle)",
        "record_count":    178027,
        "date_range":      "Jan 2015 – Sep 2017",
        "classification":  "Internal Only",
        "owner":           "Data Engineering Team",
        "contact":         "data-team@company.com",
        "pipeline":        "Python · Pandas · FastAPI · PostgreSQL · Airflow · Docker",
        "architecture":    "Medallion (Bronze → Silver → Gold)",
    }


# ── Anomalies ─────────────────────────────────────────────────────────────────
@app.get("/api/anomalies")
def get_anomalies():
    """Return months where MoM revenue growth was an outlier (>2 std dev)."""
    df = _load("gold_monthly_revenue").sort_values(["order_year", "order_month"])
    df["period"] = df["order_month_name"] + " " + df["order_year"].astype(str)
    mean = df["mom_revenue_growth_pct"].mean()
    std  = df["mom_revenue_growth_pct"].std()
    anomalies = df[
        (df["mom_revenue_growth_pct"].notna()) &
        ((df["mom_revenue_growth_pct"] - mean).abs() > 1.8 * std)
    ][["period", "order_year", "order_month", "total_revenue", "mom_revenue_growth_pct"]]
    return _clean(anomalies)


# ── Benchmarks ────────────────────────────────────────────────────────────────
@app.get("/api/benchmarks")
def get_benchmarks():
    """Static industry-style benchmarks for the supply chain domain."""
    return {
        "target_late_pct":        30.0,   # industry target: <30% late
        "target_profit_margin":   15.0,   # target margin %
        "target_aov":             500.0,  # target avg order value $
        "target_repeat_rate":     60.0,   # target repeat customer %
    }


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    tables = [p.stem for p in GOLD_DIR.glob("*.parquet")]
    return {"status": "ok", "tables_available": len(tables), "tables": tables}
