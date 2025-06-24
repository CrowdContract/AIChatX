"""
run_pipeline.py — master entry point for the Supply Chain ETL pipeline.

Medallion Architecture
----------------------
  Bronze  →  Silver  →  Gold
  Raw as-is  Cleaned    Business aggregates + Star Schema

Steps
-----
1. Extract        → read raw CSV
2. Validate       → quality checks + report
3. Bronze         → raw data + metadata, append-only
4. Silver         → clean, deduplicate, type, normalise
5. Gold           → KPI aggregates + star schema tables
6. Load (optional)→ PostgreSQL

Usage
-----
    python run_pipeline.py            # full pipeline
    python run_pipeline.py --no-db    # skip PostgreSQL load step
"""

import os
import sys
import logging
import argparse
import pandas as pd

# ── Root logging setup ────────────────────────────────────────────────────────
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, "pipeline.log"), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# ── Import pipeline modules ───────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from extract.extract_supply_chain import extract_supply_chain
from validation.validate_supply_chain import validate
from medallion.bronze_layer import ingest_bronze
from medallion.silver_layer import refine_silver
from medallion.gold_layer import build_gold
# Legacy transform modules (still used for backwards-compat CSV outputs)
from transform.clean_orders import clean
from transform.feature_engineering import engineer_features
from transform.star_schema import build_star_schema


def run(skip_db: bool = False) -> None:
    logger.info("=" * 60)
    logger.info("  Supply Chain ETL Pipeline — Started")
    logger.info("  Architecture: Medallion (Bronze → Silver → Gold)")
    logger.info("=" * 60)

    # ── Step 1: Extract ───────────────────────────────────────────────────────
    logger.info("[1/7] EXTRACT")
    raw_df = extract_supply_chain()

    # ── Step 2: Validate ──────────────────────────────────────────────────────
    logger.info("[2/7] VALIDATE")
    result = validate(raw_df)
    logger.info("Validation issues found: %d", result["total_issues"])

    # ── Step 3: Bronze ────────────────────────────────────────────────────────
    logger.info("[3/7] BRONZE — raw ingestion with metadata")
    bronze_df = ingest_bronze(raw_df)

    # ── Step 4: Silver ────────────────────────────────────────────────────────
    logger.info("[4/7] SILVER — clean, type-enforce, deduplicate")
    silver_df = refine_silver(bronze_df)

    # ── Step 5: Gold ──────────────────────────────────────────────────────────
    logger.info("[5/7] GOLD — KPI aggregates + star schema")
    gold_tables = build_gold(silver_df)
    for name, tbl in gold_tables.items():
        logger.info("  %-35s %d rows", name, len(tbl))

    # ── Step 6: Also write legacy star CSVs (for dashboard) ───────────────────
    logger.info("[6/7] LEGACY STAR CSV — writing data/transformed/star/")
    try:
        cleaned_df  = clean(raw_df)
        features_df = engineer_features(cleaned_df)
        build_star_schema(features_df)
        logger.info("Legacy star schema CSVs refreshed.")
    except Exception as exc:
        logger.warning("Legacy star schema step skipped: %s", exc)

    # ── Step 7: Load into PostgreSQL ──────────────────────────────────────────
    if skip_db:
        logger.info("[7/7] LOAD — skipped (--no-db flag set)")
    else:
        logger.info("[7/7] LOAD → PostgreSQL")
        try:
            from load.postgres_loader import load_all
            load_all()
            logger.info("Loaded into PostgreSQL successfully.")
        except Exception as exc:
            logger.warning("PostgreSQL load skipped: %s", exc)
            logger.info("Dashboard will still work from CSV/Parquet files.")

    logger.info("=" * 60)
    logger.info("  Pipeline Finished Successfully ✓")
    logger.info("  Layers: Bronze=%s | Silver=%s | Gold=%s",
                "data/bronze/", "data/silver/", "data/gold/")
    logger.info("  Run dashboard: streamlit run dashboard/app.py")
    logger.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Supply Chain ETL Pipeline")
    parser.add_argument("--no-db", action="store_true", help="Skip PostgreSQL load step")
    args = parser.parse_args()
    run(skip_db=args.no_db)
