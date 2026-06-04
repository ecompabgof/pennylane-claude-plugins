---
name: pennylane-api
description: "Intégration API Pennylane v2 : comptabilité, facturation et gestion financière française. Utilise ce skill quand l'utilisateur mentionne Pennylane ou veut créer/importer/lister des factures clients ou fournisseurs, gérer des écritures comptables, exporter un FEC, créer des devis, gérer transactions bancaires, mandats SEPA, abonnements. Aussi pour construire une intégration Pennylane (n8n/Make/Python/Node.js/curl) ou automatiser la comptabilité. Couvre : produits, catégories analytiques, pièces jointes, e-invoices, changelogs, rapprochement bancaire, migration v1-v2. Utilise aussi si le contexte implique une API de comptabilité française (factures, écritures OD, FEC, plan comptable)."
---

# Pennylane API v2 — Skill Complet

## Vue d'ensemble

Pennylane est le logiciel comptable français de référence (SaaS). Son API REST v2 permet d'automatiser la facturation, la comptabilité, le rapprochement bancaire, et les exports fiscaux.

- **Base URL** : `https://app.pennylane.com/api/external/v2`
- **Auth** : `Authorization: Bearer <TOKEN>`
- **Format** : JSON. **Montants TOUJOURS en strings** (ex: `"120.00"` pas `120.00`)
- **Pagination** : Cursor-based (`page[size]`, `page[after]`)
- **Rate limit** : HTTP 429 si dépassé. Header `X-Use-2026-API-Changes: true` pour les nouvelles fonctionnalités 2026.
- **Docs officiels** : https://pennylane.readme.io/reference

---

## Authentification

3 méthodes selon le rôle :

| Rôle | Méthode | Usage |
|------|---------|-------|
| **Entreprise** | Company API Token | Accès 1 société, généré dans Pennylane > Paramètres |
| **Cabinet comptable** | Firm API Token | Multi-sociétés, généré depuis le compte cabinet |
| **Intégrateur/Partenaire** | OAuth 2.0 | **Requis en production Marketplace** |

### Vérification rapide
```bash
curl https://app.pennylane.com/api/external/v2/me \
  -H "Authorization: Bearer <TOKEN>"
# → {id, email, role, scopes}
```

### OAuth 2.0 (intégrateurs)
1. Enregistrer l'app auprès de partnerships@pennylane.com
2. Rediriger l'utilisateur : `https://app.pennylane.com/oauth/authorize?client_id=...&redirect_uri=...&scope=...&response_type=code&state=...`
3. Échanger le code : `POST https://app.pennylane.com/oauth/token` avec `grant_type=authorization_code`
4. Refresh : `POST /oauth/token` avec `grant_type=refresh_token`

---

## Scopes (Permissions)

Format : `resource:readonly` (GET) ou `resource:all` (CRUD). Si scope manquant → `403 Forbidden`.

### Ventes (Sales)
| Scope | Description |
|-------|-------------|
| `customers:all` | Créer, modifier, consulter clients (entreprise + particulier) |
| `customer_invoices:all` | Factures clients : créer, importer, envoyer, rapprocher |
| `products:all` | Catalogue produits |
| `quotes:all` | Devis : créer, modifier, envoyer, convertir en facture |
| `e_invoices:all` | Importer des e-factures (Factur-X, etc.) |
| `billing_subscriptions:all` | Abonnements récurrents |
| `commercial_documents:all` | Documents commerciaux |
| `customer_mandates:all` | Mandats SEPA / GoCardless |

### Achats (Purchases)
| `suppliers:all` | Fournisseurs |
| `supplier_invoices:all` | Factures fournisseurs : importer, valider, rapprocher |

### Comptabilité
| `ledger` | Journaux, écritures, plan comptable, pièces jointes |
| `trial_balance:readonly` | Balance des comptes |
| `exports:fec` | Export FEC (Fichier des Écritures Comptables) |
| `exports:agl` | Export Grand Livre Analytique |
| `fiscal_years:readonly` | Exercices comptables |

### Autres
| `categories:all` | Catégories analytiques |
| `transactions:readonly` | Transactions bancaires |
| `bank_accounts:readonly` | Comptes bancaires |
| `file_attachments:all` | Upload de fichiers (PDF, images) |

**⚠️ Migration 2026** : le scope `ledger` est en cours de dépréciation au profit de scopes plus granulaires. Deadline : 1er juillet 2026.

---

## Codes HTTP & Gestion d'erreurs

| Code | Signification | Action |
|------|--------------|--------|
| 200 | Succès | — |
| 201 | Ressource créée | — |
| 204 | Succès sans body (ex: envoi email) | — |
| 400 | Payload invalide | Vérifier JSON, types, montants en strings |
| 401 | Token invalide/manquant/expiré | Régénérer ou refresh le token |
| 403 | Scope insuffisant | Ajouter le scope manquant au token |
| 404 | Ressource introuvable | Vérifier l'ID et l'endpoint |
| 409 | Conflit (PDF déjà importé) | Éviter les doublons de `file_attachment_id` |
| 422 | Validation métier échouée | **Inspecter `details`** dans la réponse |
| 429 | Rate limit | Implémenter un retry avec backoff |

### Structure d'erreur
```json
{
  "error": "unprocessable_entity",
  "message": "Missing required field: customer_id",
  "details": {"field": "customer_id", "issue": "is required"}
}
```

---

## Pagination (cursor-based)

Toutes les listes utilisent la pagination par curseur :

```bash
# Première page
GET /customer_invoices?page[size]=25

# Pages suivantes (tant que pagination.after != null)
GET /customer_invoices?page[size]=25&page[after]=<cursor>
```

Pattern de boucle :
```python
cursor = None
while True:
    params = {"page[size]": 25}
    if cursor:
        params["page[after]"] = cursor
    response = requests.get(url, headers=headers, params=params)
    data = response.json()
    process(data["data"])  # ou data directement selon l'endpoint
    cursor = data.get("pagination", {}).get("after")
    if not cursor:
        break
```

---

## Filtres

Les endpoints de liste acceptent un paramètre `filter` en JSON :

```
GET /customer_invoices?filter=[{"field":"status","operator":"eq","value":"finalized"}]
```

| Opérateur | Description |
|-----------|-------------|
| `eq` | Égal à |
| `not_eq` | Différent de |
| `gt` / `gte` | Supérieur / supérieur ou égal |
| `lt` / `lte` | Inférieur / inférieur ou égal |
| `start_with` | Commence par (utile pour n° de compte) |
| `in` / `not_in` | Dans / pas dans une liste |

---

## Référence API par domaine

**Consulter le fichier de référence approprié AVANT de coder un appel API.**

| Fichier | Contenu |
|---------|---------|
| `references/customer-invoices.md` | Factures clients (create, import, finalize, send), produits, templates, clients (company/individual) — avec schemas OpenAPI détaillés |
| `references/supplier-invoices.md` | Factures fournisseurs (import PDF + OCR), demandes d'achat, fournisseurs |
| `references/accounting.md` | Journaux, plan comptable, écritures (ledger entries), lettrage, balance, exercices, exports FEC/AGL |
| `references/quotes-commercial.md` | Devis (create → send → convert to invoice), documents commerciaux |
| `references/banking.md` | Comptes bancaires, transactions, rapprochement facture↔transaction |
| `references/other.md` | Mandats SEPA/GoCardless, abonnements, catégories analytiques, fichiers, e-invoices, changelogs, users |

---

## Patterns les plus courants

### 1. Créer une facture client (données structurées)
```bash
POST /customer_invoices
{
  "customer_id": 123,
  "date": "2025-10-01",
  "deadline": "2025-10-31",
  "invoice_lines": [{
    "label": "Prestation conseil IA",
    "quantity": 2,
    "unit": "hour",
    "raw_currency_unit_price": "150.00",
    "vat_rate": "FR_200"
  }],
  "external_reference": "INV-2025-001"
}
```
→ Pennylane génère le PDF avec le template configuré.

### 2. Importer une facture avec PDF existant
```bash
# Étape 1 : Upload du fichier
POST /file_attachments (multipart/form-data, field: file)
# → {"id": 42}

# Étape 2 : Import client
POST /customer_invoices/import
{
  "file_attachment_id": 42,
  "date": "2025-10-01",
  "deadline": "2025-10-31",
  "customer_id": 123,
  "currency_amount_before_tax": "1000.00",
  "currency_amount": "1200.00",
  "currency_tax": "200.00",
  "invoice_lines": [{
    "currency_amount": "1200.00",
    "currency_tax": "200.00",
    "quantity": 1,
    "raw_currency_unit_price": "1000.00",
    "unit": "piece",
    "vat_rate": "FR_200"
  }]
}

# Ou import fournisseur (Pennylane fait l'OCR)
POST /supplier_invoices/import
{"file_attachment_id": 42}
```

### 3. Créer une écriture comptable (OD)
```bash
POST /ledger_entries
{
  "journal_id": 1,
  "date": "2025-10-01",
  "ledger_entry_lines": [
    {"ledger_account_id": 10, "debit": "1000.00", "credit": "0.00", "label": "Client ACME"},
    {"ledger_account_id": 20, "debit": "0.00", "credit": "1000.00", "label": "Prestation"}
  ]
}
```
**⚠️ Total débits DOIT = total crédits**, sinon → 422.

### 4. Rapprocher facture ↔ transaction bancaire
```bash
POST /customer_invoices/{id}/matched_transactions
{"transaction_id": 456}
```

### 5. Devis → Facture
```bash
POST /quotes  # créer le devis
PUT /quotes/{id}/status  # valider
POST /customer_invoices/from_quote  # convertir en facture
```

### 6. Export FEC (asynchrone)
```bash
POST /exports/fec  # lance l'export → retourne un ID
GET /exports/fec/{id}  # polling jusqu'à ce que le fichier soit prêt
```

### 7. Sync incrémentale via Changelogs
```bash
GET /customer_invoices/changes?filter=[{"field":"updated_at","operator":"gt","value":"2025-10-01T00:00:00Z"}]
```

---

## Règles critiques à retenir

1. **Montants = strings** : `"120.00"` jamais `120.00`
2. **IDs spécifiques par société** : customer_id, product_id, ledger_account_id changent d'une entreprise à l'autre
3. **Import vs Create** : Import = PDF existant (OCR). Create = données structurées (Pennylane génère le PDF).
4. **Idempotence limitée** : seul l'import fournisseur vérifie les doublons. Utiliser `external_reference` côté client.
5. **Écritures équilibrées** : total débit = total crédit obligatoire
6. **Sandbox** : toujours tester en sandbox avant production
7. **TVA française** : `FR_200` (20%), `FR_100` (10%), `FR_55` (5.5%), `FR_21` (2.1%), `FR_00` (0%). Codes européens aussi supportés.
8. **Prix unitaire** : `raw_currency_unit_price` accepte jusqu'à 6 décimales
9. **Rounding policy** : tolérance de 1€ max entre total et somme des lignes pour l'import
10. **2026 migration** : utiliser le header `X-Use-2026-API-Changes: true` pour tester les nouveaux comportements
