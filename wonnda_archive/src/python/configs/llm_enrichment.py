import logging
from os import path
from pathlib import Path

from pnd_utils.configuration.config_exceptions import InvalidConfigException
from pnd_utils.configuration.configuration import Configuration, ConfigurationCollection
from pnd_utils.logging import get_logger


class LLMEnrichmentConfiguration(Configuration):  # type: ignore
    class Defaults:
        unprocessed_dataset = "ol"
        processed_dataset = "el"
        query_templates_path = path.join(
            Path(__file__).parents[2], "sql", "bigquery_templates"
        )
        logger = get_logger("config.llm_enrichment", level=logging.INFO)

    def __init__(
        self,
        id_column: str,
        unprocessed_table: str,
        processed_table: str,
        unprocessed_dataset: str = Defaults.unprocessed_dataset,
        processed_dataset: str = Defaults.processed_dataset,
        query_templates_path: str = Defaults.query_templates_path,
        logger: logging.Logger = Defaults.logger,
    ):
        super().__init__()
        self.id_column = id_column
        self.unprocessed_table = unprocessed_table
        self.processed_table = processed_table
        self.unprocessed_dataset = unprocessed_dataset
        self.processed_dataset = processed_dataset
        self.query_templates_path = query_templates_path
        self.logger = logger

    def validate(self) -> None:
        if not (self.unprocessed_table and self.processed_table):
            raise InvalidConfigException("Please set table names.")


class LLMEnrichmentConfigurationCollection(
    ConfigurationCollection[LLMEnrichmentConfiguration]  # type: ignore
):
    def get_config(self, config_name: str) -> LLMEnrichmentConfiguration:
        return super().get_config(config_name)

    def get_all_configs(self) -> dict[str, LLMEnrichmentConfiguration]:
        return super().get_all_configs()


llm_enrichment_configs = LLMEnrichmentConfigurationCollection()
llm_enrichment_configs.add(
    companies=LLMEnrichmentConfiguration(
        id_column="company_id",
        unprocessed_table="companies",
        processed_table="companies",
    ),
)
