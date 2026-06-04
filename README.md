# Plugins Pennylane pour Claude

6 plugins, **un par thème**. Tu installes seulement ceux dont la cliente a besoin → le robot voit moins d'outils → **moins d'erreurs / d'hallucinations**.

| Plugin | Pour quoi | Outils |
|--------|-----------|--------|
| `pennylane-ventes` | clients, factures clients, devis, produits | 41 |
| `pennylane-achats` | fournisseurs, factures fournisseurs | 26 |
| `pennylane-compta` | journaux, écritures, balance, FEC | 28 |
| `pennylane-banque` | comptes, transactions, mandats SEPA/GoCardless | 22 |
| `pennylane-divers` | catégories, abonnements, pièces jointes, recherche | 17 |
| `pennylane-full` | **TOUT** (l'API v2 complète) | 134 |

## Installer (chez la cliente, dans Claude Code)

```
/plugin marketplace add <url-du-repo>
/plugin install pennylane-ventes@pennylane
```

Puis donner la clé Pennylane : variable `PENNYLANE_API_TOKEN` dans l'environnement (ou Claude la demande au 1er appel).

C'est tout. La cliente a les bons outils Pennylane, **sans rien compiler ni installer de technique**.

## Comment ça marche (en 2 lignes)

- Un seul serveur, empaqueté en **1 fichier autonome** : `pennylane-mcp.bundle.mjs` (aucune dépendance à installer).
- Chaque plugin le lance avec `MCP_DOMAIN=<thème>` → il n'expose que les outils de ce thème. `pennylane-full` = tous les thèmes d'un coup.

## Refaire le bundle après une modif du code

```
npm run build:plugins      # recompile (tsc) + ré-empaquette le bundle en 1 fichier
```

## Garantie « rien oublié »

Le test `src/domains.test.ts` vérifie que les 134 outils se répartissent dans **exactement un** thème — 0 oublié, 0 doublon.
