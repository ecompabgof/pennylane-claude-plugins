---
name: pennylane-achats
description: Mode d'emploi des outils Pennylane Achats (fournisseurs, factures fournisseurs, demandes d'achat). À utiliser pour enregistrer une facture fournisseur, importer un PDF avec OCR, suivre un paiement fournisseur, gérer les fournisseurs, ou toute question sur le cycle d'achat dans Pennylane.
---

# Pennylane — Achats

Outils du cycle d'achat : fournisseurs, factures fournisseurs, demandes d'achat.

## Règles Pennylane (IMPÉRATIF)
- **Montants = chaînes** : `"120.00"`.
- **Import idempotent** sur `file_attachment_id` (erreur 409 si réutilisé).
- L'**OCR Pennylane** remplit automatiquement les factures fournisseurs importées en PDF.

## Tâches courantes
- **Importer une facture (OCR auto)** : `supplier_invoice_import_pdf` (upload + OCR + création). Les métadonnées passées surchargent l'OCR.
- **Valider la compta** : `supplier_invoice_validate_accounting`.
- **Suivre le paiement** : `supplier_invoice_payment_status_update`, `supplier_invoice_payments_list`.
- **Rapprocher** : `supplier_invoice_match_transaction`, `supplier_invoice_matched_transactions_list`.
- **Fournisseurs** : `suppliers_list`, `supplier_get` / `supplier_create` / `supplier_update`, catégories `supplier_categories_list` / `supplier_categories_set`.
- **Demandes d'achat** : `purchase_requests_list`, `purchase_request_get` (lecture seule en v2).

## Pagination
Listes : `{ items, has_more, next_cursor }` → `page[after]=<next_cursor>` tant que `has_more`.

## Si un outil manque
`pennylane_docs_search` ou `pennylane_raw_request`.
