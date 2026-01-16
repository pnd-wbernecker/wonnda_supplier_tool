import logging
from os import environ

from pnd_utils.configuration.config_exceptions import InvalidConfigException
from pnd_utils.configuration.configuration import Configuration, ConfigurationCollection
from pnd_utils.logging import get_logger


class PerplexityConfiguration(Configuration):  # type: ignore
    class Defaults:
        logger = get_logger("config.perplexity", level=logging.INFO)
        model = "sonar"

    def __init__(
        self,
        auth_token: str,
        model: str = Defaults.model,
        logger: logging.Logger = Defaults.logger,
    ):
        super().__init__()
        self.auth_token = auth_token
        self.model = model
        self.logger = logger

    def validate(self) -> None:
        if not self.auth_token:
            raise InvalidConfigException(
                "Please provide auth token via $PERPLEXITY_TOKEN"
            )


class PerplexityConfigurationCollection(
    ConfigurationCollection[PerplexityConfiguration]  # type: ignore
):
    def get_config(self, config_name: str) -> PerplexityConfiguration:
        return super().get_config(config_name)

    def get_all_configs(self) -> dict[str, PerplexityConfiguration]:
        return super().get_all_configs()


perplexity_configs = PerplexityConfigurationCollection()
perplexity_configs.add(
    perplexity=PerplexityConfiguration(auth_token=environ.get("PERPLEXITY_TOKEN", "")),
)
