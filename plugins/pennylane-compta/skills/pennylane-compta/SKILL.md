---
name: pennylane-compta
description: Mode d'emploi des outils Pennylane Comptabilité (journaux, écritures, lettrage, plan de comptes, balance, années fiscales, export FEC/AGL). À utiliser pour passer une écriture, lettrer des lignes, consulter la balance, exporter le FEC, ou toute question comptable dans Pennylane.
---

# Pennylane — Comptabilité

## Règles IMPÉRATIVES
- **Montants = chaînes** : `"120.00"`.
- **Écriture équilibrée** : Σ débit = Σ crédit, sinon **erreur 422**.
- **Lettrage** : uniquement des lignes du **même compte**, et le **net doit valoir 0**.

## Tâches courantes
- **Passer une écriture** : `ledger_entry_create` (lignes équilibrées) ; modifier : `ledger_entry_update`.
- **Lettrer** : `ledger_entry_lines_letter` (même compte, net 0) ; délettrer : `ledger_entry_lines_unletter` ; voir : `ledger_entry_line_lettered_lines`.
- **Catégoriser une ligne** : `ledger_entry_line_categories_set`.
- **Plan de comptes** : `ledger_accounts_list`, `ledger_account_get` / `create` / `update`.
- **Journaux** : `journals_list`, `journal_get` / `journal_create`.
- **Balance** : `trial_balance_get`. **Années fiscales** : `fiscal_years_list`.
- **Export FEC** : `fec_export_and_wait` (lance l'export + attend le fichier). **AGL** : `export_agl_create` / `export_agl_get`.

## Pagination
Listes : `{ items, has_more, next_cursor }` → `page[after]=<next_cursor>` tant que `has_more`.

## Si un outil manque
`pennylane_docs_search` ou `pennylane_raw_request`.
