from os import path
from pathlib import Path

from configs.bigquery import bq_configs
from pnd_database.bigquery.bigquery import BigQuery

SQL_DIR = path.join(Path(__file__).resolve().parents[2], "sql")


def run_query(query_path: str) -> None:
    """
    Executes a BigQuery SQL query from a specified file path.

    :param query_path: Path to the SQL query file.
    """
    bq_config = bq_configs.get_config("bigquery")
    bq_client = BigQuery(
        service_account_path=bq_config.service_account_file_path,
        project=bq_config.project,
        location=bq_config.location,
        scopes=bq_config.scopes,
        logger=bq_config.logger,
    )

    bq_config.logger.info(f"Processing query {query_path}")
    bq_client.query(query_path, async_=False)


def process_il_ol_sql_queries() -> None:
    """
    Processes multiple IL & OL SQL queries by executing them sequentially.
    """
    run_query(path.join(SQL_DIR, "il", "il_tradeshow_companies.sql"))
    run_query(path.join(SQL_DIR, "ol", "ol_companies.sql"))
    run_query(path.join(SQL_DIR, "ol", "ol_tradeshow_companies.sql"))

def process_rl_sql_queries() -> None:
    """
    Processes multiple RL SQL queries by executing them sequentially.
    """
    run_query(path.join(SQL_DIR, "rl", "rl_offerings.sql"))
    run_query(path.join(SQL_DIR, "rl", "rl_core.sql"))



if __name__ == "__main__":
    process_il_ol_sql_queries()
    process_rl_sql_queries()

