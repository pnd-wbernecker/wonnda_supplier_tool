import logging
from os import environ

from pnd_utils.configuration.config_exceptions import InvalidConfigException
from pnd_utils.configuration.configuration import Configuration, ConfigurationCollection
from pnd_utils.logging import get_logger


class OpenAIConfiguration(Configuration):  # type: ignore
    class Defaults:
        logger = get_logger("config.openai", level=logging.INFO)
        model = "gpt-4o-mini"

    def __init__(
        self,
        model: str = Defaults.model,
        logger: logging.Logger = Defaults.logger,
    ):
        super().__init__()
        self.model = model
        self.logger = logger

    def validate(self) -> None:
        if not environ.get("OPENAI_API_KEY"):
            raise InvalidConfigException("Please provide a key via $OPENAI_API_KEY")


class OpenAIConfigurationCollection(
    ConfigurationCollection[OpenAIConfiguration]  # type: ignore
):
    def get_config(self, config_name: str) -> OpenAIConfiguration:
        return super().get_config(config_name)

    def get_all_configs(self) -> dict[str, OpenAIConfiguration]:
        return super().get_all_configs()


openai_configs = OpenAIConfigurationCollection()
openai_configs.add(openai=OpenAIConfiguration())
