import logging
from typing import Type

from langchain_core.exceptions import OutputParserException
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from pnd_utils.logging import get_logger
from pydantic import BaseModel
from retry import retry

DEFAULT_LOGGER = get_logger("client.openai", level=logging.INFO)


class OpenAI:
    def __init__(
        self,
        logger: logging.Logger,
        model: str,
        temperature: float = 0,
    ):
        self.logger = logger
        self._llm = ChatOpenAI(
            model=model,
            temperature=temperature,
        )

    def get_chat_response(self, prompt: str) -> str:
        """
        Get chat response for a given prompt.

        :param prompt: Input text prompt
        :return: Model's text response
        """
        message = [HumanMessage(prompt)]
        prompt_response = self._llm.invoke(message)

        return prompt_response.content

    @retry(
        exceptions=OutputParserException,
        tries=3,
        delay=30,
        backoff=4,
        logger=DEFAULT_LOGGER,
    )
    def get_structured_response(
        self, prompt: str, structure: Type[BaseModel]
    ) -> BaseModel:
        """
        Get structured response according to provided Pydantic model.

        :param prompt: Input text prompt
        :param structure: Pydantic model class for response structure
        :return: Structured response as Pydantic model instance
        """
        structured_llm = self._llm.with_structured_output(structure)
        message = [HumanMessage(prompt)]

        prompt_response = structured_llm.invoke(message)

        return prompt_response
