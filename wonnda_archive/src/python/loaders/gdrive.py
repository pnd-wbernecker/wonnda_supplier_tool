from datetime import datetime
from re import compile, sub

from configs.bigquery import BigQueryConfiguration, bq_configs
from configs.gdrive import GDriveConfiguration, gdrive_configs
from pnd_database.bigquery.bigquery import BigQuery
from pnd_database.bigquery.bigquery_utils import get_schema_from_row
from pnd_gsheets.g_sheets import GSheets
from pnd_gsheets.gsheets_utils import transform_sheet_data_to_list_of_dicts

XLSX_FILE_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
GSHEETS_FILE_TYPE = "application/vnd.google-apps.spreadsheet"


def process_file(
    file_name: str,
    file_id: str,
    file_type: str,
    gsheets: GSheets,
    gdrive_config: GDriveConfiguration,
    bq_client: BigQuery,
    bq_config: BigQueryConfiguration,
) -> None:
    """
    Process a single file by reading its contents, loading to BigQuery,
    and moving to the processed folder.
    :param file_name: Name of the file to process.
    :param file_id: ID of the file.
    :param file_type: MimeType of the file.
    :param gsheets: Google Sheets client instance.
    :param gdrive_config: Google Drive configuration object.
    :param bq_client: BigQuery client instance.
    :param bq_config: BigQuery configuration object.
    """
    gdrive_config.logger.info(f"Processing file {file_name}")

    # XLSX file format
    if file_type == XLSX_FILE_TYPE:
        sheet_data = gsheets.read_xlsx(file_id)

    # Google Sheet file format
    elif file_type == GSHEETS_FILE_TYPE:
        # Extract the first sheet from the spreadsheet
        sheet = gsheets.get_spreadsheet_meta(file_id)["sheets"][0]
        sheet_name = sheet["properties"]["title"]
        sheet_data = gsheets.read_values(spreadsheet_id=file_id, read_ranges=sheet_name)

    else:
        gdrive_config.logger.warning(f"File type {file_type} not implemented. Skipping")
        return

    sheet_json_data = transform_sheet_data_to_list_of_dicts(data=sheet_data)

    # Process data for load
    key_pattern = compile(r"(?<!^)(?=\s+|[A-Z])")
    load_data = list()
    for row in sheet_json_data:
        row["source_file"] = sub(".csv", "", file_name)
        row["loaded_at"] = datetime.now()
        # Format keys from CamelCase to snake_case and remove whitespace,
        # and replace '-' values with NoneTypes
        clean_row = {
            key_pattern.sub("_", key).lower(): value if value != "-" else None
            for key, value in row.items()
        }
        load_data.append(clean_row)

    # Load data to DWH
    bq_client.create_dataset(
        dataset_name=gdrive_config.dwh_dataset, location=bq_config.location
    )
    if not bq_client.table_exists(
        dataset_name=gdrive_config.dwh_dataset,
        table_name=gdrive_config.dwh_table,
    ):
        schema = get_schema_from_row(data=load_data[0], schema=list())
        bq_client.create_table(
            dataset=gdrive_config.dwh_dataset,
            table_name=gdrive_config.dwh_table,
            schema=schema,
        )
    bq_client.write_to_table(
        data=load_data,
        dataset=gdrive_config.dwh_dataset,
        table_name=gdrive_config.dwh_table,
        check_for_new_columns=True,
    )

    # Move file from unprocessed to processed folder
    gdrive_config.logger.info(
        f"Moving file {file_name} from unprocessed to processed folder."
    )
    gsheets.move_file(
        file_id=file_id,
        source_folder_id=gdrive_config.unprocessed_folder_id,
        destination_folder_id=gdrive_config.processed_folder_id,
    )


def process_gdrive() -> None:
    """
    Process all Google Drive files from the unprocessed folder.
    :return:
    """
    bq_config = bq_configs.get_config("bigquery")
    gdrive_config = gdrive_configs.get_config("gdrive")

    bq_client = BigQuery(
        service_account_path=bq_config.service_account_file_path,
        project=bq_config.project,
        location=bq_config.location,
        logger=bq_config.logger,
    )

    gsheets_client = GSheets(
        service_account_file_path=gdrive_config.service_account_file_path,
        logger=gdrive_config.logger,
    )

    files_to_process = gsheets_client.list_files_in_folder(
        folder_id=gdrive_config.unprocessed_folder_id
    )

    if not files_to_process:
        gdrive_config.logger.info("No files to process. Skipping load.")
        return

    # Iterate over unprocessed files
    gdrive_config.logger.info(f"Processing {len(files_to_process)} files.")
    for file in files_to_process:
        process_file(
            file_name=file["name"],
            file_id=file["id"],
            file_type=file["mimeType"],
            gsheets=gsheets_client,
            gdrive_config=gdrive_config,
            bq_client=bq_client,
            bq_config=bq_config,
        )


if __name__ == "__main__":
    process_gdrive()
