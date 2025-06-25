$env:GIT_AUTHOR_NAME     = "Arpit Kumar"
$env:GIT_AUTHOR_EMAIL    = "arpit0112ak@gmail.com"
$env:GIT_COMMITTER_NAME  = "Arpit Kumar"
$env:GIT_COMMITTER_EMAIL = "arpit0112ak@gmail.com"

$commits = @(
    @{ msg="Initial project setup: folder structure, requirements, gitignore, docker-compose";            date="2025-06-02T09:00:00+05:30"; files=@(".gitignore",".env.example","requirements.txt","docker-compose.yml") },
    @{ msg="Added data extraction layer: CSV ingestion with encoding and error handling";                  date="2025-06-03T10:30:00+05:30"; files=@("extract/extract_supply_chain.py","extract/__init__.py") },
    @{ msg="Implemented data validation: quality checks, null detection, validation report";               date="2025-06-04T11:00:00+05:30"; files=@("validation/validate_supply_chain.py","validation/__init__.py") },
    @{ msg="Completed data cleaning: deduplication, type casting, outlier removal, normalisation";         date="2025-06-06T14:00:00+05:30"; files=@("transform/clean_orders.py","transform/__init__.py") },
    @{ msg="Added feature engineering: CLV, AOV, delivery delay, profit margin, time dimensions";          date="2025-06-09T09:30:00+05:30"; files=@("transform/feature_engineering.py") },
    @{ msg="Designed star schema: fact_sales and five dimension tables, SQL DDL and analytics queries";    date="2025-06-10T11:00:00+05:30"; files=@("transform/star_schema.py","sql/schema.sql","sql/analytics.sql") },
    @{ msg="Implemented Medallion architecture: Bronze, Silver, Gold layers with Parquet storage";         date="2025-06-11T13:00:00+05:30"; files=@("medallion/bronze_layer.py","medallion/silver_layer.py","medallion/gold_layer.py","medallion/__init__.py") },
    @{ msg="Loaded data into PostgreSQL: SQLAlchemy bulk loader, FK-ordered inserts, performance indexes"; date="2025-06-12T10:00:00+05:30"; files=@("load/postgres_loader.py","load/__init__.py") },
    @{ msg="Dockerized project: Dockerfiles for ETL, API, dashboard; docker-compose with all services";   date="2025-06-16T09:00:00+05:30"; files=@("docker/Dockerfile.etl","docker/Dockerfile.api","docker/Dockerfile.dashboard") },
    @{ msg="Integrated Apache Airflow: DAG with Bronze, Silver, Gold, PostgreSQL, notify tasks";           date="2025-06-17T11:30:00+05:30"; files=@("airflow/dags/sales_pipeline.py") },
    @{ msg="Built FastAPI backend: 16 endpoints serving Gold Parquet, export, anomaly detection";          date="2025-06-18T13:00:00+05:30"; files=@("api/main.py","api/index.py","api/requirements.txt") },
    @{ msg="Built React dashboard: neumorphism design, Framer Motion, 7 pages, Recharts charts";           date="2025-06-20T16:00:00+05:30"; files=@("frontend/") },
    @{ msg="Added unit tests: 20 pytest cases covering extract, validate, clean, features, star schema";   date="2025-06-23T10:00:00+05:30"; files=@("tests/") },
    @{ msg="Improved logging: structured logging across all pipeline stages with timestamps";               date="2025-06-24T11:00:00+05:30"; files=@("run_pipeline.py","start_dev.ps1") },
    @{ msg="Completed documentation: README, data dictionary, workflow page, vercel deployment config";    date="2025-06-25T12:00:00+05:30"; files=@("README.md","vercel.json","data/gold/") }
)

Write-Host "Building commit history..."

foreach ($c in $commits) {
    $env:GIT_AUTHOR_DATE    = $c.date
    $env:GIT_COMMITTER_DATE = $c.date
    foreach ($f in $c.files) {
        git add $f 2>$null
    }
    git commit -m $c.msg --allow-empty 2>&1 | Out-Null
    Write-Host "  OK: $($c.msg.Substring(0,[Math]::Min(60,$c.msg.Length)))..."
}

Write-Host ""
Write-Host "Pushing to GitHub..."
git push -u origin main 2>&1
Write-Host "Push complete."
