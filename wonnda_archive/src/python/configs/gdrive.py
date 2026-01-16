import logging
from os import environ

from pnd_utils.configuration.config_exceptions import InvalidConfigException
from pnd_utils.configuration.configuration import Configuration, ConfigurationCollection
from pnd_utils.logging import get_logger


class GDriveConfiguration(Configuration):  # type: ignore
    class Defaults:
        logger = get_logger("config.gdrive", level=logging.INFO)
        dwh_dataset = "dl_gdrive"

    def __init__(
        self,
        service_account_file_path: str,
        unprocessed_folder_id: str,
        processed_folder_id: str,
        dwh_table: str,
        dwh_dataset: str = Defaults.dwh_dataset,
        logger: logging.Logger = Defaults.logger,
    ):
        super().__init__()
        self.service_account_file_path = service_account_file_path
        self.logger = logger
        self.unprocessed_folder_id = unprocessed_folder_id
        self.processed_folder_id = processed_folder_id
        self.dwh_table = dwh_table
        self.dwh_dataset = dwh_dataset

    def validate(self) -> None:
        if not self.service_account_file_path:
            raise InvalidConfigException("Please specify $SERVICE_ACCOUNT_PATH")


class GDriveConfigurationCollection(
    ConfigurationCollection[GDriveConfiguration]  # type: ignore
):
    def get_all_configs(self) -> dict[str, GDriveConfiguration]:
        return super().get_all_configs()


gdrive_configs = GDriveConfigurationCollection()

gdrive_configs.add(
    gdrive=GDriveConfiguration(
        service_account_file_path=environ.get("SERVICE_ACCOUNT_PATH", ""),
        unprocessed_folder_id="12-F7kmg-meOEyAbR3J_j2S9ZxGs9Eb4p",
        processed_folder_id="1_nDF0PdjOVUVoppI7VmNGKVa2G85JEB-",
        dwh_table="tradeshow_companies",
    )
)
