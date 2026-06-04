# Autres Endpoints — Référence API Pennylane v2

## 1. Mandats SEPA

| Méthode | Endpoint | Scope |
|---------|----------|-------|
| GET | `/sepa_mandates` | `customer_mandates:readonly` |
| GET | `/sepa_mandates/{id}` | `customer_mandates:readonly` |
| POST | `/sepa_mandates` | `customer_mandates:all` |
| PUT | `/sepa_mandates/{id}` | `customer_mandates:all` |
| DELETE | `/sepa_mandates/{id}` | `customer_mandates:all` |
| GET | `/gocardless_mandates` | `customer_mandates:readonly` |
| GET | `/gocardless_mandates/{id}` | `customer_mandates:readonly` |
| POST | `/gocardless_mandates/{id}/mail_requests` | `customer_mandates:all` |
| POST | `/gocardless_mandates/{id}/associations` | `customer_mandates:all` |
| POST | `/gocardless_mandates/{id}/cancellations` | `customer_mandates:all` |

## 2. Billing Subscriptions (Abonnements)

| Méthode | Endpoint | Scope |
|---------|----------|-------|
| GET | `/billing_subscriptions` | `billing_subscriptions:readonly` |
| GET | `/billing_subscriptions/{id}` | `billing_subscriptions:readonly` |
| POST | `/billing_subscriptions` | `billing_subscriptions:all` |
| PUT | `/billing_subscriptions/{id}` | `billing_subscriptions:all` |
| GET | `/billing_subscriptions/{id}/invoice_lines` | `billing_subscriptions:readonly` |
| GET | `/billing_subscriptions/{id}/invoice_line_sections` | `billing_subscriptions:readonly` |

## 3. Categories (Analytique)

| GET | `/category_groups` | `categories:readonly` |
| GET | `/category_groups/{id}` | `categories:readonly` |
| GET | `/categories` | `categories:readonly` |
| GET | `/categories/{id}` | `categories:readonly` |
| GET | `/category_groups/{id}/categories` | `categories:readonly` |
| POST | `/categories` | `categories:all` |
| PUT | `/categories/{id}` | `categories:all` |

## 4. File Attachments

```bash
POST /file_attachments  # multipart/form-data, scope: file_attachments:all
POST /ledger_attachments  # pour écritures comptables
```

## 5. E-Invoices

POST `/e-invoices/imports` → **DEPRECATED**. Utiliser :
- `POST /customer_invoices/{id}/e_invoice_import`
- `POST /supplier_invoices/{id}/e_invoice_import`

## 6. Changelogs

| GET `/customer_invoices/changes` | GET `/supplier_invoices/changes` |
| GET `/customers/changes` | GET `/suppliers/changes` |
| GET `/products/changes` | GET `/ledger_entry_lines/changes` |
| GET `/transactions/changes` | GET `/quotes/changes` |

## 7. Users

| GET | `/me` | Aucun scope requis |
