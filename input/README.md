# Wonnda Company Export

CSV-Export aller Company-Suchen aus der Wonnda-Plattform.

## Datei

`export_All-CompanySearches-modified--_2026-01-16_18-49-18.csv`

- **Zeilen:** 22.381
- **Format:** CSV mit Anführungszeichen

## Spalten

| Spalte | Beschreibung |
|--------|--------------|
| `acceptsStartups` | Ob die Firma mit Startups arbeitet ("yes" / leer) |
| `categories_1` - `categories_4` | Hierarchische Produktkategorien |
| `certifications` | Zertifizierungen (z.B. "bio") |
| `company` | Company ID |
| `company_id` | Company ID (Duplikat) |
| `companyType1` | Primärer Firmentyp (z.B. "seller") |
| `companyType2` | Sekundärer Firmentyp (z.B. "manufacturer", "ingredient_supplier") |
| `continentCode` | Kontinent-Kürzel (eu, na, etc.) |
| `continentName` | Kontinent-Name |
| `countryCode` | Länder-Kürzel (de, us, pt, etc.) |
| `countryName` | Ländername |
| `description` | Firmenbeschreibung (kann mehrzeilig sein) |
| `name` | Firmenname |
| `productionTypes` | Produktionsarten (wholesale, white_label, private_label, custom_development, merchandise) |
| `products` | Produkte (meist leer) |
| `randomScore` | Interner Score |
| `rank` | Ranking |
| `tags` | Komma-getrennte Tags/Keywords |
| `tradeshows` | Messen |
| `website` | Firmen-Website |
| `Creation Date` | Erstellungsdatum |
| `Modified Date` | Änderungsdatum |
| `Slug` | URL-Slug (meist leer) |
| `Creator` | Ersteller (z.B. "App admin") |
| `unique id` | Eindeutige ID |

## Kategorien (Beispiele)

**categories_1:**
- food_beverages
- health_supplements
- pet_supplies
- packaging
- fashion
- home_living

**companyType2:**
- manufacturer
- ingredient_supplier

**productionTypes:**
- wholesale
- white_label
- private_label
- custom_development
- merchandise

## Hinweise

- Die `description`-Spalte kann mehrzeilige Texte enthalten
- Nicht alle Felder sind bei jeder Firma befüllt
- Tags sind durch ` , ` (Leerzeichen-Komma-Leerzeichen) getrennt
