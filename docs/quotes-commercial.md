# Devis & Documents Commerciaux — Référence API Pennylane v2

## 1. Quotes (Devis)

Base: `/quotes` | Scope: `quotes:all`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/quotes` | Lister les devis |
| GET | `/quotes/{id}` | Récupérer un devis |
| GET | `/quotes/{id}/invoice_lines` | Lignes du devis |
| GET | `/quotes/{id}/invoice_line_sections` | Sections |
| GET | `/quotes/{id}/appendices` | Pièces jointes |
| POST | `/quotes` | Créer un devis |
| POST | `/quotes/{id}/appendices` | Ajouter une pièce jointe |
| POST | `/quotes/{id}/send_by_email` | Envoyer par email |
| PUT | `/quotes/{id}` | Modifier |
| PUT | `/quotes/{id}/status` | Changer le statut (accepté, refusé...) |

### Workflow complet : Devis → Facture

```bash
# 1. Créer le devis
POST /quotes
{
  "customer_id": 123,
  "date": "2025-10-01",
  "deadline": "2025-10-31",
  "invoice_lines": [{
    "label": "Prestation conseil",
    "quantity": 5,
    "unit": "day",
    "raw_currency_unit_price": "800.00",
    "vat_rate": "FR_200"
  }]
}
# → {"id": 789}

# 2. Envoyer au client
POST /quotes/789/send_by_email
{"to": ["client@acme.com"]}

# 3. Marquer comme accepté
PUT /quotes/789/status
{"status": "accepted"}

# 4. Convertir en facture
POST /customer_invoices/from_quote
{"quote_id": 789}
```

---

## 2. Commercial Documents

Base: `/commercial_documents` | Scope: `commercial_documents:all`

Vue unifiée des documents commerciaux (factures + devis).

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/commercial_documents` | Lister |
| GET | `/commercial_documents/{id}` | Récupérer |
| GET | `/commercial_documents/{id}/invoice_lines` | Lignes |
| GET | `/commercial_documents/{id}/invoice_line_sections` | Sections |
| GET | `/commercial_documents/{id}/appendices` | Pièces jointes |
| POST | `/commercial_documents/{id}/appendices` | Ajouter pièce jointe |
