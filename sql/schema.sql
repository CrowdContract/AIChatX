-- =============================================================================
-- Sales ETL Pipeline — Star Schema DDL
-- Database: sales_db
-- =============================================================================

-- Run as: psql -U postgres -d sales_db -f schema.sql

CREATE TABLE IF NOT EXISTS dim_customer (
    customer_id             INTEGER PRIMARY KEY,
    customer_fname          VARCHAR(100),
    customer_lname          VARCHAR(100),
    customer_segment        VARCHAR(50),
    customer_city           VARCHAR(100),
    customer_state          VARCHAR(100),
    customer_country        VARCHAR(100),
    customer_zipcode        VARCHAR(20),
    customer_lifetime_value NUMERIC(12,2),
    avg_order_value         NUMERIC(12,2),
    order_count             INTEGER,
    is_repeat_customer      BOOLEAN
);

CREATE TABLE IF NOT EXISTS dim_product (
    product_card_id    INTEGER PRIMARY KEY,
    product_name       VARCHAR(200),
    product_price      NUMERIC(10,2),
    category_id        INTEGER,
    category_name      VARCHAR(100),
    department_id      INTEGER,
    department_name    VARCHAR(100),
    product_status     INTEGER
);

CREATE TABLE IF NOT EXISTS dim_date (
    date_id      INTEGER PRIMARY KEY,
    full_date    DATE,
    year         INTEGER,
    quarter      INTEGER,
    month        INTEGER,
    month_name   VARCHAR(20),
    day          INTEGER,
    day_of_week  VARCHAR(20),
    week_of_year INTEGER
);

CREATE TABLE IF NOT EXISTS dim_location (
    location_id  INTEGER PRIMARY KEY,
    order_city   VARCHAR(100),
    order_state  VARCHAR(100),
    order_country VARCHAR(100),
    order_region VARCHAR(100),
    market       VARCHAR(50),
    latitude     NUMERIC(10,6),
    longitude    NUMERIC(10,6)
);

CREATE TABLE IF NOT EXISTS dim_shipping (
    shipping_id      INTEGER PRIMARY KEY,
    shipping_mode    VARCHAR(50),
    delivery_status  VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS fact_sales (
    order_item_id            INTEGER PRIMARY KEY,
    order_id                 INTEGER,
    customer_id              INTEGER REFERENCES dim_customer(customer_id),
    product_card_id          INTEGER REFERENCES dim_product(product_card_id),
    date_id                  INTEGER REFERENCES dim_date(date_id),
    location_id              INTEGER REFERENCES dim_location(location_id),
    shipping_id              INTEGER REFERENCES dim_shipping(shipping_id),
    order_item_quantity      INTEGER,
    sales                    NUMERIC(12,2),
    order_item_discount      NUMERIC(10,2),
    order_profit_per_order   NUMERIC(12,2),
    benefit_per_order        NUMERIC(12,2),
    order_item_product_price NUMERIC(10,2),
    order_item_total         NUMERIC(12,2),
    delivery_days_actual     INTEGER,
    delivery_delay_days      INTEGER,
    is_late                  BOOLEAN,
    profit_margin_pct        NUMERIC(8,2),
    discount_pct             NUMERIC(8,2),
    revenue_per_item         NUMERIC(10,2),
    order_status             VARCHAR(50),
    type                     VARCHAR(50)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_fact_customer ON fact_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_fact_product  ON fact_sales(product_card_id);
CREATE INDEX IF NOT EXISTS idx_fact_date     ON fact_sales(date_id);
CREATE INDEX IF NOT EXISTS idx_fact_location ON fact_sales(location_id);
CREATE INDEX IF NOT EXISTS idx_fact_late     ON fact_sales(is_late);
CREATE INDEX IF NOT EXISTS idx_fact_year_month ON fact_sales(order_id);
