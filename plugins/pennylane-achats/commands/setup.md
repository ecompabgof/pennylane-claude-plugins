---
description: Enregistrer la clé API Pennylane (une seule fois) — Claude la sauvegarde dans settings.json pour tous les plugins Pennylane.
---

# Configurer la clé Pennylane

But : enregistrer la clé API Pennylane de l'utilisateur **une seule fois**, dans `~/.claude/settings.json`, pour que **tous les plugins Pennylane** l'utilisent automatiquement ensuite.

Procédure à suivre :

1. **Demande la clé** : « Colle ta clé API Pennylane (Pennylane → Paramètres → API). » Attends la réponse de l'utilisateur.

2. **Enregistre-la** sans écraser les autres réglages. Exécute cette commande en remplaçant `COLLER_LA_CLE` par la clé fournie (elle passe par une variable d'environnement pour ne pas l'étaler dans le code) :

```bash
__PENNY_TOK="COLLER_LA_CLE" node -e '
const fs=require("fs"),os=require("os"),p=require("path");
const f=p.join(os.homedir(),".claude","settings.json");
let s={}; try{ s=JSON.parse(fs.readFileSync(f,"utf8")); }catch{}
s.env = s.env || {};
s.env.PENNYLANE_API_TOKEN = process.env.__PENNY_TOK;
fs.mkdirSync(p.dirname(f), {recursive:true});
fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");
console.log("Cle Pennylane enregistree dans " + f);
'
```

3. **Confirme** : « C'est enregistré ✅. Redémarre Claude (ou recharge les serveurs MCP) pour activer les outils Pennylane. »

Règles importantes :
- N'écris la clé **nulle part ailleurs** que dans `~/.claude/settings.json`.
- **Ne répète jamais la clé en clair** dans ta réponse, ne la mets pas dans un log.
- Si la clé fournie est vide, redemande-la.
