"""
Extract Layer — reads the raw DataCo Supply Chain CSV into a Pandas DataFrame.
Handles missing files, encoding issues, and logs every step.
"""

import os
import logging
import pandas as pd

# ── logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "..", "logs", "pipeline.log"),
            encoding="utf-8",
        ),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

RAW_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "raw", "DataCoSupplyChainDataset.csv"
)


def extract_supply_chain(filepath: str = RAW_PATH) -> pd.DataFrame:
    """
    Read the supply chain CSV and return a raw DataFrame.

    Parameters
    ----------
    filepath : str
        Absolute or relative path to the CSV file.

    Returns
    -------
    pd.DataFrame
        Raw supply chain data.

    Raises
    ------
    FileNotFoundError
        If the CSV cannot be found at *filepath*.
    """
    logger.info("Extraction started.")
    logger.info("Looking for dataset at: %s", filepath)

    if not os.path.exists(filepath):
        logger.error("File not found: %s", filepath)
        raise FileNotFoundError(f"Dataset not found at {filepath}")

    try:
        df = pd.read_csv(filepath, encoding="latin1", low_memory=False)
    except UnicodeDecodeError as exc:
        logger.warning("latin1 encoding failed (%s), retrying with utf-8-sig.", exc)
        df = pd.read_csv(filepath, encoding="utf-8-sig", low_memory=False)

    logger.info("Raw data loaded — %d rows × %d columns.", *df.shape)
    return df


if __name__ == "__main__":
    df = extract_supply_chain()
    print(df.head())
