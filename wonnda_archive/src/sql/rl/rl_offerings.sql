CREATE OR REPLACE TABLE `supplier-scraping.rl.offerings`(
/* KEYS */
tradeshow_company_id STRING,    -- Primary key (domain + loaded_at)
/* DIMENSIONS */
company_id          STRING,
company_name        STRING,
tradeshow_date      DATE,
/* ATTRIBUTES */
category            STRING,
tags                STRING,   
source              STRING,    
/* METRICS & DESCRIPTIONS */
description         STRING
);

INSERT INTO `supplier-scraping.rl.offerings`
SELECT 
  tradeshow_company_id,
  company_id,
  company_name,
  tradeshow_date,
  category,
  tags,
  source,
  description
FROM `supplier-scraping.ol.tradeshow_companies`;
