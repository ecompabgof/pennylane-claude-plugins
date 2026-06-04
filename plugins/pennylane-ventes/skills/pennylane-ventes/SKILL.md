---
name: pennylane-ventes
description: Mode d'emploi des outils Pennylane Ventes (clients, factures clients, devis, produits, documents commerciaux). À utiliser pour facturer un client, relancer un impayé, créer ou suivre un devis, gérer le catalogue produits, ou toute question sur le cycle de vente dans Pennylane.
---

# Pennylane — Ventes

Outils du cycle de vente : clients, factures clients, devis, produits, documents commerciaux.

## Règles Pennylane à respecter (IMPÉRATIF)
- **Montants = chaînes de caractères** : `"120.00"`, jamais le nombre `120.00`.
- **Codes TVA FR** : `FR_200` (20 %), `FR_100` (10 %), `FR_55` (5,5 %), `FR_21` (2,1 %), `FR_00` (0 %).
- Une facture suit les statuts **draft → finalized → paid**. Seules les `finalized` sont envoyables / relançables.
- Création client : routée sur le type via `customer_type` (`company` ou `individual`).

## Tâches courantes
- **Facturer** : `customer_invoice_create` (Pennylane génère le PDF). Corps : `customer_id`, `date`, `deadline`, `invoice_lines[{label, quantity, unit, raw_currency_unit_price, vat_rate}]`.
- **Finaliser puis envoyer** : `customer_invoice_finalize` → `customer_invoice_send_by_email`.
- **Importer un PDF existant** : `customer_invoice_import_pdf` (upload + création).
- **Relancer les impayés** : `customer_invoices_list` filtré `status=finalized` + `deadline < aujourd'hui`, puis traiter par client.
- **Devis** : `quote_create` → `quote_send_by_email` → `quote_update_status` ; convertir : `customer_invoice_from_quote`.
- **Encaissement** : `customer_invoice_payments_list`, `customer_invoice_matched_transactions_list`.

## Pagination
Les listes renvoient `{ items, has_more, next_cursor }`. Répéter l'appel avec `page[after]=<next_cursor>` tant que `has_more` est vrai.

## Si un outil semble manquer
`pennylane_docs_search` (retrouver la bonne route/payload) ou `pennylane_raw_request` (échappatoire vers n'importe quel endpoint).
