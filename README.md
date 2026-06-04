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

Puis configurer la clé Pennylane **en une commande** :

```
/pennylane-full:setup
```

Claude demande la clé (Pennylane → Paramètres → API) et l'**enregistre tout seul** dans `~/.claude/settings.json`. Une seule fois — ensuite tous les plugins Pennylane l'utilisent. *(La commande `:setup` existe dans chaque plugin, ex. `/pennylane-ventes:setup`.)*

Variante manuelle : ajouter `{ "env": { "PENNYLANE_API_TOKEN": "la_clé" } }` dans `~/.claude/settings.json`.

⚠️ **Claude Desktop** : environnement isolé → la clé doit être dans le fichier de config (pas dans le terminal).

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
