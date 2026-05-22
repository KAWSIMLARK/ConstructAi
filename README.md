# ConstructAi

Assistant expert en construction pour le Québec et le Canada — interface conversationnelle similaire à Claude/ChatGPT.

## Fonctionnalités

- Interface chat en temps réel (streaming SSE)
- Expertise CNB 2025, CNÉB 2025, CNP 2025, CNPI 2025, CCQ, Code civil du Québec
- Historique des conversations (localStorage)
- Rendu Markdown avec coloration syntaxique
- Thème sombre, accent ambré (orange construction)
- Responsive (mobile + desktop)
- Prompt caching (réduction des coûts API)

## Installation

```bash
npm install
cp .env.example .env
# Ajouter votre clé API Anthropic dans .env
```

## Démarrage

```bash
npm start       # production
npm run dev     # développement (rechargement auto)
```

Ouvrir http://localhost:3000

## Configuration

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (obligatoire) |
| `PORT` | Port du serveur (défaut : 3000) |

## Architecture

```
├── server.js          # Backend Express + API Anthropic (SSE)
├── public/
│   ├── index.html     # Interface
│   ├── style.css      # Thème dark
│   └── app.js         # Logique frontend
└── .env               # Variables d'environnement (non versionné)
```

## Modèle utilisé

`claude-sonnet-4-6` avec prompt caching sur le system prompt.
