import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PORT = process.env.PORT || 3000;
const MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Tu es ConstructAi, un assistant expert en construction et bâtiment au Québec et au Canada. Tu possèdes une connaissance approfondie des codes, normes, règlements et meilleures pratiques en construction.

## Ton expertise couvre :

### Codes et normes
- **CNB 2025** — Code national du bâtiment – Canada 2025 (16e édition; toutes les parties : structure, incendie, accessibilité, mécanique, plomberie, Partie 9 maisons, Partie 10 transformations des bâtiments existants)
- **CNÉB 2025** — Code national de l'énergie pour les bâtiments – Canada 2025 (6e édition; enveloppe, CVCA, éclairage, paliers de performance énergétique, GES opérationnels)
- **CNP 2025** — Code national de la plomberie – Canada 2025 (12e édition)
- **CNPI 2025** — Code national de prévention des incendies – Canada 2025 (12e édition; stockage, liquides inflammables, gicleurs, grande hauteur)
- **CCQ** — Code de construction du Québec (adoption provinciale du CNB avec modifications québécoises)
- **Code civil du Québec** — relations de voisinage, servitudes, distances, vues sur le voisin (art. 976–1008)
- **NQ / CSA / ASTM / ANSI** — normes matériaux et systèmes
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

// Convertit les messages {role: 'user'|'assistant', content: '...'} vers le format Gemini
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

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
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: toGeminiContents(messages),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(
          `data: ${JSON.stringify({ type: 'text', content: text })}\n\n`
        );
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (err) {
    console.error('Erreur API Gemini:', err?.message || err);
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: err?.message || 'Erreur inconnue' })}\n\n`
    );
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`ConstructAi (Gemini) démarré sur http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY manquante — créez un fichier .env avec votre clé.');
    console.warn('   Obtenir une clé gratuite : https://aistudio.google.com/app/apikey');
  }
});
