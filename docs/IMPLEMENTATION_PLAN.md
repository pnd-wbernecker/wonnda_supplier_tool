# Supplier Tool - Implementation Plan

## Projekt-Info

- **Supabase Project ID:** `kistelccwdbhdedefpja`
- **Supabase URL:** `https://kistelccwdbhdedefpja.supabase.co`
- **Tech Stack:** Next.js + TypeScript + Tailwind + Supabase
- **Requirements:** Siehe `docs/REQUIREMENTS.md`

---

## Phase 1: Foundation

### 1.1 Supabase Schema ⬜
```sql
-- Tabellen erstellen:
- companies (Haupttabelle mit festem Schema)
- imports (Import-Tracking)
- column_rules (Validierungsregeln)
- prompts (LLM Prompt Templates)
- processing_logs (Audit Trail)
```

### 1.2 Next.js Setup ⬜
- [ ] `npx create-next-app@latest` mit TypeScript, Tailwind, App Router
- [ ] Supabase Client Setup (`@supabase/supabase-js`)
- [ ] Environment Variables konfigurieren
- [ ] Basis-Layout (Sidebar Navigation)

### 1.3 Supabase Auth ⬜
- [ ] Auth Provider in Layout
- [ ] Login/Logout Pages
- [ ] Protected Routes Middleware

### 1.4 Basic Pages ⬜
- [ ] `/` - Dashboard (Placeholder)
- [ ] `/imports` - Import-Liste
- [ ] `/companies` - Companies-Liste
- [ ] `/pipeline` - Pipeline-Konfiguration
- [ ] `/rules` - Rules-Management
- [ ] `/settings` - Settings

---

## Phase 2: CSV Import

### 2.1 Upload Component ⬜
- [ ] Drag & Drop Upload Zone
- [ ] CSV Parsing (papaparse)
- [ ] Preview der ersten Zeilen
- [ ] Upload zu Supabase Storage oder direkt parsen

### 2.2 Schema Mapping UI ⬜
- [ ] Source-Spalten anzeigen
- [ ] Target-Spalten (festes Schema) anzeigen
- [ ] Drag & Drop oder Dropdown Mapping
- [ ] LLM-Vorschlag für Mapping (UNDERSTAND Step)
- [ ] Mapping speichern & bestätigen

### 2.3 Import Processing ⬜
- [ ] Domain-Extraktion aus Website
- [ ] Company Hash berechnen
- [ ] Duplikat-Check gegen Supabase
- [ ] Insert neue Companies (status: "pending")
- [ ] Import-Stats aktualisieren (processed, skipped)

---

## Phase 3: LLM Pipeline

### 3.1 OpenAI Integration ⬜
- [ ] OpenAI Client Setup
- [ ] Structured Output mit Zod Schema
- [ ] Rate Limiting / Retry Logic

### 3.2 Perplexity Integration ⬜
- [ ] Perplexity Client Setup
- [ ] Domain Filter für Suche
- [ ] Response Parsing

### 3.3 CLEAN Step ⬜
- [ ] Prompt aus wonnda_archive migrieren (`enrich_companies.txt`)
- [ ] Batch-Verarbeitung (10-25 Companies)
- [ ] `formatted_name`, `formatted_address` generieren
- [ ] `company_type` klassifizieren (seller/buyer)
- [ ] `enriched_description` erstellen

### 3.4 RESEARCH Step ⬜
- [ ] Prompt migrieren (`retrieve_address.txt`)
- [ ] Prompt migrieren (`create_description.txt`)
- [ ] Nur bei fehlenden Feldern aufrufen
- [ ] Source URLs speichern in `enrichment_sources`

### 3.5 VALIDATE Step ⬜
- [ ] Column Rules aus DB laden
- [ ] Jede Spalte gegen Rules prüfen
- [ ] Status auf "validated" oder zurück zu CLEAN/RESEARCH

---

## Phase 4: Companies Management

### 4.1 Companies List ⬜
- [ ] Tabellen-Ansicht mit Pagination
- [ ] Suche (Name, Domain)
- [ ] Filter (Status, Import, Company Type)
- [ ] Sortierung

### 4.2 Company Detail ⬜
- [ ] Alle Felder anzeigen
- [ ] Edit-Modus
- [ ] Processing Logs anzeigen
- [ ] Re-Process Button

### 4.3 Bulk Actions ⬜
- [ ] Multi-Select
- [ ] Bulk Delete
- [ ] Bulk Re-Process
- [ ] Export (CSV, JSON)

---

## Phase 5: Configuration UI

### 5.1 Pipeline Editor ⬜
- [ ] Steps aktivieren/deaktivieren
- [ ] Step-Reihenfolge (optional)
- [ ] Test-Run mit Sample Data

### 5.2 Prompts Editor ⬜
- [ ] Liste aller Prompts
- [ ] Inline Editing
- [ ] Platzhalter-Dokumentation
- [ ] Reset to Default

### 5.3 Rules Management ⬜
- [ ] CRUD für Column Rules
- [ ] Rule Types: required, format (regex), enum, min/max length
- [ ] Custom LLM Validation Prompt
- [ ] Test Rule gegen Sample Data

---

## Phase 6: Polish & Production

### 6.1 Error Handling ⬜
- [ ] API Error Boundaries
- [ ] Toast Notifications
- [ ] Retry Logic für LLM Calls

### 6.2 Background Jobs ⬜
- [ ] Lange Imports im Hintergrund
- [ ] Progress Updates (Polling oder Realtime)
- [ ] Job Queue (Supabase Edge Functions?)

### 6.3 Performance ⬜
- [ ] Pagination überall
- [ ] Optimistic Updates
- [ ] Caching wo sinnvoll

### 6.4 Documentation ⬜
- [ ] README.md aktualisieren
- [ ] API Docs
- [ ] User Guide

---

## Prompts zu migrieren

### Von wonnda_archive:

**1. enrich_companies.txt (CLEAN Step)**
- Input: Batch von Companies als JSON
- Output: formatted_company_name, formatted_address, determined_company_type1, enriched_description

**2. retrieve_address.txt (RESEARCH Step)**
- Input: company_name, domain, country
- Output: Google Maps-kompatible Adresse
- Guardrail: Domain-Filter, explicit null bei nicht gefunden

**3. create_description.txt (RESEARCH Step)**
- Input: company_name, domain
- Output: 150 Wörter Beschreibung
- Guardrail: Domain-Filter

---

## Wichtige Logik zu migrieren

### Domain-Extraktion
```typescript
// Aus Website URL die Domain extrahieren
// "https://www.acme.com/about" → "acme.com"
function extractDomain(website: string): string {
  return new URL(website).hostname.replace(/^www\./, '');
}
```

### Company Hash
```typescript
// Eindeutige ID aus Domain (oder Name falls keine Website)
function computeCompanyHash(domain: string | null, name: string): string {
  const input = domain || name;
  // Simple hash oder crypto.subtle.digest
}
```

### E-Mail Blacklist
```typescript
const PRIVATE_EMAIL_PROVIDERS = [
  'gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 
  'icloud', 'proton', 'zoho', 'yandex', 'mail', 
  'gmx', 'live', 'msn', 'inbox', 'rediff'
];

function isBusinessEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return !PRIVATE_EMAIL_PROVIDERS.some(p => domain?.includes(p));
}
```

---

## Aktueller Status

**Zuletzt abgeschlossen:** Requirements dokumentiert
**Aktuell in Arbeit:** -
**Nächster Schritt:** Phase 1.1 - Supabase Schema erstellen
