# Supply Chain Analytics Pipeline

End-to-end data engineering project processing 180k supply chain order records through a Medallion architecture, loading into PostgreSQL, orchestrating via Apache Airflow, serving via FastAPI, and visualising through a React dashboard with neumorphism design.

Built to demonstrate data engineering skills aligned with production-grade pipelines: scalable ingestion, data quality validation, star schema design, REST API development, and containerised deployment.

---

## Live Demo

Dashboard: deployed on Vercel  
API Docs: `/api/docs` (FastAPI Swagger UI)

---

## Business Objective

Determine where supply chain inefficiencies are costing the most — in delivery delays, margin erosion, or customer churn — using the DataCo Global Supply Chain dataset (2015-2017, 5 global markets, 18k customers, 110 products).

**Key findings:**
- Total revenue: $35.8M across 63,976 orders at a 10.8% profit margin
- Late delivery rate is 57.3%, significantly above the 30% industry benchmark
- Standard Class shipping is the primary contributor to delivery delays
- Consumer segment drives the majority of CLV; Corporate segment shows growth headroom

---

## Architecture

```
Raw CSV
   |
[Extract]  ---> [Validate]
   |
[Bronze]   data/bronze/   - raw + metadata, append-only, Parquet
   |
[Silver]   data/silver/   - cleaned, typed, deduplicated, Parquet
   |
[Gold]     data/gold/     - KPI aggregates + star schema, Parquet
   |
[PostgreSQL]              - star schema tables with indexes
   |
[FastAPI]  /api/*         - REST endpoints from Gold layer
   |
[React Dashboard]         - neumorphism UI, Framer Motion, Recharts
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Ingestion | Python 3.12, Pandas 2.2, NumPy |
| Validation | Custom rules, validation_report.csv |
| Storage | PostgreSQL 16, Parquet (PyArrow) |
| API | FastAPI, Uvicorn, SQLAlchemy |
| Orchestration | Apache Airflow 2.9 (daily @ 08:00 UTC) |
| Frontend | React 18, Vite 5, Framer Motion, Recharts |
| Infrastructure | Docker, Docker Compose, Nginx |
| Deployment | Vercel (frontend + API) |

---

## Project Structure

```
sales-etl-pipeline/
├── extract/                  # CSV ingestion layer
│   └── extract_supply_chain.py
├── validation/               # Data quality checks
│   └── validate_supply_chain.py
├── medallion/                # Medallion architecture layers
│   ├── bronze_layer.py       # Raw + metadata
│   ├── silver_layer.py       # Cleaned + typed
│   └── gold_layer.py         # KPI aggregates + star schema
├── transform/                # Legacy: clean, feature engineering, star schema
├── load/                     # PostgreSQL loader (SQLAlchemy)
├── api/                      # FastAPI backend (11 endpoints)
│   └── main.py
├── frontend/                 # React dashboard
│   └── src/
│       ├── pages/            # Overview, Revenue, Products, Customers, Delivery, Workflow, About
│       ├── components/       # KpiCard, ChartCard, Skeleton, ExportButton, Sidebar
│       └── hooks/            # useApi data fetching hook
├── airflow/dags/             # Airflow DAG definition
├── sql/                      # PostgreSQL schema DDL and analytics queries
├── data/gold/                # Pre-computed Gold Parquet files (committed)
├── docker/                   # Dockerfiles (ETL, API, dashboard)
├── tests/                    # Pytest unit tests (20 cases)
├── docker-compose.yml
├── run_pipeline.py           # Master pipeline entry point
├── vercel.json               # Vercel deployment config
└── requirements.txt
```

---

## Medallion Architecture

**Bronze** — Raw data stored exactly as received. Adds `_ingestion_ts`, `_source_file`, `_row_hash`, `_row_number` metadata columns. Append-only for full audit history.

**Silver** — Trusted, queryable data. Drops PII columns, enforces dtypes, parses dates, deduplicates on Order Item Id, removes IQR outliers on Sales. Zero nulls in output (178,027 rows).

**Gold** — Business-ready aggregates. Six KPI tables (monthly revenue, market performance, product performance, customer segments, late delivery risk, shipping efficiency) plus a complete star schema (fact_sales + 5 dimensions). These power the dashboard and API directly.

---

## Star Schema

```
fact_sales
  |-- dim_customer   (customer_id)
  |-- dim_product    (product_card_id)
  |-- dim_date       (date_id)
  |-- dim_location   (location_id)
  |-- dim_shipping   (shipping_id)
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/kpis | 7 business KPIs |
| GET | /api/revenue/monthly | Monthly revenue with optional year filter |
| GET | /api/revenue/years | Available years |
| GET | /api/market/by-region | Revenue aggregated by market |
| GET | /api/market | Market performance detail |
| GET | /api/products/top | Top N products by revenue |
| GET | /api/products/categories | Revenue by category |
| GET | /api/customers/segments | CLV, AOV, retention by segment |
| GET | /api/customers/top | Top N customers by CLV |
| GET | /api/delivery/risk | Late delivery % by shipping mode |
| GET | /api/delivery/shipping-efficiency | Actual vs scheduled days |
| GET | /api/anomalies | Statistical revenue outlier months |
| GET | /api/benchmarks | Industry benchmark targets |
| GET | /api/meta | Pipeline metadata, refresh timestamp |
| GET | /api/export/{table} | CSV download for any Gold table |
| GET | /api/health | Service health check |

Full documentation available at `/api/docs`.

---

## Running Locally

**Requirements:** Python 3.12+, Node 18+

```bash
# 1. Clone
git clone https://github.com/CrowdContract/SupplyChain_Analytics
cd SupplyChain_Analytics

# 2. Python environment
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# 3. Run ETL pipeline (generates Gold layer data)
python run_pipeline.py --no-db

# 4. Start FastAPI
python -m uvicorn api.main:app --port 8000 --reload

# 5. Start React dashboard (separate terminal)
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### With PostgreSQL

Copy `.env.example` to `.env`, fill in credentials, then run without `--no-db`:

```bash
python run_pipeline.py
```

### With Docker

```bash
docker compose up
# Dashboard: http://localhost:5173
# API:       http://localhost:8000/api/docs
# Airflow:   http://localhost:8080  (admin/admin)
```

---

## Running Tests

```bash
pytest tests/ -v
# 20 tests covering extract, validate, clean, feature engineering, star schema
```

---

## Dashboard Pages

| Page | Description |
|---|---|
| Overview | KPIs, narrative, monthly trend, market breakdown, anomaly callouts |
| Revenue | Year filter, MoM growth chart and table, profit analysis |
| Products | Top products and categories, margin and discount breakdown |
| Customers | CLV by segment, radar chart, top customer table |
| Delivery | Late delivery rate bars, shipping efficiency, status breakdown |
| Pipeline Workflow | Interactive ETL diagram, Airflow DAG, tech stack, Docker services |
| About & Docs | Data dictionary, benchmarks, FAQ, contact |

---

## Deployment (Vercel)

The project is configured for Vercel deployment via `vercel.json`. The React frontend is built as a static site; the FastAPI backend runs as Python serverless functions. Gold layer Parquet files are committed to the repository and read directly by the API.

```bash
npm i -g vercel
vercel --prod
```

---

## Dataset

DataCo Global Supply Chain Dataset  
Source: Kaggle  
Records: 180,519 rows across 53 columns  
Period: January 2015 - September 2017  
Markets: USCA, Europe, LATAM, Pacific Asia, Africa

---

## Resume Bullets

- Built a cloud-native ETL pipeline using Python, Pandas, FastAPI, PostgreSQL, Apache Airflow, and Docker to process 180k supply chain records through a Medallion architecture (Bronze, Silver, Gold layers).
- Designed a star schema data warehouse with one fact table and five dimension tables; implemented automated data validation, cleaning, feature engineering, and bulk PostgreSQL loading via SQLAlchemy.
- Developed a FastAPI REST backend serving pre-computed Gold layer Parquet files across 16 endpoints with CSV export, anomaly detection, and benchmark comparison; built a React dashboard with neumorphism design and Framer Motion animations deployed on Vercel.
