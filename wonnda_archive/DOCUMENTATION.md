# Wonnda Archive - Dokumentation

## Überblick

Die **Wonnda BigQuery Pipeline** ist eine automatisierte Datenverarbeitungs-Pipeline zur Anreicherung und Verarbeitung von Firmendaten aus Messen (Tradeshows). Die Pipeline lädt Daten aus Google Drive, verarbeitet diese durch mehrere SQL-Transformationsschichten und reichert sie mit LLM-generierten Informationen an.

---

## Architektur

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Google Drive   │───►│  IL Layer    │───►│  LLM Enrichment │───►│  RL Layer    │
│  (XLSX/GSheets) │    │  (Staging)   │    │  (Perplexity/   │    │  (Reporting) │
└─────────────────┘    └──────────────┘    │   OpenAI)       │    └──────────────┘
                                           └─────────────────┘
```

### Datenschichten (Layer)

| Layer | Beschreibung | Dataset |
|-------|--------------|---------|
| **DL** (Data Lake) | Rohdaten aus Google Drive | `dl_gdrive` |
| **IL** (Integration Layer) | Staging/Bereinigung | `il` |
| **OL** (Operational Layer) | Deduplizierte Kerndaten | `ol` |
| **EL** (Enrichment Layer) | LLM-angereicherte Daten | `el` |
| **RL** (Reporting Layer) | Finale Export-Tabellen | `rl` |

---

## Infrastruktur

### Cloud-Komponenten

| Komponente | Service | Details |
|------------|---------|---------|
| **Compute** | Google Cloud Run | Container-basierte Ausführung |
| **Scheduling** | Cloud Scheduler | Periodische Ausführung |
| **Container Registry** | Artifact Registry | `europe-west3-docker.pkg.dev` |
| **Data Warehouse** | BigQuery | Projekt: `supplier-scraping`, Region: `EU` |
| **File Storage** | Google Drive | Unprocessed/Processed Folder |

### Interne Dependencies

Die Pipeline nutzt Pandata-interne Python-Packages:

- `pnd_database` - BigQuery Connector
- `pnd_gsheets` - Google Sheets/Drive Connector  
- `pnd_utils` - Logging & Configuration Utilities

---

## Pipeline-Workflow

Der Hauptprozess (`main_process.py`) führt 4 Schritte sequentiell aus:

### 1. Google Drive Load (`process_gdrive`)

```
GDrive Unprocessed Folder → BigQuery dl_gdrive.tradeshow_companies
```

- Liest XLSX und Google Sheets aus dem "Unprocessed" Ordner
- Transformiert CamelCase-Keys zu snake_case
- Lädt Daten in BigQuery
- Verschiebt verarbeitete Dateien in den "Processed" Ordner

### 2. IL & OL SQL Queries

```
dl_gdrive → il.tradeshow_companies → ol.companies / ol.tradeshow_companies
```

**IL-Transformationen:**
- Generiert eindeutige IDs (`FARM_FINGERPRINT`)
- Extrahiert Domain aus Website-URL
- Validiert E-Mail-Adressen (filtert private E-Mail-Provider)
- Joined mit Bubble Company IDs

**OL-Transformationen:**
- Dedupliziert Companies (neuester Eintrag pro `company_id`)
- Aggregiert Tradeshow-Daten

### 3. LLM Enrichment (`process_enrichment`)

```
ol.companies → [Perplexity + OpenAI] → el.companies
```

**Perplexity API** (Web Search):
- Findet fehlende Adressen von Company-Websites
- Generiert Company-Beschreibungen

**OpenAI API** (Structured Output):
- Formatiert Company-Namen (CamelCase → Proper)
- Standardisiert Adressen
- Klassifiziert Company-Typ (seller/buyer)
- Optimiert Beschreibungen (max 150 Wörter)

### 4. RL SQL Queries

```
el.companies + ol.tradeshow_companies → rl.core / rl.offerings
```

- `rl.core` - Finale Company-Stammdaten
- `rl.offerings` - Tradeshow-Teilnahmen & Angebote

---

## Konfiguration

### Environment Variables

| Variable | Beschreibung |
|----------|--------------|
| `SERVICE_ACCOUNT_PATH` | Pfad zur GCP Service Account JSON |
| `OPENAI_API_KEY` | OpenAI API Key |
| `PERPLEXITY_API_KEY` | Perplexity API Key |

### BigQuery Config

```python
project = "supplier-scraping"
location = "EU"
```

---

## Deployment

### Docker Build & Push

```bash
export GCLOUD_PROJECT="supplier-scraping"
export REPO="wonnda-bigquery"
export REGION="europe-west3"
export IMAGE="bigquery-pipeline"
export IMAGE_TAG=${REGION}-docker.pkg.dev/$GCLOUD_PROJECT/$REPO/$IMAGE

# Auth (einmalig)
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build mit SSH Keys für interne Packages
docker build --platform linux/amd64 -t $IMAGE_TAG -f pipeline.dockerfile --no-cache \
  --build-arg ssh_prv_key_pnd_cb_database_connector="$(cat ~/.ssh/pnd_database_connector)" \
  --build-arg ssh_prv_key_pnd_cb_gcs="$(cat ~/.ssh/pnd_gcs)" \
  --build-arg ssh_prv_key_pnd_cb_gsheets_connector="$(cat ~/.ssh/pnd_gsheets_connector)" \
  --build-arg ssh_prv_key_pnd_cb_utils="$(cat ~/.ssh/pnd_utils)" .

# Push
docker push $IMAGE_TAG
```

### Cloud Run Deployment

Nach dem Push muss eine neue Revision in Cloud Run erstellt werden.

---

## Projektstruktur

```
wonnda_archive/
├── pipeline.dockerfile      # Container-Definition
├── requirements.txt         # Python Dependencies
├── pyproject.toml          # Tool-Konfiguration (black, mypy, pytest)
├── src/
│   ├── prompt_templates/   # LLM Prompts
│   │   ├── create_description.txt
│   │   ├── enrich_companies.txt
│   │   └── retrieve_address.txt
│   ├── python/
│   │   ├── configs/        # Konfigurationsklassen
│   │   ├── connectors/     # API Clients (OpenAI, Perplexity)
│   │   ├── loaders/        # ETL Prozesse
│   │   └── pipelines/      # Hauptprozess
│   └── sql/
│       ├── bigquery_templates/  # Dynamische Queries
│       ├── il/                  # Integration Layer
│       ├── ol/                  # Operational Layer
│       └── rl/                  # Reporting Layer
```

---

## Tech Stack

| Kategorie | Technologie |
|-----------|-------------|
| **Sprache** | Python 3.10 |
| **LLM Framework** | LangChain |
| **LLM APIs** | OpenAI, Perplexity |
| **Data Warehouse** | Google BigQuery |
| **File Storage** | Google Drive/Sheets |
| **Container** | Docker |
| **Cloud** | GCP (Cloud Run, Scheduler, Artifact Registry) |
| **Validation** | Pydantic |

---

## Datenmodell

### rl.core (Output)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| company_id | STRING | Eindeutige ID (FARM_FINGERPRINT) |
| bubble_company_id | STRING | Externe Bubble.io ID |
| company_name | STRING | Formatierter Firmenname |
| email | STRING | Validierte Business-E-Mail |
| phone | STRING | Telefonnummer |
| address | STRING | Standardisierte Adresse |
| country | STRING | Land |
| website | STRING | Website-URL |
| domain | STRING | Domain (extrahiert) |
| description | STRING | LLM-generierte Beschreibung |
| companyType1 | STRING | seller/buyer |
| category | STRING | Aggregierte Kategorien |
| tags | STRING | Aggregierte Tags |
| satellite_data | STRING | Suchindex für Matching |
