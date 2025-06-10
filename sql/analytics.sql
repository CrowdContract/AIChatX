-- =============================================================================
-- Sales ETL Pipeline — Analytics Queries
-- =============================================================================

-- ── 1. Monthly Revenue Trend ─────────────────────────────────────────────────
SELECT
    d.year,
    d.month,
    d.month_name,
    ROUND(SUM(f.sales)::NUMERIC, 2)               AS total_revenue,
    COUNT(DISTINCT f.order_id)                    AS total_orders,
    ROUND(AVG(f.sales)::NUMERIC, 2)               AS avg_order_value
FROM fact_sales f
JOIN dim_date d ON f.date_id = d.date_id
GROUP BY d.year, d.month, d.month_name
ORDER BY d.year, d.month;


-- ── 2. Revenue by Market / Region ────────────────────────────────────────────
SELECT
    l.market,
    l.order_region,
    ROUND(SUM(f.sales)::NUMERIC, 2)  AS revenue,
    COUNT(*)                         AS order_items,
    ROUND(AVG(f.profit_margin_pct)::NUMERIC, 2) AS avg_margin_pct
FROM fact_sales f
JOIN dim_location l ON f.location_id = l.location_id
GROUP BY l.market, l.order_region
ORDER BY revenue DESC;


-- ── 3. Top 10 Products by Revenue ────────────────────────────────────────────
SELECT
    p.product_name,
    p.category_name,
    p.department_name,
    ROUND(SUM(f.sales)::NUMERIC, 2)             AS total_revenue,
    SUM(f.order_item_quantity)                  AS units_sold,
    ROUND(AVG(f.profit_margin_pct)::NUMERIC, 2) AS avg_margin_pct
FROM fact_sales f
JOIN dim_product p ON f.product_card_id = p.product_card_id
GROUP BY p.product_name, p.category_name, p.department_name
ORDER BY total_revenue DESC
LIMIT 10;


-- ── 4. Top 10 Customers by CLV ────────────────────────────────────────────────
SELECT
    c.customer_id,
    c.customer_fname || ' ' || c.customer_lname AS customer_name,
    c.customer_segment,
    c.customer_country,
    ROUND(c.customer_lifetime_value::NUMERIC, 2) AS clv,
    c.order_count,
    ROUND(c.avg_order_value::NUMERIC, 2)         AS avg_order_value
FROM dim_customer c
ORDER BY clv DESC
LIMIT 10;


-- ── 5. Late Delivery Analysis ─────────────────────────────────────────────────
SELECT
    s.shipping_mode,
    s.delivery_status,
    COUNT(*)                                        AS total_shipments,
    SUM(CASE WHEN f.is_late THEN 1 ELSE 0 END)      AS late_shipments,
    ROUND(
        100.0 * SUM(CASE WHEN f.is_late THEN 1 ELSE 0 END) / COUNT(*), 2
    )                                               AS late_pct,
    ROUND(AVG(f.delivery_delay_days)::NUMERIC, 2)   AS avg_delay_days
FROM fact_sales f
JOIN dim_shipping s ON f.shipping_id = s.shipping_id
GROUP BY s.shipping_mode, s.delivery_status
ORDER BY late_pct DESC;


-- ── 6. Revenue by Category (CTE + Ranking) ───────────────────────────────────
WITH category_revenue AS (
    SELECT
        p.category_name,
        p.department_name,
        ROUND(SUM(f.sales)::NUMERIC, 2) AS revenue
    FROM fact_sales f
    JOIN dim_product p ON f.product_card_id = p.product_card_id
    GROUP BY p.category_name, p.department_name
),
ranked AS (
    SELECT
        *,
        RANK() OVER (PARTITION BY department_name ORDER BY revenue DESC) AS rank_in_dept
    FROM category_revenue
)
SELECT * FROM ranked ORDER BY department_name, rank_in_dept;


-- ── 7. Customer Retention / Repeat Purchase Rate ──────────────────────────────
SELECT
    customer_segment,
    COUNT(*)                                            AS total_customers,
    SUM(CASE WHEN is_repeat_customer THEN 1 ELSE 0 END) AS repeat_customers,
    ROUND(
        100.0 * SUM(CASE WHEN is_repeat_customer THEN 1 ELSE 0 END) / COUNT(*), 2
    )                                                   AS repeat_rate_pct
FROM dim_customer
GROUP BY customer_segment
ORDER BY repeat_rate_pct DESC;


-- ── 8. Month-over-Month Revenue Growth (Window Function) ─────────────────────
WITH monthly AS (
    SELECT
        d.year,
        d.month,
        ROUND(SUM(f.sales)::NUMERIC, 2) AS revenue
    FROM fact_sales f
    JOIN dim_date d ON f.date_id = d.date_id
    GROUP BY d.year, d.month
)
SELECT
    year,
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY year, month)  AS prev_month_revenue,
    ROUND(
        100.0 * (revenue - LAG(revenue) OVER (ORDER BY year, month))
               / NULLIF(LAG(revenue) OVER (ORDER BY year, month), 0), 2
    ) AS mom_growth_pct
FROM monthly
ORDER BY year, month;


-- ── 9. Shipping Mode Efficiency ───────────────────────────────────────────────
SELECT
    s.shipping_mode,
    ROUND(AVG(f.delivery_days_actual)::NUMERIC, 2)  AS avg_actual_days,
    ROUND(AVG(f.delivery_delay_days)::NUMERIC, 2)   AS avg_delay,
    ROUND(AVG(f.sales)::NUMERIC, 2)                 AS avg_sale_value,
    COUNT(*)                                        AS shipment_count
FROM fact_sales f
JOIN dim_shipping s ON f.shipping_id = s.shipping_id
GROUP BY s.shipping_mode
ORDER BY avg_actual_days;


-- ── 10. Top Countries by Order Volume ────────────────────────────────────────
SELECT
    l.order_country,
    COUNT(DISTINCT f.order_id)              AS total_orders,
    ROUND(SUM(f.sales)::NUMERIC, 2)         AS total_revenue,
    ROUND(AVG(f.sales)::NUMERIC, 2)         AS avg_order_value,
    ROUND(AVG(f.profit_margin_pct)::NUMERIC,2) AS avg_margin_pct
FROM fact_sales f
JOIN dim_location l ON f.location_id = l.location_id
GROUP BY l.order_country
ORDER BY total_revenue DESC
LIMIT 15;


-- ── VIEW: daily_sales_summary ────────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT
    d.full_date,
    d.year,
    d.month,
    d.month_name,
    COUNT(DISTINCT f.order_id)              AS orders,
    ROUND(SUM(f.sales)::NUMERIC, 2)         AS revenue,
    ROUND(SUM(f.order_profit_per_order)::NUMERIC, 2) AS profit,
    SUM(CASE WHEN f.is_late THEN 1 ELSE 0 END) AS late_deliveries
FROM fact_sales f
JOIN dim_date d ON f.date_id = d.date_id
GROUP BY d.full_date, d.year, d.month, d.month_name;
