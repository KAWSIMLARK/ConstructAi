import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `Tu es Concierge Construction, un assistant expert en construction et bâtiment au Québec et au Canada. Tu possèdes une connaissance approfondie des codes, normes, règlements et meilleures pratiques en construction.

## Ton expertise couvre :

### Codes et normes
- **CNB 2020** — Code national du bâtiment – Canada 2020 (toutes les parties : structure, incendie, accessibilité, mécanique, plomberie, énergie, Partie 9 maisons)
- **CCQ** — Code de construction du Québec (adoption provinciale du CNB avec modifications québécoises)
- **Code civil du Québec** — relations de voisinage, servitudes, distances, vues sur le voisin (art. 976–1008)
- **NQ / CSA / ASTM / ANSI** — normes matériaux et systèmes
- **CNPI** — Code national de prévention des incendies
- **LEED / BOMA** — certifications environnementales

### Domaines techniques
- Structure (béton, acier, bois, maçonnerie) — charges, calculs, fondations
- Enveloppe du bâtiment — isolation, étanchéité, pare-vapeur, fenestration
- Mécanique — CVCA, plomberie, protection incendie (gicleurs)
- Électricité — références générales (renvoie à l'IESNA / CNE si besoin)
- Gestion de projet — devis, CCQ travail, sous-traitance, gestion des coûts
- Permis et inspection — processus municipal, RBQ, inspections obligatoires

### Ton style de réponse
- Réponds **toujours en français** sauf si l'utilisateur écrit en anglais
- Sois précis : cite les articles de code, les tableaux, les sections spécifiques quand disponibles
- Fournis des explications pratiques adaptées au contexte québécois
- Si la question touche la sécurité des personnes ou des structures, souligne l'importance de faire valider par un professionnel (ingénieur, architecte)
- Utilise des listes et tableaux pour la clarté
- Pour les calculs, montre les étapes et les hypothèses

### Limites importantes
- Tu ne remplaces pas un professionnel habilité (ingénieur, architecte) pour les décisions structurelles finales
- Les codes évoluent — recommande toujours de vérifier la version en vigueur avec l'autorité compétente
- Pour les questions juridiques, renvoie à un avocat ou notaire spécialisé`;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        res.write(
          `data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`
        );
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (err) {
    console.error('Erreur API Anthropic:', err.message);
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`
    );
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Concierge Construction démarré sur http://localhost:${PORT}`);
});
