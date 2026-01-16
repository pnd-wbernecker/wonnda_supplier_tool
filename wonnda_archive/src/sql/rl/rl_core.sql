CREATE OR REPLACE TABLE `supplier-scraping.rl.core` (
company_id           STRING,
bubble_company_id   STRING,
company_name         STRING,
email               STRING, 
phone               STRING,
address             STRING,
country             STRING,
website             STRING,
domain              STRING,
description         STRING,
companyType1        STRING,
category            STRING,
tags                STRING,
satellite_data      STRING
);

INSERT INTO `supplier-scraping.rl.core`
WITH tradeshow_aggregates AS (
  SELECT 
    company_id,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT tags), ', ') as tradeshow_tags,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT category), ', ') as tradeshow_categories
  FROM `supplier-scraping.ol.tradeshow_companies`
  GROUP BY company_id
)
SELECT
  c.company_id,
  c.bubble_company_id,
  c.formatted_company_name as company_name,
  c.email,
  c.phone,
  c.formatted_address as address,
  c.country,
  c.website,
  c.domain,
  c.enriched_description as description,
  COALESCE(c.company_type1, c.determined_company_type1) as companyType1,
  t.tradeshow_categories as category,
  t.tradeshow_tags as tags,
  CONCAT(IFNULL(c.formatted_company_name, ''), '; ', IFNULL(c.country, ''), '; ', IFNULL(c.enriched_description, '')) as satellite_data
FROM `supplier-scraping.el.companies` c
LEFT JOIN tradeshow_aggregates t
  ON c.company_id = t.company_id;