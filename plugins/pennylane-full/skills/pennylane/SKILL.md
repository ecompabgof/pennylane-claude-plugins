---
name: pennylane
description: Mode d'emploi global Pennylane (API v2 complète — ventes, achats, comptabilité, banque, divers — 134 outils). À utiliser pour toute tâche Pennylane : facturer, relancer un impayé, passer une écriture, lettrer, rapprocher en banque, exporter le FEC, ou trouver le bon outil parmi les 134.
---

# Pennylane — Guide global

134 outils couvrant toute l'API v2. Thèmes : **Ventes, Achats, Comptabilité, Banque, Divers**.

## Règles Pennylane IMPÉRATIVES (valables partout)
1. **Montants = chaînes** : `"120.00"`, jamais le nombre `120.00`.
2. **Écritures équilibrées** : Σ débit = Σ crédit (sinon erreur 422).
3. **Import fournisseur idempotent** sur `file_attachment_id` (409 si réutilisé).
4. **Lettrage** : lignes du **même compte**, net = 0.
5. **Codes TVA FR** : `FR_200` (20 %), `FR_100`, `FR_55`, `FR_21`, `FR_00`.

## Trouver le bon outil (préfixes)
- `customer*` / `quote*` / `product*` / `commercial_document*` → **Ventes**
- `supplier*` / `purchase_request*` → **Achats**
- `ledger*` / `journal*` / `trial_balance*` / `fiscal_year*` / `*fec*` / `export_agl*` → **Compta**
- `bank*` / `transaction*` / `sepa*` / `gocardless*` → **Banque**
- `categor*` / `billing_subscription*` / `file_attachment*` / `me` → **Divers**
- Doute → `pennylane_docs_search`. Endpoint manquant → `pennylane_raw_request`.

## Pagination
Listes : `{ items, has_more, next_cursor }` → répéter avec `page[after]=<next_cursor>` tant que `has_more`.

## Exemple : relancer les impayés
`customer_invoices_list` (filtre `status=finalized` + `deadline < aujourd'hui`, paginer jusqu'au bout) → regrouper par client → relancer (ton selon l'ancienneté).
