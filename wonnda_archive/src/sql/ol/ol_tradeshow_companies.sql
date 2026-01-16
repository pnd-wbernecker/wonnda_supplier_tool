CREATE OR REPLACE TABLE `supplier-scraping.ol.tradeshow_companies` (
/* KEYS */
tradeshow_company_id STRING,
company_id           STRING,    -- Primary key (domain + loaded_at)
/* DIMENSIONS */
company_name        STRING,
tradeshow_date      DATE,
email               STRING,    -- Only populated with valid business emails
phone               STRING,
address             STRING,
country             STRING,
/* ATTRIBUTES */
website             STRING,
domain              STRING,
bubble_company_id   STRING,
category            STRING,  
tags                STRING,    
source              STRING,    
/* METRICS & DESCRIPTIONS */
description         STRING,
company_type1       STRING,
/* METADATA */
loaded_at           DATE
);

INSERT INTO `supplier-scraping.ol.tradeshow_companies`
SELECT 
  tradeshow_company_id,
  company_id,
  company_name,
  tradeshow_date,
  CASE 
    WHEN is_valid_email THEN email
    ELSE NULL 
  END as email,
  phone,
  address,
  country,
  website,
  domain,
  bubble_company_id,
  category,
  tags,
  source,
  description,
  company_type1,
  loaded_at
FROM `supplier-scraping.il.tradeshow_companies`
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY tradeshow_company_id 
  ORDER BY loaded_at DESC
) = 1;