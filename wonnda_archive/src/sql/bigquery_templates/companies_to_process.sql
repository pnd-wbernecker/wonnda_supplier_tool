SELECT
  unprocessed.*
FROM {unprocessed_dataset}.{unprocessed_table} unprocessed
LEFT JOIN {processed_dataset}.{processed_table} processed
USING ({id_column})
WHERE processed.{id_column} IS NULL;
