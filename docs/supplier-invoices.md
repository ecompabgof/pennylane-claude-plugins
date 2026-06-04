# Factures Fournisseurs — Référence API Pennylane v2

## Table des matières
1. [Supplier Invoices](#1-supplier-invoices)
2. [Purchase Requests](#2-purchase-requests)
3. [Suppliers](#3-suppliers)

---

## 1. Supplier Invoices

Base: `/supplier_invoices` | Scope: `supplier_invoices:all`

### Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/supplier_invoices` | Lister |
| GET | `/supplier_invoices/{id}` | Récupérer |
| GET | `/supplier_invoices/{id}/invoice_lines` | Lignes |
| GET | `/supplier_invoices/{id}/categories` | Catégories analytiques |
| GET | `/supplier_invoices/{id}/payments` | Paiements |
| GET | `/supplier_invoices/{id}/matched_transactions` | Transactions rapprochées |
| POST | `/supplier_invoices/import` | **Importer avec PDF** (OCR automatique) |
| POST | `/supplier_invoices/{id}/e_invoice_import` | Importer e-facture (scope: `e_invoices:all`) |
| POST | `/supplier_invoices/{id}/linked_purchase_requests` | Lier une demande d'achat |
| PUT | `/supplier_invoices/{id}` | Modifier |
| PUT | `/supplier_invoices/{id}/categories` | Catégoriser (scope: `categories:all`) |
| PUT | `/supplier_invoices/{id}/payment_status` | Modifier le statut de paiement |
| PUT | `/supplier_invoices/{id}/validate_accounting` | Valider la comptabilisation |

### Workflow d'import complet

```bash
# Étape 1 : Upload du fichier PDF
curl -X POST https://app.pennylane.com/api/external/v2/file_attachments \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@facture_fournisseur.pdf"
# → {"id": 42, ...}

# Étape 2 : Import minimal (Pennylane fait l'OCR)
curl -X POST https://app.pennylane.com/api/external/v2/supplier_invoices/import \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"file_attachment_id": 42}'
# → Pennylane extrait automatiquement les données du PDF

# Étape 2 bis : Import avec données pré-remplies
curl -X POST https://app.pennylane.com/api/external/v2/supplier_invoices/import \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "file_attachment_id": 42,
    "date": "2025-10-01",
    "deadline": "2025-10-31",
    "supplier_id": 456,
    "invoice_number": "FA-2025-100",
    "currency_amount": "1200.00",
    "currency_amount_before_tax": "1000.00",
    "currency_tax": "200.00",
    "invoice_lines": [{
      "currency_amount": "1200.00",
      "currency_tax": "200.00",
      "quantity": 1,
      "raw_currency_unit_price": "1000.00",
      "unit": "piece",
      "vat_rate": "FR_200",
      "ledger_account_id": 1255
    }]
  }'
```

**⚠️ Idempotence** : réutiliser le même `file_attachment_id` → erreur **409 Conflict**.

### Valider la comptabilisation

Après import et vérification, valider l'écriture comptable :
```bash
PUT /supplier_invoices/{id}/validate_accounting
```

### Filtres

Champs filtrables : `status`, `date`, `deadline`, `supplier_id`, `external_reference`, `invoice_number`, `paid`, `updated_at`

---

## 2. Purchase Requests (Demandes d'achat)

Base: `/purchase_requests`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/purchase_requests` | Lister |
| GET | `/purchase_requests/{id}` | Récupérer |
| POST | `/purchase_requests/import` | Importer un bon de commande |

Permet de lier un bon de commande à une facture fournisseur pour le contrôle des achats.

---

## 3. Suppliers (Fournisseurs)

Base: `/suppliers` | Scope: `suppliers:all`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/suppliers` | Lister |
| GET | `/suppliers/{id}` | Récupérer |
| POST | `/suppliers` | Créer |
| PUT | `/suppliers/{id}` | Modifier |
| GET | `/suppliers/{id}/categories` | Catégories |
| PUT | `/suppliers/{id}/categories` | Catégoriser |

### Création fournisseur

```json
{
  "name": "Fournisseur XYZ",
  "emails": ["compta@xyz.com"],
  "external_reference": "SUPP-001",
  "reg_no": "987654321",
  "vat_number": "FR98765432100",
  "iban": "FR7612345678901234567890123",
  "address": {
    "address": "10 Rue Industrielle",
    "postal_code": "59000",
    "city": "Lille",
    "country": "FR"
  },
  "payment_conditions": "30_days",
  "phone": "+33320000000"
}
```

### Filtres fournisseurs
```bash
GET /suppliers?filter=[{"field":"name","operator":"start_with","value":"Four"}]
```
