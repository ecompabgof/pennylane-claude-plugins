---
name: pennylane-banque
description: Mode d'emploi des outils Pennylane Banque (comptes bancaires, transactions, rapprochement, mandats SEPA/GoCardless). À utiliser pour consulter des transactions, rapprocher une transaction à une facture, catégoriser, gérer les mandats de prélèvement, ou toute question bancaire dans Pennylane.
---

# Pennylane — Banque

## Tâches courantes
- **Comptes** : `bank_accounts_list`, `bank_account_get`. Établissements : `bank_establishments_list`.
- **Transactions** : `transactions_list` (filtrable), `transaction_get`, `transaction_update`.
- **Rapprocher transaction ↔ facture** : `transaction_matched_invoices_list` ; côté facture : `customer_invoice_match_transaction` / `supplier_invoice_match_transaction`.
- **Catégoriser** : `transaction_categories_list` / `transaction_categories_set`.
- **Mandats de prélèvement** : SEPA `sepa_mandate_*` ; GoCardless `gocardless_mandate_*` (associer, annuler, demander par mail).

## Règles
- **Montants = chaînes** : `"120.00"`.

## Pagination
Listes : `{ items, has_more, next_cursor }` → `page[after]=<next_cursor>` tant que `has_more`.

## Si un outil manque
`pennylane_docs_search` ou `pennylane_raw_request`.
