"""
Supply Chain Analytics Dashboard
Built with Streamlit + Plotly
Reads from data/transformed/star/ CSVs (no live DB needed for Streamlit Cloud)
"""

import os
import sys
import pandas as pd
import numpy as np
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Supply Chain Analytics",
    page_icon="🚚",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
STAR_DIR  = os.path.join(BASE_DIR, "..", "data", "transformed", "star")

# ── Data loader (cached) ──────────────────────────────────────────────────────
@st.cache_data(show_spinner="Loading data…")
def load_data():
    fact      = pd.read_csv(os.path.join(STAR_DIR, "fact_sales.csv"))
    dim_cust  = pd.read_csv(os.path.join(STAR_DIR, "dim_customer.csv"))
    dim_prod  = pd.read_csv(os.path.join(STAR_DIR, "dim_product.csv"))
    dim_date  = pd.read_csv(os.path.join(STAR_DIR, "dim_date.csv"), parse_dates=["full_date"])
    dim_loc   = pd.read_csv(os.path.join(STAR_DIR, "dim_location.csv"))
    dim_ship  = pd.read_csv(os.path.join(STAR_DIR, "dim_shipping.csv"))

    # join everything into one analysis frame
    df = (
        fact
        .merge(dim_date,  on="date_id",       how="left")
        .merge(dim_cust,  on="customer_id",    how="left", suffixes=("", "_cust"))
        .merge(dim_prod,  on="product_card_id",how="left", suffixes=("", "_prod"))
        .merge(dim_loc,   on="location_id",    how="left", suffixes=("", "_loc"))
        .merge(dim_ship,  on="shipping_id",    how="left", suffixes=("", "_ship"))
    )
    return df, dim_cust, dim_prod, dim_date, dim_loc, dim_ship


try:
    df, dim_cust, dim_prod, dim_date, dim_loc, dim_ship = load_data()
except FileNotFoundError:
    st.error(
        "⚠️ Star schema CSVs not found. "
        "Run the pipeline first:\n\n`python run_pipeline.py`"
    )
    st.stop()

# ── Sidebar filters ───────────────────────────────────────────────────────────
st.sidebar.image("https://img.icons8.com/fluency/96/supply-chain.png", width=80)
st.sidebar.title("🔍 Filters")

years = sorted(df["year"].dropna().unique().astype(int))
sel_years = st.sidebar.multiselect("Year", years, default=years)

markets = sorted(df["market"].dropna().unique())
sel_markets = st.sidebar.multiselect("Market", markets, default=markets)

segments = sorted(df["customer_segment"].dropna().unique())
sel_segments = st.sidebar.multiselect("Customer Segment", segments, default=segments)

shipping_modes = sorted(df["shipping_mode"].dropna().unique())
sel_shipping = st.sidebar.multiselect("Shipping Mode", shipping_modes, default=shipping_modes)

# Apply filters
mask = (
    df["year"].isin(sel_years) &
    df["market"].isin(sel_markets) &
    df["customer_segment"].isin(sel_segments) &
    df["shipping_mode"].isin(sel_shipping)
)
dff = df[mask].copy()

st.sidebar.markdown("---")
st.sidebar.markdown(f"**Filtered rows:** {len(dff):,}")

# ── Helper colours ────────────────────────────────────────────────────────────
PALETTE = px.colors.qualitative.Bold

# =============================================================================
# HEADER
# =============================================================================
st.title("🚚 Supply Chain Performance Dashboard")
st.caption("DataCo Global Supply Chain Dataset · 2015 – 2017 · Built with Python + Streamlit")
st.markdown("---")

# =============================================================================
# ROW 1 — KPI Cards
# =============================================================================
total_revenue  = dff["sales"].sum()
total_orders   = dff["order_id"].nunique()
aov            = total_revenue / total_orders if total_orders else 0
total_profit   = dff["order_profit_per_order"].sum()
late_pct       = dff["is_late"].mean() * 100 if len(dff) else 0
total_customers = dff["customer_id"].nunique()

k1, k2, k3, k4, k5, k6 = st.columns(6)
k1.metric("💰 Total Revenue",      f"${total_revenue:,.0f}")
k2.metric("📦 Total Orders",        f"{total_orders:,}")
k3.metric("🧾 Avg Order Value",     f"${aov:,.2f}")
k4.metric("📈 Total Profit",        f"${total_profit:,.0f}")
k5.metric("⏰ Late Delivery %",     f"{late_pct:.1f}%")
k6.metric("👥 Unique Customers",    f"{total_customers:,}")

st.markdown("---")

# =============================================================================
# ROW 2 — Monthly Revenue + Profit trend
# =============================================================================
st.subheader("📅 Monthly Revenue & Profit Trend")

monthly = (
    dff.groupby(["year", "month", "month_name"])
    .agg(revenue=("sales", "sum"), profit=("order_profit_per_order", "sum"), orders=("order_id", "nunique"))
    .reset_index()
    .sort_values(["year", "month"])
)
monthly["period"] = monthly["month_name"].astype(str) + " " + monthly["year"].astype(str)
monthly["mom_growth"] = monthly["revenue"].pct_change() * 100

fig_trend = make_subplots(specs=[[{"secondary_y": True}]])
fig_trend.add_trace(
    go.Bar(x=monthly["period"], y=monthly["revenue"], name="Revenue", marker_color="#4361ee"),
    secondary_y=False,
)
fig_trend.add_trace(
    go.Scatter(x=monthly["period"], y=monthly["profit"], name="Profit", line=dict(color="#f72585", width=2)),
    secondary_y=True,
)
fig_trend.update_layout(
    height=380, hovermode="x unified", legend=dict(orientation="h"),
    xaxis=dict(tickangle=-45),
)
fig_trend.update_yaxes(title_text="Revenue ($)", secondary_y=False)
fig_trend.update_yaxes(title_text="Profit ($)", secondary_y=True)
st.plotly_chart(fig_trend, use_container_width=True)

# =============================================================================
# ROW 3 — Revenue by Market | Late Delivery by Shipping Mode
# =============================================================================
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("🌍 Revenue by Market")
    mkt = (
        dff.groupby("market")
        .agg(revenue=("sales","sum"), orders=("order_id","nunique"))
        .reset_index()
        .sort_values("revenue", ascending=False)
    )
    fig_mkt = px.bar(
        mkt, x="market", y="revenue", color="market",
        color_discrete_sequence=PALETTE, text_auto=".2s",
        labels={"revenue": "Revenue ($)", "market": "Market"},
    )
    fig_mkt.update_layout(height=360, showlegend=False)
    st.plotly_chart(fig_mkt, use_container_width=True)

with col_right:
    st.subheader("⏰ Late Delivery % by Shipping Mode")
    late_ship = (
        dff.groupby("shipping_mode")
        .agg(
            total=("order_item_id", "count"),
            late=("is_late", "sum"),
        )
        .assign(late_pct=lambda x: (x["late"] / x["total"] * 100).round(2))
        .reset_index()
    )
    fig_late = px.bar(
        late_ship, x="shipping_mode", y="late_pct",
        color="late_pct", color_continuous_scale="Reds",
        text_auto=".1f",
        labels={"late_pct": "Late %", "shipping_mode": "Shipping Mode"},
    )
    fig_late.update_layout(height=360, coloraxis_showscale=False)
    st.plotly_chart(fig_late, use_container_width=True)

# =============================================================================
# ROW 4 — Top Products | Revenue by Category
# =============================================================================
col3, col4 = st.columns(2)

with col3:
    st.subheader("🏆 Top 10 Products by Revenue")
    top_prod = (
        dff.groupby(["product_name", "category_name"])
        .agg(revenue=("sales", "sum"), units=("order_item_quantity", "sum"))
        .reset_index()
        .nlargest(10, "revenue")
    )
    fig_prod = px.bar(
        top_prod, x="revenue", y="product_name", orientation="h",
        color="category_name", color_discrete_sequence=PALETTE,
        text_auto=".2s",
        labels={"revenue": "Revenue ($)", "product_name": "Product"},
    )
    fig_prod.update_layout(height=400, yaxis=dict(autorange="reversed"))
    st.plotly_chart(fig_prod, use_container_width=True)

with col4:
    st.subheader("📦 Revenue by Category")
    cat_rev = (
        dff.groupby(["category_name", "department_name"])
        .agg(revenue=("sales", "sum"))
        .reset_index()
        .nlargest(15, "revenue")
    )
    fig_cat = px.treemap(
        cat_rev, path=["department_name", "category_name"],
        values="revenue", color="revenue",
        color_continuous_scale="Blues",
    )
    fig_cat.update_layout(height=400)
    st.plotly_chart(fig_cat, use_container_width=True)

# =============================================================================
# ROW 5 — Delivery Status Breakdown | Customer Segment Revenue
# =============================================================================
col5, col6 = st.columns(2)

with col5:
    st.subheader("🚦 Delivery Status Breakdown")
    del_stat = dff["delivery_status"].value_counts().reset_index()
    del_stat.columns = ["status", "count"]
    fig_del = px.pie(
        del_stat, names="status", values="count",
        color_discrete_sequence=PALETTE, hole=0.4,
    )
    fig_del.update_traces(textposition="inside", textinfo="percent+label")
    fig_del.update_layout(height=360, showlegend=False)
    st.plotly_chart(fig_del, use_container_width=True)

with col6:
    st.subheader("👥 Revenue by Customer Segment")
    seg_rev = (
        dff.groupby("customer_segment")
        .agg(revenue=("sales","sum"), customers=("customer_id","nunique"))
        .reset_index()
    )
    fig_seg = px.bar(
        seg_rev, x="customer_segment", y="revenue",
        color="customer_segment", color_discrete_sequence=PALETTE,
        text_auto=".2s",
        labels={"revenue":"Revenue ($)","customer_segment":"Segment"},
    )
    fig_seg.update_layout(height=360, showlegend=False)
    st.plotly_chart(fig_seg, use_container_width=True)

# =============================================================================
# ROW 6 — Geographic Revenue Map
# =============================================================================
st.subheader("🗺️ Revenue by Country")
geo = (
    dff.groupby(["order_country", "latitude", "longitude"])
    .agg(revenue=("sales", "sum"), orders=("order_id", "nunique"))
    .reset_index()
)
fig_map = px.scatter_geo(
    geo,
    lat="latitude", lon="longitude",
    size="revenue", color="revenue",
    hover_name="order_country",
    hover_data={"revenue": ":,.0f", "orders": True, "latitude": False, "longitude": False},
    color_continuous_scale="Viridis",
    projection="natural earth",
    size_max=40,
)
fig_map.update_layout(height=480, geo=dict(showland=True, landcolor="#e8eaed"))
st.plotly_chart(fig_map, use_container_width=True)

# =============================================================================
# ROW 7 — Profit Margin Distribution | Delay Days Distribution
# =============================================================================
col7, col8 = st.columns(2)

with col7:
    st.subheader("📊 Profit Margin Distribution")
    fig_hist = px.histogram(
        dff[dff["profit_margin_pct"].between(-200, 200)],
        x="profit_margin_pct", nbins=60,
        color_discrete_sequence=["#4361ee"],
        labels={"profit_margin_pct": "Profit Margin (%)"},
    )
    fig_hist.update_layout(height=320)
    st.plotly_chart(fig_hist, use_container_width=True)

with col8:
    st.subheader("📬 Delivery Delay Distribution")
    fig_delay = px.histogram(
        dff[dff["delivery_delay_days"].between(-10, 10)],
        x="delivery_delay_days", nbins=21,
        color="is_late",
        color_discrete_map={True: "#e63946", False: "#2a9d8f"},
        labels={"delivery_delay_days": "Delay Days (actual − scheduled)"},
        barmode="overlay",
    )
    fig_delay.update_layout(height=320, legend_title="Is Late")
    st.plotly_chart(fig_delay, use_container_width=True)

# =============================================================================
# ROW 8 — Top 10 Customers
# =============================================================================
st.subheader("🥇 Top 10 Customers by Lifetime Value")
top_cust = (
    dim_cust.nlargest(10, "customer_lifetime_value")
    [[
        "customer_fname", "customer_lname", "customer_segment",
        "customer_country", "customer_lifetime_value",
        "avg_order_value", "order_count", "is_repeat_customer",
    ]]
    .rename(columns={
        "customer_fname": "First Name",
        "customer_lname": "Last Name",
        "customer_segment": "Segment",
        "customer_country": "Country",
        "customer_lifetime_value": "CLV ($)",
        "avg_order_value": "AOV ($)",
        "order_count": "Orders",
        "is_repeat_customer": "Repeat?",
    })
)
top_cust["CLV ($)"] = top_cust["CLV ($)"].map("${:,.2f}".format)
top_cust["AOV ($)"] = top_cust["AOV ($)"].map("${:,.2f}".format)
st.dataframe(top_cust, use_container_width=True, hide_index=True)

# =============================================================================
# ROW 9 — MoM Growth Table
# =============================================================================
st.subheader("📈 Month-over-Month Revenue Growth")
mom = monthly.copy()
mom["MoM Growth %"] = mom["mom_growth"].map(
    lambda x: f"+{x:.1f}%" if x > 0 else f"{x:.1f}%" if pd.notna(x) else "—"
)
mom = mom[["period", "revenue", "profit", "orders", "MoM Growth %"]].rename(columns={
    "period": "Period", "revenue": "Revenue ($)", "profit": "Profit ($)", "orders": "Orders"
})
mom["Revenue ($)"] = mom["Revenue ($)"].map("${:,.0f}".format)
mom["Profit ($)"]  = mom["Profit ($)"].map("${:,.0f}".format)
st.dataframe(mom, use_container_width=True, hide_index=True)

# =============================================================================
# FOOTER
# =============================================================================
st.markdown("---")
st.caption(
    "Pipeline: Python · Pandas · SQLAlchemy · PostgreSQL · Apache Airflow · Docker  |  "
    "Dashboard: Streamlit · Plotly  |  Data: DataCo Supply Chain Dataset"
)
