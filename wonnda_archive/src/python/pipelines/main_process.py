import logging

from loaders.gdrive import process_gdrive
from loaders.llm_enrichment import process_enrichment
from loaders.sql_queries import process_il_ol_sql_queries, process_rl_sql_queries
from pnd_utils.logging import get_logger

LOGGER = get_logger("pipeline.main", level=logging.INFO)


def main_process() -> None:
    LOGGER.info("-----Loading GDrive Files-----")
    process_gdrive()

    LOGGER.info("-----Processing IL & OL SQL Queries-----")
    process_il_ol_sql_queries()

    LOGGER.info("-----Processing LLM Enrichment-----")
    process_enrichment()

    LOGGER.info("-----Processing RL SQL Queries-----")
    process_rl_sql_queries()


if __name__ == "__main__":
    main_process()
