"""
FastAPI — Supply Chain Analytics API
Reads pre-computed JSON files (converted from Gold Parquet at build time).
No pandas or pyarrow required at runtime — works within Vercel's 250 MB limit.
"""

import os
import json
import math
import io
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Supply Chain Analytics API",
    description="Medallion-architecture data served from pre-computed JSON files.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Data directory — works both locally and on Vercel ────────────────────────
DATA_DIR = Path(__file__).resolve().parent / "data"


def _load(name: str) -> list[dict]:
    path = DATA_DIR / f"{name}.json"
    if not path.exists():
        raise HTTPException(status_code=503, detail=f"Data not ready: {name}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _safe(v):
    """Make a value JSON-safe."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _clean(records: list[dict]) -> list[dict]:
    return [{k: _safe(v) for k, v in row.items()} for row in records]


# ── KPI summary ───────────────────────────────────────────────────────────────
@app.get("/api/kpis")
def get_kpis():
    rev  = _load("gold_monthly_revenue")
    cust = _load("dim_customer")
    late = _load("gold_late_delivery_risk")

    total_revenue   = round(sum(r["total_revenue"]  for r in rev), 2)
    total_orders    = sum(r["total_orders"]   for r in rev)
    total_profit    = round(sum(r["total_profit"]    for r in rev), 2)
    total_customers = len(cust)
    total_late      = sum(r["late_shipments"]   for r in late)
    total_ships     = sum(r["total_shipments"]  for r in late)
    late_pct        = round(total_late / total_ships * 100, 1) if total_ships else 0
    avg_order_value = round(total_revenue / total_orders, 2) if total_orders else 0
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
    data = _load("gold_monthly_revenue")
    data.sort(key=lambda r: (r["order_year"], r["order_month"]))
    if year:
        data = [r for r in data if r["order_year"] == year]
    return _clean(data)


@app.get("/api/revenue/years")
def get_years():
    data = _load("gold_monthly_revenue")
    return sorted({int(r["order_year"]) for r in data})


# ── Market ────────────────────────────────────────────────────────────────────
@app.get("/api/market")
def get_market(limit: int = Query(20)):
    data = sorted(_load("gold_market_performance"), key=lambda r: r["total_revenue"], reverse=True)
    return _clean(data[:limit])


@app.get("/api/market/by-region")
def get_market_by_region():
    data = _load("gold_market_performance")
    agg: dict[str, dict] = {}
    for r in data:
        m = r["market"]
        if m not in agg:
            agg[m] = {"market": m, "total_revenue": 0, "total_orders": 0, "late_pct_sum": 0, "n": 0}
        agg[m]["total_revenue"] += r["total_revenue"]
        agg[m]["total_orders"]  += r["total_orders"]
        agg[m]["late_pct_sum"]  += r["late_pct"]
        agg[m]["n"] += 1
    result = []
    for v in agg.values():
        result.append({
            "market":        v["market"],
            "total_revenue": round(v["total_revenue"], 2),
            "total_orders":  v["total_orders"],
            "late_pct":      round(v["late_pct_sum"] / v["n"], 2) if v["n"] else 0,
        })
    return _clean(sorted(result, key=lambda r: r["total_revenue"], reverse=True))


# ── Products ──────────────────────────────────────────────────────────────────
@app.get("/api/products/top")
def get_top_products(limit: int = Query(10)):
    data = sorted(_load("gold_product_performance"), key=lambda r: r["total_revenue"], reverse=True)
    return _clean(data[:limit])


@app.get("/api/products/categories")
def get_categories():
    data = _load("gold_product_performance")
    agg: dict[str, dict] = {}
    for r in data:
        c = r["category_name"]
        if c not in agg:
            agg[c] = {"category_name": c, "total_revenue": 0, "units_sold": 0, "margin_sum": 0, "n": 0}
        agg[c]["total_revenue"] += r["total_revenue"]
        agg[c]["units_sold"]    += r["units_sold"]
        agg[c]["margin_sum"]    += r["avg_margin_pct"]
        agg[c]["n"] += 1
    result = [{
        "category_name":  v["category_name"],
        "total_revenue":  round(v["total_revenue"], 2),
        "units_sold":     v["units_sold"],
        "avg_margin_pct": round(v["margin_sum"] / v["n"], 2) if v["n"] else 0,
    } for v in agg.values()]
    return _clean(sorted(result, key=lambda r: r["total_revenue"], reverse=True))


# ── Customers ─────────────────────────────────────────────────────────────────
@app.get("/api/customers/segments")
def get_customer_segments():
    return _clean(_load("gold_customer_segments"))


@app.get("/api/customers/top")
def get_top_customers(limit: int = Query(10)):
    data = _load("dim_customer")
    data.sort(key=lambda r: r.get("customer_lifetime_value", 0), reverse=True)
    cols = ["customer_id", "customer_fname", "customer_lname", "customer_segment",
            "customer_country", "customer_lifetime_value", "avg_order_value",
            "order_count", "is_repeat_customer"]
    return _clean([{k: r.get(k) for k in cols} for r in data[:limit]])


# ── Delivery ──────────────────────────────────────────────────────────────────
@app.get("/api/delivery/risk")
def get_delivery_risk():
    data = sorted(_load("gold_late_delivery_risk"), key=lambda r: r["late_pct"], reverse=True)
    return _clean(data)


@app.get("/api/delivery/shipping-efficiency")
def get_shipping_efficiency():
    return _clean(_load("gold_shipping_efficiency"))


# ── Export ────────────────────────────────────────────────────────────────────
@app.get("/api/export/{table}")
def export_csv(table: str):
    allowed = {
        "monthly_revenue", "market_performance", "product_performance",
        "customer_segments", "late_delivery_risk", "shipping_efficiency",
    }
    if table not in allowed:
        raise HTTPException(status_code=400, detail="Unknown table")
    records = _load(f"gold_{table}")
    if not records:
        raise HTTPException(status_code=404, detail="No data")
    headers_row = ",".join(records[0].keys())
    rows = [headers_row] + [",".join(str(v) for v in r.values()) for r in records]
    content = "\n".join(rows)
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={table}.csv"},
    )


# ── Metadata ──────────────────────────────────────────────────────────────────
@app.get("/api/meta")
def get_meta():
    json_path = DATA_DIR / "gold_monthly_revenue.json"
    last_refresh = (
        datetime.fromtimestamp(json_path.stat().st_mtime, tz=timezone.utc)
        .strftime("%Y-%m-%d %H:%M UTC")
        if json_path.exists() else "unknown"
    )
    return {
        "last_refresh":   last_refresh,
        "source":         "DataCo Supply Chain Dataset (Kaggle)",
        "record_count":   178027,
        "date_range":     "Jan 2015 - Sep 2017",
        "classification": "Internal Only",
        "owner":          "Data Engineering Team",
        "contact":        "arpit0112ak@gmail.com",
        "pipeline":       "Python · Pandas · FastAPI · PostgreSQL · Airflow · Docker",
        "architecture":   "Medallion (Bronze -> Silver -> Gold)",
    }


# ── Benchmarks ────────────────────────────────────────────────────────────────
@app.get("/api/benchmarks")
def get_benchmarks():
    return {
        "target_late_pct":        30.0,
        "target_profit_margin":   15.0,
        "target_aov":             500.0,
        "target_repeat_rate":     60.0,
    }


# ── Anomalies ─────────────────────────────────────────────────────────────────
@app.get("/api/anomalies")
def get_anomalies():
    data = [r for r in _load("gold_monthly_revenue") if r.get("mom_revenue_growth_pct") is not None]
    values = [r["mom_revenue_growth_pct"] for r in data]
    if not values:
        return []
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std = variance ** 0.5
    threshold = 1.8 * std
    anomalies = [
        {
            "period": f"{r['order_month_name']} {int(r['order_year'])}",
            "order_year":   r["order_year"],
            "order_month":  r["order_month"],
            "total_revenue": r["total_revenue"],
            "mom_revenue_growth_pct": r["mom_revenue_growth_pct"],
        }
        for r in data
        if abs(r["mom_revenue_growth_pct"] - mean) > threshold
    ]
    return _clean(sorted(anomalies, key=lambda r: (r["order_year"], r["order_month"])))


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    tables = [p.stem for p in DATA_DIR.glob("*.json")]
    return {"status": "ok", "tables_available": len(tables), "tables": tables}
