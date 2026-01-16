import concurrent.futures
from os import path
from pathlib import Path
from time import sleep
from typing import Any

from configs.bigquery import bq_configs
from configs.llm_enrichment import LLMEnrichmentConfiguration, llm_enrichment_configs
from configs.openai import openai_configs
from configs.perplexity import perplexity_configs
from connectors.langchain.openai import OpenAI
from connectors.perplexity.perplexity import Perplexity
from pnd_database.bigquery.bigquery import BigQuery
from pnd_database.bigquery.bigquery_utils import get_schema_from_row
from pnd_utils import chunked
from pydantic import BaseModel

CHUNK_SIZE = 25
PROMPT_DIR = path.join(Path(__file__).parents[2], "prompt_templates")


# Define output structure
class CompanyArray(BaseModel):  # type: ignore
    class Company(BaseModel):  # type: ignore
        company_id: str
        formatted_company_name: str
        formatted_address: str
        determined_company_type1: str
        enriched_description: str

    companies: list[Company]


def get_companies_to_process(
    bq_client: BigQuery,
    llm_enrichment_config: LLMEnrichmentConfiguration,
) -> list[dict[str, Any]]:
    """
    Retrieve a list of companies that need to be processed for LLM enrichment.

    If the processed table exists, it returns companies that haven't been processed yet.
    If not, it returns all companies from the unprocessed table.

    :param bq_client: BigQuery client instance for database operations
    :param llm_enrichment_config: Configuration for LLM enrichment process
    :return: List of company records to be processed
    """
    if bq_client.table_exists(
        dataset_name=llm_enrichment_config.processed_dataset,
        table_name=llm_enrichment_config.processed_table,
    ):
        query_path = path.join(
            llm_enrichment_config.query_templates_path, "companies_to_process.sql"
        )
    else:
        llm_enrichment_config.logger.info(
            "Unprocessed table not found. Returning all companies."
        )
        query_path = path.join(
            llm_enrichment_config.query_templates_path, "select_all_companies.sql"
        )

    query_params = [
        BigQuery.QueryParam(
            name="unprocessed_dataset",
            type_=BigQuery.QueryParam.Types.IDENTIFIER,
            value=llm_enrichment_config.unprocessed_dataset,
        ),
        BigQuery.QueryParam(
            name="processed_dataset",
            type_=BigQuery.QueryParam.Types.IDENTIFIER,
            value=llm_enrichment_config.processed_dataset,
        ),
        BigQuery.QueryParam(
            name="unprocessed_table",
            type_=BigQuery.QueryParam.Types.IDENTIFIER,
            value=llm_enrichment_config.unprocessed_table,
        ),
        BigQuery.QueryParam(
            name="processed_table",
            type_=BigQuery.QueryParam.Types.IDENTIFIER,
            value=llm_enrichment_config.processed_table,
        ),
        BigQuery.QueryParam(
            name="id_column",
            type_=BigQuery.QueryParam.Types.IDENTIFIER,
            value=llm_enrichment_config.id_column,
        ),
    ]

    query_result = [
        dict(row)
        for row in bq_client.parametrized_query(
            query_path=query_path,
            query_params=query_params,
        )
    ]

    return query_result


def retrieve_missing_addresses_and_descriptions(
    companies: list[dict[str, str]],
    perplexity_client: Perplexity,
    concurrency_interval: float = 2.4,
) -> list[dict[str, str]]:
    """
    Concurrently retrieve missing addresses and descriptions for companies using
    the Perplexity client.

    :param companies: List of company dictionaries containing company information
    :param perplexity_client: Client instance for making requests to Perplexity
    :param concurrency_interval: The interval (in seconds) at which to submit
    concurrent tasks. Defaults to 1.2s based on the API rate limit of 50 requests
    per minute.
    :return: List of company dictionaries with updated addresses and descriptions
    """
    with open(path.join(PROMPT_DIR, "retrieve_address.txt")) as address_prompt_file:
        address_prompt_template = address_prompt_file.read()

    with open(
        path.join(PROMPT_DIR, "create_description.txt")
    ) as description_prompt_file:
        description_prompt_template = description_prompt_file.read()

    processed_companies = list()
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = list()
        for company in companies:
            sleep(concurrency_interval)
            future = executor.submit(
                retrieve_company_address_and_description,
                company=company,
                perplexity_client=perplexity_client,
                address_prompt_template=address_prompt_template,
                description_prompt_template=description_prompt_template,
            )
            futures.append(future)

        for future in concurrent.futures.as_completed(futures):
            processed_companies.append(future.result())

    return processed_companies


def retrieve_company_address_and_description(
    company: dict[str, str],
    perplexity_client: Perplexity,
    address_prompt_template: str,
    description_prompt_template: str,
) -> dict[str, str]:
    """
    Retrieve the address and description for a single company using the
    Perplexity client.

    :param company: Dictionary containing company information
    :param perplexity_client: Client instance for making requests to Perplexity API
    :param address_prompt_template: Template string for generating address
    retrieval prompts
    :param description_prompt_template: Template string for generating company
    description prompts
    :return: Updated company dictionary with retrieved address and/or description
    """
    company_name = company["company_name"]
    company_domain = company["domain"]
    company_country = company["country"]
    if not company["address"]:
        perplexity_client.logger.info(f"Retrieving address for {company_name}")
        prompt = address_prompt_template.format(
            company_name=company_name,
            domain=company_domain,
            country=company_country,
        )
        company["address"] = perplexity_client.get_chat_response(
            prompt=prompt,
            search_domain_filter=[company_domain] if company_domain else None,
        )
    if not company["description"]:
        perplexity_client.logger.info(f"Creating description for {company_name}")
        prompt = description_prompt_template.format(
            company_name=company_name,
            domain=company_domain,
        )
        company["description"] = perplexity_client.get_chat_response(
            prompt=prompt,
            search_domain_filter=[company_domain] if company_domain else None,
        )

    return company


def reformat_and_enrich_companies(
    companies: list[dict[str, Any]],
    openai_client: OpenAI,
) -> list[dict[str, Any]]:
    """
    Process and enhance company data using the OpenAI client.

    :param companies: List of company records to be processed
    :param openai_client: OpenAI client instance for enrichment operations
    :return: List of enriched company records
    """
    openai_client.logger.info("Reformatting and enriching company data.")
    with open(path.join(PROMPT_DIR, "enrich_companies.txt")) as prompt_file:
        prompt_template = prompt_file.read()

    enriched_companies = list()

    input_companies = [
        {
            "company_id": company["company_id"],
            "name": company["company_name"],
            "address": company["address"],
            "description": company["description"],
        }
        for company in companies
    ]

    prompt = prompt_template.format(companies=input_companies)
    structured_response = openai_client.get_structured_response(
        prompt=prompt,
        structure=CompanyArray,
    )
    # Parse response
    for row in structured_response.companies:
        enriched_company = row.model_dump()
        # Control for false nulls by retrying
        if not enriched_company["formatted_company_name"]:
            openai_client.logger.info(
                "Null return for company ID "
                f"{enriched_company['company_id']}. Retrying..."
            )
            retry_input = [
                company
                for company in input_companies
                if company["company_id"] == enriched_company["company_id"]
            ]
            retry_prompt = prompt_template.format(companies=retry_input)
            retry_response = openai_client.get_structured_response(
                prompt=retry_prompt, structure=CompanyArray
            )
            enriched_company = retry_response.companies[0].model_dump()

        enriched_companies.append(enriched_company)

    return enriched_companies


def process_enrichment(chunk_size: int = CHUNK_SIZE) -> None:
    """
    Run the LLM enrichment process on the company data.
    :param chunk_size: the chunk size to use during processing
    """
    bq_config = bq_configs.get_config("bigquery")
    bq_client = BigQuery(
        service_account_path=bq_config.service_account_file_path,
        project=bq_config.project,
        location=bq_config.location,
    )

    companies_enrichment_config = llm_enrichment_configs.get_config("companies")

    perplexity_config = perplexity_configs.get_config("perplexity")
    perplexity_client = Perplexity(
        token=perplexity_config.auth_token,
        model=perplexity_config.model,
        logger=perplexity_config.logger,
    )

    openai_config = openai_configs.get_config("openai")
    openai_client = OpenAI(model=openai_config.model, logger=openai_config.logger)

    companies_to_process = get_companies_to_process(
        bq_client=bq_client,
        llm_enrichment_config=companies_enrichment_config,
    )
    if not companies_to_process:
        companies_enrichment_config.logger.info("No companies to process.")
        return

    companies_enrichment_config.logger.info(
        f"Processing {len(companies_to_process)} companies."
    )
    processed_count = 0
    for company_chunk in chunked(companies_to_process, chunk_size=chunk_size):
        processed_count += len(company_chunk)
        openai_client.logger.info(
            f"Processing {processed_count} / {len(companies_to_process)} companies."
        )

        # Retrieve missing fields from Perplexity
        retrieve_missing_addresses_and_descriptions(
            companies=company_chunk,
            perplexity_client=perplexity_client,
        )

        # Reformat and enrich fields with OpenAI
        enriched_fields = reformat_and_enrich_companies(
            companies=company_chunk,
            openai_client=openai_client,
        )

        # Join enriched fields back to company data
        for company_row in company_chunk:
            for enriched_row in enriched_fields:
                if company_row["company_id"] == enriched_row["company_id"]:
                    for key in enriched_row:
                        company_row[key] = enriched_row[key]

        # Load to DWH
        bq_client.create_dataset(
            dataset_name=companies_enrichment_config.processed_dataset
        )
        if not bq_client.table_exists(
            dataset_name=companies_enrichment_config.processed_dataset,
            table_name=companies_enrichment_config.processed_table,
        ):
            schema = get_schema_from_row(
                data=company_chunk[0],
                schema=list(),
            )
            bq_client.create_table(
                dataset=companies_enrichment_config.processed_dataset,
                table_name=companies_enrichment_config.processed_table,
                schema=schema,
            )
        bq_config.logger.info(f"Writing {len(company_chunk)} rows to the database.")
        bq_client.write_to_table(
            data=company_chunk,
            dataset=companies_enrichment_config.processed_dataset,
            table_name=companies_enrichment_config.processed_table,
        )


if __name__ == "__main__":
    process_enrichment()
