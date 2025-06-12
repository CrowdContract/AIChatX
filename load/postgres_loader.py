"""
Load Layer — creates tables in PostgreSQL and bulk-loads star schema tables.

Uses SQLAlchemy + psycopg2.  Connection parameters are read from environment
variables (see .env.example).
"""

import os
import logging
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

load_dotenv()
logger = logging.getLogger(__name__)

STAR_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "transformed", "star")

# Table load order matters for FK integrity
LOAD_ORDER = [
    "dim_customer",
    "dim_product",
    "dim_date",
    "dim_location",
    "dim_shipping",
    "fact_sales",
]


def get_engine():
    """Build and return a SQLAlchemy engine from env vars."""
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db   = os.getenv("POSTGRES_DB", "sales_db")
    user = os.getenv("POSTGRES_USER", "postgres")
    pwd  = os.getenv("POSTGRES_PASSWORD", "password")
    url  = f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}"
    logger.info("Connecting to PostgreSQL at %s:%s/%s", host, port, db)
    return create_engine(url, pool_pre_ping=True)


def load_table(engine, name: str, df: pd.DataFrame, if_exists: str = "replace") -> None:
    """Load a single DataFrame into PostgreSQL."""
    try:
        df.to_sql(name, con=engine, if_exists=if_exists, index=False, chunksize=5000, method="multi")
        logger.info("Loaded %s — %d rows.", name, len(df))
    except SQLAlchemyError as exc:
        logger.error("Failed to load %s: %s", name, exc)
        raise


def load_all(star_dir: str = STAR_DIR) -> None:
    """Read all star-schema CSVs and load them into PostgreSQL."""
    engine = get_engine()

    for table_name in LOAD_ORDER:
        path = os.path.join(star_dir, f"{table_name}.csv")
        if not os.path.exists(path):
            logger.warning("Skipping %s — file not found at %s", table_name, path)
            continue
        df = pd.read_csv(path, low_memory=False)
        load_table(engine, table_name, df)

    # Create indexes for analytics performance
    with engine.connect() as conn:
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_fact_customer ON fact_sales(customer_id);",
            "CREATE INDEX IF NOT EXISTS idx_fact_product  ON fact_sales(product_card_id);",
            "CREATE INDEX IF NOT EXISTS idx_fact_date     ON fact_sales(date_id);",
            "CREATE INDEX IF NOT EXISTS idx_fact_location ON fact_sales(location_id);",
            "CREATE INDEX IF NOT EXISTS idx_fact_late     ON fact_sales(is_late);",
        ]
        for idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
                conn.commit()
                logger.info("Index created: %s", idx_sql.split("idx_")[1].split(" ")[0])
            except SQLAlchemyError as e:
                logger.warning("Index skipped: %s", e)

    logger.info("All tables loaded into PostgreSQL.")


if __name__ == "__main__":
    load_all()
