CREATE OR REPLACE TABLE `supplier-scraping.il.tradeshow_companies` (
/* KEYS */
tradeshow_company_id STRING,
company_id          STRING,
bubble_company_id   STRING,    -- From bubble mapping
/* DIMENSIONS */
company_name        STRING,
tradeshow_date      DATE,
email               STRING,
is_valid_email      BOOL,
phone               STRING,
address             STRING,
country             STRING,
/* ATTRIBUTES */
website             STRING,
domain              STRING,
category            STRING,
tags                STRING,
source              STRING,
/* METRICS & DESCRIPTIONS */
description         STRING,
company_type1       STRING,
/* METADATA */
loaded_at           DATE
);

INSERT INTO `supplier-scraping.il.tradeshow_companies`
SELECT
CAST(
  ABS(FARM_FINGERPRINT(
    CONCAT(
      PARSE_DATE('%d.%m.%Y', ts.tradeshow_date),
      COALESCE(
        NET.HOST(REGEXP_REPLACE(LOWER(COALESCE(ts.website, '')), r'^https?://(?:www\.)?', '')),
        ts.name
      ),
      ts.source_file
    )
  )) AS STRING
) as tradeshow_company_id,
CAST(
  ABS(FARM_FINGERPRINT(
    COALESCE(
      NET.HOST(REGEXP_REPLACE(LOWER(COALESCE(ts.website, '')), r'^https?://(?:www\.)?', '')),
      ts.name
    )
  )
) AS STRING) as company_id,
b.bubble_company_id,
ts.name as company_name,
PARSE_DATE('%d.%m.%Y', ts.tradeshow_date) as tradeshow_date,
ts.email,
COALESCE(
  REGEXP_CONTAINS(ts.email, r'^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$') 
  AND NOT REGEXP_CONTAINS(LOWER(ts.email), r'@(gmail|yahoo|hotmail|outlook|aol|icloud|proton|zoho|yandex|mail|gmx|live|msn|inbox|rediff)\.'),
  FALSE
) as is_valid_email,
ts.phone,
ts.address,
ts.country,
ts.website,
NET.HOST(REGEXP_REPLACE(LOWER(COALESCE(ts.website, '')), r'^https?://(?:www\.)?', '')) as domain,
ts.category_1 as category,
ts.tags as tags,
ts.source_file as source,
ts.description,
ts.company_type1,
DATE(TIMESTAMP(ts.loaded_at)) as loaded_at
FROM `supplier-scraping.dl_gdrive.tradeshow_companies` ts
LEFT JOIN `supplier-scraping.dl_gdrive.bubble_company_ids` b
  ON NET.HOST(REGEXP_REPLACE(LOWER(COALESCE(ts.website, '')), r'^https?://(?:www\.)?', '')) = b.domain
LEFT JOIN `supplier-scraping.dl_gdrive.unlisted_companies` uc
  ON NET.HOST(REGEXP_REPLACE(LOWER(COALESCE(ts.website, '')), r'^https?://(?:www\.)?', '')) = uc.domain
WHERE uc.domain IS NULL;
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY tradeshow_company_id 
  ORDER BY tradeshow_date DESC
) = 1;