# Supplier Tool - Requirements

## 1. Überblick

Das Supplier Tool ist eine Webanwendung zur automatisierten Verarbeitung, Bereinigung und Anreicherung von Firmendaten aus **beliebigen CSV-Quellen**.

### Kernidee

```
Beliebige "dirty" CSVs  →  [LLM Pipeline]  →  Festes, sauberes Schema
```

- **Input:** CSVs mit unterschiedlichen Spalten, Formaten, fehlenden Daten
- **Output:** Immer das gleiche standardisierte `companies`-Schema in Supabase

### Ziele
- **Flexibler Input:** Beliebige CSV-Strukturen verarbeiten (unterschiedliche Spaltenamen, Formate)
- **Fester Output:** Immer gleiches, sauberes Zielschema
- **Qualität:** Starke Guardrails gegen LLM-Halluzinationen
- **Konfigurierbarkeit:** Rules, Workflows und Prompts über UI anpassbar
- **Einfachheit:** Kein Docker, kein GDrive, läuft auf Vercel

---

## 2. Tech Stack

| Komponente | Technologie |
|------------|-------------|
| **Frontend** | Next.js + TypeScript |
| **Styling** | Tailwind CSS |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **LLM APIs** | OpenAI (gpt-4o-mini), Perplexity (sonar) |
| **Deployment** | Vercel |

---

## 3. Existierende Logik (wonnda_archive) - Analyse

Dieses Kapitel dokumentiert die existierende Implementierung, um bewusste Entscheidungen über Migration vs. Neuimplementierung zu treffen.

### 3.1 Architektur-Übersicht (Alt)

```
GDrive (XLSX/GSheets)
    ↓
dl_gdrive (Data Lake) ─────────────────────────────────┐
    ↓                                                   │
il.tradeshow_companies (Integration Layer)              │
    ↓                                                   │
ol.companies + ol.tradeshow_companies (Operational)     │
    ↓                                                   │
el.companies (Enrichment Layer via LLM)                 │
    ↓                                                   │
rl.core + rl.offerings (Reporting Layer) ←─────────────┘
```

### 3.2 Schritt 1: Data Loading (GDrive → BigQuery)

**Datei:** `loaders/gdrive.py`

**Was passiert:**
1. Dateien aus GDrive "Unprocessed" Ordner lesen (XLSX oder Google Sheets)
2. Keys von CamelCase zu snake_case transformieren
3. "-" Werte zu NULL konvertieren
4. `source_file` und `loaded_at` Metadaten hinzufügen
5. In BigQuery `dl_gdrive.tradeshow_companies` laden
6. Datei in "Processed" Ordner verschieben

**Migration:** ❌ Nicht migrieren - wird durch CSV Upload ersetzt

---

### 3.3 Schritt 2: Integration Layer (IL)

**Datei:** `sql/il/il_tradeshow_companies.sql`

**Transformationen:**

| Transformation | SQL-Logik | Migrieren? |
|----------------|-----------|------------|
| **Company ID generieren** | `FARM_FINGERPRINT(domain OR name)` | ✅ Ja - Domain-basierte ID |
| **Tradeshow Company ID** | `FARM_FINGERPRINT(date + domain + source)` | ⚠️ Anpassen |
| **Domain extrahieren** | `NET.HOST(REGEXP_REPLACE(website, 'https?://www\.?'))` | ✅ Ja |
| **E-Mail validieren** | Regex + Blacklist (gmail, yahoo, hotmail, etc.) | ✅ Ja |
| **Bubble ID Join** | LEFT JOIN auf Domain | ❌ Nicht relevant |
| **Unlisted Companies filtern** | WHERE NOT IN unlisted | ⚠️ Optional |
| **Deduplizierung** | `ROW_NUMBER() OVER (PARTITION BY id ORDER BY date DESC)` | ✅ Ja |

**E-Mail Blacklist (private Provider):**
```
gmail, yahoo, hotmail, outlook, aol, icloud, proton, zoho, yandex, mail, gmx, live, msn, inbox, rediff
```

---

### 3.4 Schritt 3: Operational Layer (OL)

**Datei:** `sql/ol/ol_companies.sql`

**Transformationen:**

| Transformation | SQL-Logik | Migrieren? |
|----------------|-----------|------------|
| **Deduplizierung** | `ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY tradeshow_date DESC)` | ✅ Ja |
| **Nur Business E-Mails** | `CASE WHEN is_valid_email THEN email ELSE NULL` | ✅ Ja |
| **Neuester Eintrag gewinnt** | `ORDER BY tradeshow_date DESC` | ✅ Ja |

**Wichtig:** Deduplizierung erfolgt **nicht** via LLM, sondern deterministisch via SQL auf Basis der `company_id` (= Domain Hash).

---

### 3.5 Schritt 4: LLM Enrichment (EL)

**Datei:** `loaders/llm_enrichment.py`

#### 4a. Perplexity - Fehlende Daten recherchieren

**Prompt: `retrieve_address.txt`**
```
Extract only the official, complete address of the company '{company_name}' 
from the company's website, checking sections like 'Contact Us', 'About Us', 
or 'Legal Notice'. The address should be formatted for use in Google Maps...
If no suitable address is found, leave the output completely blank.
Constrain the search to exclusively the following domain: '{domain}'.
```

**Prompt: `create_description.txt`**
```
Write a unique, friendly, and engaging company description in 150 words or fewer 
for the company '{company_name}'. Describe what the company offers, its strengths, 
and what makes it valuable or unique...
Constrain the search to exclusively the following domain: {domain}
```

**Guardrails:**
- ✅ Domain-Filter: Suche nur auf Company-Website
- ✅ Explicit Null: "leave completely blank" wenn nicht gefunden
- ✅ Längen-Limit: 150 Wörter max

#### 4b. OpenAI - Daten formatieren und anreichern

**Prompt: `enrich_companies.txt`**

**Input:** Batch von Companies als JSON Array (10-25 Stück)

**Output-Felder:**

| Feld | Transformation |
|------|----------------|
| `formatted_company_name` | "FROZEN POWER GMBH" → "Frozen Power GmbH" |
| `formatted_address` | Standardisiert: "House Number, Street, City, State, Zip, Country" |
| `determined_company_type1` | Klassifikation: "seller" oder "buyer" basierend auf Description |
| `enriched_description` | Beschreibung optimieren, max 150 Wörter, friendly tone |

**Structured Output:** Pydantic Schema `CompanyArray` mit `Company` Objekten

**Retry-Logik:** Bei NULL-Antwort wird einzelne Company nochmal verarbeitet

---

### 3.6 Schritt 5: Reporting Layer (RL)

**Datei:** `sql/rl/rl_core.sql`

**Transformationen:**

| Transformation | SQL-Logik | Migrieren? |
|----------------|-----------|------------|
| **Tags aggregieren** | `ARRAY_AGG(DISTINCT tags)` über alle Tradeshows | ✅ Ja |
| **Categories aggregieren** | `ARRAY_AGG(DISTINCT category)` | ✅ Ja |
| **Company Type Fallback** | `COALESCE(company_type1, determined_company_type1)` | ✅ Ja |
| **Satellite Data** | Suchindex: `CONCAT(name, country, description)` | ⚠️ Optional |

---

### 3.7 Zusammenfassung: Was migrieren?

| Komponente | Status | Begründung |
|------------|--------|------------|
| GDrive Loading | ❌ Nicht migrieren | Ersetzt durch CSV Upload |
| Domain-Extraktion | ✅ Migrieren | Kernlogik für Deduplizierung |
| E-Mail Validierung | ✅ Migrieren | Business E-Mail Blacklist |
| SQL Deduplizierung | ✅ Migrieren | Deterministisch, kein LLM nötig |
| Perplexity Address Lookup | ✅ Migrieren | Prompt übernehmen |
| Perplexity Description | ✅ Migrieren | Prompt übernehmen |
| OpenAI Formatting | ✅ Migrieren | Prompt + Pydantic Schema |
| OpenAI Company Type | ✅ Migrieren | seller/buyer Klassifikation |
| Bubble ID Mapping | ❌ Nicht migrieren | Nicht relevant |
| Layer-Architektur | ⚠️ Vereinfachen | 5 Layer → 2 Tabellen |

---

## 4. Neue Daten-Pipeline

### 4.1 Pipeline-Übersicht

```
┌─────────────────┐
│  CSV Upload     │
└────────┬────────┘
         ▼
┌─────────────────┐
│  1. UNDERSTAND  │  LLM erkennt CSV-Struktur, mappt auf Zielschema
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. DEDUPE      │  Deterministisch via Domain-Hash (wie wonnda_archive)
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. CLEAN       │  LLM formatiert Daten (OpenAI Prompt aus Archive)
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. RESEARCH    │  LLM recherchiert fehlende Daten (Perplexity)
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. VALIDATE    │  Prüfung gegen Column Rules
└────────┬────────┘
         ▼
┌─────────────────┐
│  Supabase       │  Speicherung (Duplikate überspringen)
└─────────────────┘
```

### 4.2 Pipeline-Schritte im Detail

#### Step 1: UNDERSTAND (Schema Mapping)
- **Input:** Rohe CSV mit beliebiger Struktur
- **LLM Task:** 
  - CSV-Spalten analysieren
  - Mapping auf Zielschema vorschlagen
  - Unbekannte Spalten kennzeichnen
- **Output:** Mapping-Konfiguration (source_column → target_column)
- **Human-in-the-Loop:** User bestätigt/korrigiert Mapping

#### Step 2: DEDUPE (Deduplizierung)
- **Input:** Gemappte Daten
- **Methode:** Deterministisch (kein LLM)
  - Company ID = Hash von Domain (oder Name falls keine Website)
  - Bei Duplikaten in CSV: Neuester Eintrag gewinnt
  - Bei Duplikaten mit Supabase: **Überspringen** (nicht überschreiben)
- **Output:** Deduplizierte Daten

#### Step 3: CLEAN (Data Cleaning)
- **Input:** Deduplizierte Daten
- **LLM Task (OpenAI):** Basierend auf `enrich_companies.txt`
  - `formatted_company_name`: Title Case, Abkürzungen korrekt
  - `formatted_address`: Standardformat
  - E-Mail Validierung (Blacklist für private Provider)
- **Output:** Bereinigte Daten

#### Step 4: RESEARCH (Anreicherung)
- **Input:** Bereinigte Daten mit fehlenden Feldern
- **LLM Task (Perplexity):** Basierend auf Archive-Prompts
  - Fehlende Adressen: `retrieve_address.txt`
  - Fehlende Beschreibungen: `create_description.txt`
  - Company Type klassifizieren: seller/buyer
- **Guardrails:** 
  - Domain-Filter: Nur Company-Website durchsuchen
  - Explicit Null bei Unsicherheit
  - Source URLs speichern

#### Step 5: VALIDATE (Regelprüfung)
- **Input:** Angereicherte Daten
- **Task:** Prüfung jeder Spalte gegen definierte Rules
- **Output:** 
  - ✅ Valid → Speichern in Supabase
  - ❌ Invalid → Zurück zu CLEAN oder RESEARCH
- **Konfiguration:** Validation Rules pro Spalte

---

## 5. Datenmodell (Supabase)

### 5.1 Kernprinzip: Festes Zielschema

```
┌─────────────────────────────────────────────────────────────────┐
│  INPUT: Beliebige "dirty" CSVs                                  │
│  - Unterschiedliche Spaltenamen                                 │
│  - Unterschiedliche Strukturen                                  │
│  - Fehlende Felder                                              │
│  - Inkonsistente Formatierung                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  UNDERSTAND     │  LLM mappt Input → Zielschema
                    │  CLEAN          │  LLM formatiert
                    │  RESEARCH       │  LLM füllt Lücken
                    └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  OUTPUT: Immer gleiches, sauberes Schema                        │
│  - Feste Spalten                                                │
│  - Standardisierte Formate                                      │
│  - Vollständige Daten (wo möglich)                              │
│  - Validierte Qualität                                          │
└─────────────────────────────────────────────────────────────────┘
```

**Das Zielschema ist NICHT flexibel.** Jede Input-CSV wird auf dieses feste Schema gemappt.

### 5.2 Zielschema: `companies`

Basierend auf `rl.core` aus wonnda_archive + Erweiterungen:

| Spalte | Typ | Quelle | Beschreibung |
|--------|-----|--------|--------------|
| `id` | UUID | Auto | Primary Key |
| `company_hash` | TEXT | Berechnet | **UNIQUE** - Hash aus Domain (Dedupe-Key) |
| `external_id` | TEXT | CSV | Original-ID falls vorhanden |
| `name` | TEXT | CSV | Original Firmenname |
| `formatted_name` | TEXT | LLM | Formatiert: "ACME GMBH" → "ACME GmbH" |
| `website` | TEXT | CSV | Website URL |
| `domain` | TEXT | Berechnet | Extrahiert aus Website |
| `email` | TEXT | CSV + Validierung | Nur Business-E-Mails (Blacklist) |
| `phone` | TEXT | CSV | Telefonnummer |
| `address` | TEXT | CSV | Original-Adresse |
| `formatted_address` | TEXT | LLM | Format: "Nr, Straße, Stadt, PLZ, Land" |
| `country_code` | TEXT | CSV / LLM | ISO Code (DE, US, etc.) |
| `country_name` | TEXT | CSV / LLM | Ausgeschrieben (Germany, etc.) |
| `description` | TEXT | CSV | Original-Beschreibung |
| `enriched_description` | TEXT | LLM | Optimiert, max 150 Wörter |
| `company_type` | TEXT | LLM | "seller" oder "buyer" |
| `categories` | TEXT[] | CSV | Kategorien |
| `tags` | TEXT[] | CSV | Tags |
| `certifications` | TEXT[] | CSV | Zertifizierungen (bio, etc.) |
| `production_types` | TEXT[] | CSV | wholesale, private_label, etc. |
| `accepts_startups` | BOOLEAN | CSV | Arbeitet mit Startups |
| `status` | TEXT | System | pending / enriched / validated |
| `import_id` | UUID | System | FK zu imports |
| `enrichment_sources` | JSONB | LLM | URLs der Recherche-Quellen |
| `created_at` | TIMESTAMPTZ | Auto | Erstelldatum |
| `updated_at` | TIMESTAMPTZ | Auto | Letztes Update |

### 5.3 Spalten-Mapping (UNDERSTAND Step)

Der UNDERSTAND-Schritt mappt beliebige CSV-Spalten auf das feste Schema:

| Ziel-Spalte | Mögliche Input-Varianten |
|-------------|--------------------------|
| `name` | company, company_name, name, firma, unternehmen |
| `website` | website, url, web, homepage |
| `email` | email, e-mail, mail, contact_email |
| `phone` | phone, tel, telephone, telefon |
| `address` | address, adresse, street, location |
| `country_name` | country, countryName, land |
| `country_code` | countryCode, country_code, iso |
| `description` | description, beschreibung, about, bio |
| `categories` | categories, category, categories_1-4 |
| `tags` | tags, keywords |
| `certifications` | certifications, certs, zertifikate |
| `production_types` | productionTypes, production_types |

Das LLM analysiert die CSV-Header und schlägt das Mapping vor. User bestätigt/korrigiert.

### 5.2 Meta-Tabellen

#### `imports`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primary Key |
| `filename` | TEXT | Original-Dateiname |
| `row_count` | INT | Anzahl Zeilen |
| `processed_count` | INT | Erfolgreich verarbeitet |
| `skipped_count` | INT | Übersprungen (Duplikate) |
| `status` | TEXT | pending / processing / completed / failed |
| `mapping_config` | JSONB | Schema Mapping |
| `created_at` | TIMESTAMPTZ | |

#### `column_rules`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primary Key |
| `column_name` | TEXT | Ziel-Spaltenname |
| `rule_type` | TEXT | required / format / enum / custom |
| `rule_config` | JSONB | Regel-Konfiguration |
| `error_message` | TEXT | Fehlermeldung bei Verstoß |
| `is_active` | BOOLEAN | Regel aktiv? |

#### `prompts`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primary Key |
| `step` | TEXT | understand / clean / research / validate |
| `name` | TEXT | Prompt-Name |
| `template` | TEXT | Prompt-Template mit Platzhaltern |
| `is_active` | BOOLEAN | Aktuell verwendet? |

#### `processing_logs`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primary Key |
| `company_id` | UUID | FK zu companies |
| `import_id` | UUID | FK zu imports |
| `step` | TEXT | Pipeline-Schritt |
| `input` | JSONB | Input-Daten |
| `output` | JSONB | Output-Daten |
| `llm_response` | JSONB | Rohe LLM-Antwort |
| `created_at` | TIMESTAMPTZ | |

---

## 6. LLM Strategie

### 6.1 Verarbeitungsmodus

**Hybrid-Ansatz (wie wonnda_archive):**
- **Batch-Verarbeitung:** 10-25 Companies pro Request als JSON Array
- **Alle Felder sichtbar:** LLM sieht Kontext
- **Spezifische Output-Felder:** Nur bestimmte Felder werden bearbeitet

### 6.2 Guardrails gegen Halluzinationen

| Guardrail | Implementierung |
|-----------|-----------------|
| **Domain-Filter** | Perplexity: `search_domain_filter=[company_domain]` |
| **Explicit Null** | Prompt: "If not found, return empty/null" |
| **Structured Output** | Pydantic/Zod Schema für alle Responses |
| **Source Attribution** | Perplexity URLs in `enrichment_sources` speichern |
| **Validation Layer** | Regex für E-Mail, URL, Phone |
| **Business E-Mail Check** | Blacklist: gmail, yahoo, hotmail, etc. |
| **Retry bei NULL** | Einzelne Company nochmal verarbeiten |

### 6.3 LLM Auswahl pro Schritt

| Schritt | LLM | Begründung |
|---------|-----|------------|
| UNDERSTAND | OpenAI | Schema-Analyse, kein Web nötig |
| DEDUPE | Kein LLM | Deterministisch via Domain-Hash |
| CLEAN | OpenAI | Formatierung (bestehender Prompt) |
| RESEARCH | Perplexity | Web-Suche mit Domain-Filter |
| VALIDATE | OpenAI | Rule-Checking (optional) |

### 6.4 Kosten-Schätzung

Bei 22.000 Companies:
- **OpenAI gpt-4o-mini:** ~$0.15/1M input, ~$0.60/1M output
- **Perplexity sonar:** ~$1/1000 requests

**Geschätzte Kosten pro 22k Import:** ~$5-15 (abhängig von Feldern die fehlen)

---

## 7. UI Features

### 7.1 Hauptbereiche

#### Dashboard
- Übersicht: Imports, Companies, Status-Verteilung
- Letzte Aktivitäten
- Quick Actions

#### Import
- CSV Upload (Drag & Drop)
- Schema Mapping UI (Source → Target)
- Import-Fortschritt (processed / skipped / failed)
- Import-Historie

#### Companies
- Tabellen-Ansicht mit Suche/Filter
- Einzelansicht mit Edit-Möglichkeit
- Status-Filter (pending / enriched / validated)
- Bulk Actions (Delete, Re-process)
- Export (CSV, JSON)

#### Pipeline
- Visueller Pipeline-Editor
- Step-Konfiguration (aktivieren/deaktivieren)
- Prompts bearbeiten
- Test-Run mit Sample-Daten

#### Rules
- Column Rules verwalten (CRUD)
- Rule Types:
  - `required` - Feld muss vorhanden sein
  - `format` - Regex Pattern
  - `enum` - Erlaubte Werte
  - `min_length` / `max_length`
  - `custom` - Custom LLM Validation Prompt
- Pro Spalte aktivieren/deaktivieren

#### Settings
- API Keys (verschlüsselt in Supabase)
- Default Prompts
- Export Templates
- User Management (Supabase Auth)

### 7.2 UX Prinzipien

- **Progressive Disclosure:** Komplexität nur wenn nötig
- **Transparency:** Immer sichtbar was das LLM gemacht hat
- **Undo:** Änderungen rückgängig machbar (via processing_logs)
- **Batch vs. Single:** Beide Modi unterstützen

---

## 8. API Design

### 8.1 Endpoints

```
POST   /api/imports              # CSV Upload + Import starten
GET    /api/imports              # Liste aller Imports
GET    /api/imports/:id          # Import Details + Stats
POST   /api/imports/:id/process  # Pipeline starten/fortsetzen

GET    /api/companies            # Companies Liste (paginated)
GET    /api/companies/:id        # Company Details
PATCH  /api/companies/:id        # Company manuell updaten
DELETE /api/companies/:id        # Company löschen
POST   /api/companies/export     # Export (CSV/JSON)

GET    /api/rules                # Alle Rules
POST   /api/rules                # Rule erstellen
PATCH  /api/rules/:id            # Rule updaten
DELETE /api/rules/:id            # Rule löschen

GET    /api/prompts              # Alle Prompts
PATCH  /api/prompts/:id          # Prompt updaten

POST   /api/pipeline/test        # Test-Run mit Sample
```

### 8.2 Vercel Serverless Considerations

- **Timeout:** Max 60s (Pro) / 10s (Hobby)
- **Lösung für lange Jobs:** 
  - Supabase Edge Functions für Background Processing
  - Oder: Vercel Cron Jobs
  - Oder: Streaming Response mit Progress Updates

---

## 9. Duplikat-Handling

### 9.1 Prinzip

**Duplikate werden übersprungen, nicht überschrieben.**

### 9.2 Implementierung

1. **Company Hash berechnen:** `hash(domain)` oder `hash(name)` falls keine Website
2. **Check vor Insert:** `SELECT EXISTS(... WHERE company_hash = ?)`
3. **Bei Duplikat:** 
   - Zeile überspringen
   - `skipped_count` in Import erhöhen
   - Optional: In Log vermerken

### 9.3 Deduplizierung innerhalb CSV

Bei mehreren Einträgen mit gleichem Hash in einer CSV:
- **Neuester gewinnt** (basierend auf Datum-Spalte falls vorhanden)
- Oder: **Erster gewinnt** (Reihenfolge in CSV)

---

## 10. Projektstruktur

```
supplier_tool/
├── docs/
│   └── REQUIREMENTS.md          # Dieses Dokument
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── page.tsx             # Dashboard
│   │   ├── imports/
│   │   ├── companies/
│   │   ├── pipeline/
│   │   ├── rules/
│   │   ├── settings/
│   │   └── api/                 # API Routes
│   ├── components/              # React Components
│   ├── lib/
│   │   ├── supabase/            # Supabase Client + Auth
│   │   ├── llm/                 # OpenAI, Perplexity Clients
│   │   ├── pipeline/            # Pipeline Logic
│   │   └── utils/               # Helpers (domain extraction, etc.)
│   └── types/                   # TypeScript Types
├── supabase/
│   └── migrations/              # SQL Migrations
├── prompts/                     # Default Prompt Templates (migriert)
│   ├── understand.txt
│   ├── clean.txt
│   ├── research_address.txt
│   └── research_description.txt
├── .env                         # Local Env (gitignored)
├── .env.example                 # Template
└── package.json
```

---

## 11. Milestones

### Phase 1: Foundation
- [ ] Supabase Schema Setup (Migration)
- [ ] Next.js Boilerplate mit Supabase Auth
- [ ] Basic UI Layout (Sidebar, Navigation)
- [ ] CSV Upload + Parsing

### Phase 2: Core Pipeline
- [ ] Schema Mapping UI (UNDERSTAND)
- [ ] Domain-Extraktion + Deduplizierung
- [ ] Data Cleaning (OpenAI Integration)
- [ ] Prompts aus wonnda_archive migrieren

### Phase 3: Research & Validation
- [ ] Perplexity Integration (RESEARCH)
- [ ] Column Rules System
- [ ] Validation Step

### Phase 4: UI Polish
- [ ] Companies Browser mit Filter/Suche
- [ ] Pipeline Editor
- [ ] Rules Management UI
- [ ] Prompts Editor

### Phase 5: Production Ready
- [ ] Error Handling + Retry Logic
- [ ] Logging (processing_logs)
- [ ] Background Job Handling
- [ ] Documentation

---

## 12. Entscheidungen

| Frage | Entscheidung | Begründung |
|-------|--------------|------------|
| Auth | Supabase Auth | Standard, bereits integriert |
| Historisierung | Nein | Nicht benötigt, Duplikate überspringen |
| Layer-Architektur | Vereinfacht (2 Tabellen) | Keine komplexe DWH-Struktur nötig |
| LLM für Dedupe | Nein | Deterministisch via Domain-Hash |
| Kosten-Tracking | Optional | Cents pro Import, nicht kritisch |
