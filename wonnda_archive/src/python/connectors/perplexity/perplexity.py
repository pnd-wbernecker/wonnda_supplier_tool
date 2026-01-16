import logging

import requests
from pnd_utils.logging import get_logger
from requests.exceptions import HTTPError
from retry import retry

DEFAULT_LOGGER = get_logger("client.perplexity", level=logging.INFO)


class EmptyResponseError(Exception):
    pass


class Perplexity:
    BASE_URL = "https://api.perplexity.ai"
    REQUEST_TIMEOUT = 120

    class Endpoints:
        chat_completions = "chat/completions"

    class Roles:
        assistant = "assistant"
        system = "system"
        user = "user"

    def __init__(
        self,
        token: str,
        model: str,
        logger: logging.Logger,
    ):
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self.model = model
        self.logger = logger

    @retry(
        exceptions=(EmptyResponseError, HTTPError),
        tries=4,
        delay=2,
        backoff=30,
        logger=DEFAULT_LOGGER,
    )
    def get_chat_response(
        self,
        prompt: str,
        temperature: float = 0,
        search_domain_filter: list[str] = None,
    ) -> str:
        """
        Get a response from the chat completion endpoint.
        :param prompt: The input prompt to send to the model
        :param temperature: Controls randomness in the response.
        Lower values make the response more focused and deterministic
        :param search_domain_filter: List of domains to filter the search results
        :return: The model's response text
        """
        request_url = "/".join([self.BASE_URL, self.Endpoints.chat_completions])
        payload = {
            "model": self.model,
            "temperature": temperature,
            "search_domain_filter": search_domain_filter,
            "messages": [
                {
                    "role": self.Roles.user,
                    "content": prompt,
                }
            ],
        }

        response = requests.post(
            url=request_url,
            headers=self.headers,
            json=payload,
            timeout=self.REQUEST_TIMEOUT,
        )
        response.raise_for_status()

        # Control for sporadic empty responses
        if response.status_code == 204:
            self.logger.warning("204 Empty Response")
            raise EmptyResponseError

        prompt_response = response.json()["choices"][0]["message"]["content"]

        return prompt_response
