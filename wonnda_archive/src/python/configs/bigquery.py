import logging
from os import environ

from pnd_utils.configuration.config_exceptions import InvalidConfigException
from pnd_utils.configuration.configuration import Configuration, ConfigurationCollection
from pnd_utils.logging import get_logger


class BigQueryConfiguration(Configuration):  # type: ignore
    class Defaults:
        logger = get_logger("config.bigquery", level=logging.INFO)

    def __init__(
        self,
        service_account_file_path: str,
        project: str,
        location: str,
        scopes: list[str] = None,
        logger: logging.Logger = Defaults.logger,
    ) -> None:
        super().__init__()

        self.service_account_file_path = service_account_file_path
        self.logger = logger
        self.project = project
        self.location = location
        self.scopes = scopes

    def validate(self) -> None:
        if not self.service_account_file_path:
            raise InvalidConfigException("Please specify $SERVICE_ACCOUNT_PATH")


class BigQueryConfigurationCollection(
    ConfigurationCollection[BigQueryConfiguration]  # type: ignore
):
    def get_all_configs(self) -> dict[str, BigQueryConfiguration]:
        return super().get_all_configs()

    def get_config(self, config_name: str) -> BigQueryConfiguration:
        return super().get_config(config_name)


bq_configs = BigQueryConfigurationCollection()

bq_configs.add(
    bigquery=BigQueryConfiguration(
        service_account_file_path=environ.get("SERVICE_ACCOUNT_PATH", ""),
        project="supplier-scraping",
        location="EU",
        scopes=[
            "https://www.googleapis.com/auth/bigquery",
            "https://www.googleapis.com/auth/drive",
        ],
    ),
)
