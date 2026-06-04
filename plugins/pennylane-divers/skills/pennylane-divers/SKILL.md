---
name: pennylane-divers
description: Mode d'emploi des outils Pennylane Divers (catégories analytiques, abonnements de facturation récurrente, pièces jointes, recherche dans la doc Pennylane, échappatoire générique). À utiliser pour gérer des catégories analytiques, des abonnements, uploader une pièce jointe, retrouver un endpoint, ou appeler un endpoint non couvert.
---

# Pennylane — Divers

## Outils
- **Catégories analytiques** : `categories_list`, `category_get` / `create` / `update` ; groupes `category_groups_list`, `category_group_get`.
- **Abonnements (facturation récurrente)** : `billing_subscriptions_list`, `billing_subscription_get` / `create` / `update`, lignes `billing_subscription_invoice_lines_list`.
- **Pièces jointes** : `file_attachment_upload`.
- **Identité de la clé API** : `me` (id, email, rôle, scopes).
- **Recherche doc** : `pennylane_docs_search` — retrouver une route, un payload ou un scope **avant** d'appeler.
- **Échappatoire** : `pennylane_raw_request` — appeler n'importe quel endpoint Pennylane non explicitement couvert.

## Règles
- **Montants = chaînes** : `"120.00"`.

## Pagination
Listes : `{ items, has_more, next_cursor }` → `page[after]=<next_cursor>` tant que `has_more`.
