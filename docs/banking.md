# Banque & Transactions — Référence API Pennylane v2

## 1. Bank Accounts

| Méthode | Endpoint | Scope |
|---------|----------|-------|
| GET | `/bank_establishments` | `bank_accounts:readonly` |
| GET | `/bank_accounts` | `bank_accounts:readonly` |
| GET | `/bank_accounts/{id}` | `bank_accounts:readonly` |
| POST | `/bank_accounts` | `bank_accounts:readonly` |

## 2. Transactions

| Méthode | Endpoint | Description | Scope |
|---------|----------|-------------|-------|
| GET | `/transactions` | Lister | `transactions:readonly` |
| GET | `/transactions/{id}` | Récupérer | `transactions:readonly` |
| GET | `/transactions/{id}/matched_invoices` | Factures rapprochées | `transactions:readonly` |
| GET | `/transactions/{id}/categories` | Catégories | `transactions:readonly` |
| POST | `/transactions` | Créer manuellement | `transactions:readonly` |
| PUT | `/transactions/{id}` | Mettre à jour | `transactions:readonly` |
| PUT | `/transactions/{id}/categories` | Catégoriser | `categories:all` |

## 3. Rapprochement (Matching)

```bash
POST /customer_invoices/{id}/matched_transactions
{"transaction_id": 456}

POST /supplier_invoices/{id}/matched_transactions
{"transaction_id": 456}

DELETE /customer_invoices/{id}/matched_transactions/{transaction_id}
DELETE /supplier_invoices/{id}/matched_transactions/{transaction_id}
```

**Payment vs Matched Transaction** :
- **Payment** : enregistrement du paiement côté facture
- **Matched Transaction** : lien transaction bancaire ↔ facture pour rapprochement comptable
