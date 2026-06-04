# Comptabilité — Référence API Pennylane v2

## Table des matières
1. [Journals](#1-journals)
2. [Ledger Accounts (Plan comptable)](#2-ledger-accounts)
3. [Ledger Entries (Écritures)](#3-ledger-entries)
4. [Ledger Entry Lines](#4-ledger-entry-lines)
5. [Trial Balance](#5-trial-balance)
6. [Fiscal Years](#6-fiscal-years)
7. [Exports (FEC, AGL)](#7-exports)
8. [Ledger Attachments](#8-attachments)

Scope principal : `ledger` (sera remplacé par des scopes granulaires en 2026)

---

## 1. Journals

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/journals` | Lister les journaux |
| GET | `/journals/{id}` | Récupérer un journal |
| POST | `/journals` | Créer un journal |

Journaux types : Achats (HA), Ventes (VE), Banque (BQ), OD (Opérations Diverses), AN (À Nouveau)

---

## 2. Ledger Accounts (Plan comptable)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/ledger_accounts` | Lister les comptes |
| GET | `/ledger_accounts/{id}` | Récupérer un compte |
| POST | `/ledger_accounts` | Créer un compte |
| PUT | `/ledger_accounts/{id}` | Modifier |

### Filtrage par numéro

```bash
# Comptes de ventes de services
GET /ledger_accounts?filter=[{"field":"number","operator":"start_with","value":"706"}]

# Comptes de TVA collectée
GET /ledger_accounts?filter=[{"field":"number","operator":"start_with","value":"4457"}]
```

### Plan Comptable Général français (comptes courants)

| Numéro | Description |
|--------|-------------|
| 101 | Capital |
| 164 | Emprunts |
| 2xx | Immobilisations |
| 401xxx | Fournisseurs |
| 411xxx | Clients |
| 4191 | Clients - Avances reçues |
| 4456 | TVA déductible |
| 44566 | TVA déductible sur autres biens et services |
| 4457 | TVA collectée |
| 44571 | TVA collectée |
| 512xxx | Banques |
| 530 | Caisse |
| 6xx | Charges |
| 601 | Achats de matières premières |
| 606 | Achats non stockés |
| 607 | Achats de marchandises |
| 613 | Locations |
| 616 | Primes d'assurance |
| 622 | Honoraires |
| 625 | Déplacements |
| 626 | Frais postaux et télécoms |
| 627 | Services bancaires |
| 641 | Rémunérations du personnel |
| 645 | Charges de sécurité sociale |
| 7xx | Produits |
| 706 | Prestations de services |
| 707 | Ventes de marchandises |
| 708 | Produits des activités annexes |
| 791 | Transferts de charges |

---

## 3. Ledger Entries (Écritures comptables)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/ledger_entries` | Lister les écritures |
| GET | `/ledger_entries/{id}` | Récupérer une écriture |
| GET | `/ledger_entries/{id}/ledger_entry_lines` | Lignes de l'écriture |
| POST | `/ledger_entries` | Créer une écriture |
| PUT | `/ledger_entries/{id}` | Modifier |

### Créer une écriture (OD)

```json
{
  "journal_id": 1,
  "date": "2025-10-01",
  "deadline": "2025-10-31",
  "ledger_entry_lines": [
    {
      "ledger_account_id": 10,
      "debit": "5000.00",
      "credit": "0.00",
      "label": "Facturation client ACME"
    },
    {
      "ledger_account_id": 20,
      "debit": "0.00",
      "credit": "4166.67",
      "label": "Prestation HT"
    },
    {
      "ledger_account_id": 30,
      "debit": "0.00",
      "credit": "833.33",
      "label": "TVA collectée 20%"
    }
  ]
}
```

**⚠️ RÈGLE ABSOLUE** : `Σ debit == Σ credit`. Si déséquilibre → **422 Unprocessable Entity**.

### Filtres écritures

```bash
# Écritures d'un journal spécifique
GET /ledger_entries?filter=[{"field":"journal_id","operator":"eq","value":1}]

# Écritures d'une période
GET /ledger_entries?filter=[{"field":"date","operator":"gte","value":"2025-01-01"},{"field":"date","operator":"lte","value":"2025-12-31"}]
```

---

## 4. Ledger Entry Lines

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/ledger_entry_lines` | Lister toutes les lignes |
| GET | `/ledger_entry_lines/{id}` | Récupérer une ligne |
| GET | `/ledger_entry_lines/{id}/lettered_ledger_entry_lines` | Lignes lettrées associées |
| GET | `/ledger_entry_lines/{id}/categories` | Catégories analytiques |
| PUT | `/ledger_entry_lines/{id}/categories` | Catégoriser |
| POST | `/ledger_entry_lines/letter` | **Lettrer** des lignes entre elles |
| DELETE | `/ledger_entry_lines/unletter` | Délettrer |

### Lettrage (rapprochement comptable)

Le lettrage relie des lignes d'écritures entre elles (ex: facture ↔ paiement sur le même compte client 411).

```bash
POST /ledger_entry_lines/letter
{
  "ledger_entry_line_ids": [101, 102, 103]
}
```

Toutes les lignes doivent concerner **le même compte** et la **somme nette doit être zéro** (débit - crédit = 0).

---

## 5. Trial Balance

| GET | `/trial_balance` | Scope: `trial_balance:readonly` |

Paramètres de période pour obtenir la balance à une date donnée.

---

## 6. Fiscal Years

| GET | `/company/fiscal_years` | Scope: `fiscal_years:readonly` |

Retourne les exercices comptables avec dates de début/fin.

**⚠️ 2026** : l'ordre par défaut change de `+start` à `-id`. Utiliser `?sort=+start` pour maintenir l'ancien comportement.

---

## 7. Exports

### FEC (Fichier des Écritures Comptables)

Export obligatoire en France pour l'administration fiscale.

```bash
# Lancer l'export (asynchrone)
POST /exports/fec
# → {"id": 123, "status": "pending"}

# Polling jusqu'à completion
GET /exports/fec/123
# → {"id": 123, "status": "completed", "file_url": "https://..."}
```

Scope: `exports:fec`

### Grand Livre Analytique (AGL)

```bash
POST /exports/analytical_general_ledger
GET /exports/analytical_general_ledger/{id}
```

Scope: `exports:agl`

---

## 8. Ledger Attachments

| POST | `/ledger_attachments` | Scope: `file_attachments:all` |

Upload multipart/form-data d'une pièce justificative à associer à une écriture comptable.
