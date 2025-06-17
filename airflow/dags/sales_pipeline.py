"""
Apache Airflow DAG — Supply Chain ETL Pipeline
Schedule: daily at 08:00 UTC
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.email import EmailOperator
from airflow.utils.trigger_rule import TriggerRule
import sys, os

# Make project root importable inside Airflow workers
sys.path.insert(0, "/opt/airflow/project")

default_args = {
    "owner": "data_engineer",
    "depends_on_past": False,
    "start_date": datetime(2024, 1, 1),
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

dag = DAG(
    dag_id="supply_chain_etl_pipeline",
    default_args=default_args,
    description="End-to-end supply chain ETL: extract → validate → clean → transform → load",
    schedule_interval="0 8 * * *",   # every day at 08:00 UTC
    catchup=False,
    tags=["supply_chain", "etl", "production"],
)


# ── Task functions ─────────────────────────────────────────────────────────────

def task_extract(**context):
    from extract.extract_supply_chain import extract_supply_chain
    df = extract_supply_chain()
    context["ti"].xcom_push(key="row_count", value=len(df))


def task_validate(**context):
    from extract.extract_supply_chain import extract_supply_chain
    from validation.validate_supply_chain import validate
    df = extract_supply_chain()
    result = validate(df)
    context["ti"].xcom_push(key="validation_issues", value=result["total_issues"])


def task_bronze(**context):
    from extract.extract_supply_chain import extract_supply_chain
    from medallion.bronze_layer import ingest_bronze
    raw    = extract_supply_chain()
    bronze = ingest_bronze(raw)
    context["ti"].xcom_push(key="bronze_rows", value=len(bronze))


def task_silver(**context):
    import pandas as pd
    from medallion.silver_layer import refine_silver
    # Read Bronze parquet, fallback to CSV
    base = "/opt/airflow/project/data/bronze"
    try:
        bronze = pd.read_parquet(f"{base}/supply_chain_bronze.parquet")
    except Exception:
        bronze = pd.read_csv(f"{base}/supply_chain_bronze.csv", encoding="latin1")
    silver = refine_silver(bronze)
    context["ti"].xcom_push(key="silver_rows", value=len(silver))


def task_gold(**context):
    import pandas as pd
    from medallion.gold_layer import build_gold
    base = "/opt/airflow/project/data/silver"
    try:
        silver = pd.read_parquet(f"{base}/supply_chain_silver.parquet")
    except Exception:
        silver = pd.read_csv(f"{base}/supply_chain_silver.csv")
    tables = build_gold(silver)
    context["ti"].xcom_push(key="gold_tables", value=list(tables.keys()))


def task_load(**context):
    from load.postgres_loader import load_all
    load_all()


def task_notify_success(**context):
    import logging
    logging.getLogger(__name__).info(
        "Pipeline completed successfully at %s", datetime.utcnow().isoformat()
    )


# ── DAG tasks ──────────────────────────────────────────────────────────────────

t_extract = PythonOperator(task_id="extract",   python_callable=task_extract,   dag=dag)
t_validate = PythonOperator(task_id="validate",  python_callable=task_validate,  dag=dag)
t_bronze   = PythonOperator(task_id="bronze",    python_callable=task_bronze,    dag=dag)
t_silver   = PythonOperator(task_id="silver",    python_callable=task_silver,    dag=dag)
t_gold     = PythonOperator(task_id="gold",      python_callable=task_gold,      dag=dag)
t_load     = PythonOperator(task_id="load_postgres", python_callable=task_load,  dag=dag)
t_notify   = PythonOperator(
    task_id="notify_success", python_callable=task_notify_success,
    trigger_rule=TriggerRule.ALL_SUCCESS, dag=dag,
)

# ── DAG dependency chain ───────────────────────────────────────────────────────
#   Extract → Validate → Bronze → Silver → Gold → Load → Notify
t_extract >> t_validate >> t_bronze >> t_silver >> t_gold >> t_load >> t_notify
