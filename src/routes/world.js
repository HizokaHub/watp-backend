const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { verifyToken } = require('../middleware/auth');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT =
  'Eres un asistente que genera mundos 2D en cuadrícula 10x10. El usuario describe su mundo y tú debes retornar SOLO un JSON válido con esta estructura: {"grid": [[emoji o null por cada celda, 10 columnas], [10 filas en total]]}. Usa emojis de estas categorías disponibles: Naturaleza (🌲🌳🌵🌺🌸🍄🪨💧🌊🏔️), Construcción (🏠🏰🏯🗼🏗️🚪🪟⬛🧱🪵), Decoración (🎨🖼️🪑🛋️🛏️🚿🪞💡🕯️🎭), Tienda (🏪🛒💰🎁📦🏷️💎🪙🏦💳), Entretenimiento (🎮🎵🎬🎤🎸🎹🎲🎯🎳🎪). Deja null en celdas vacías. El JSON debe tener exactamente 10 filas y 10 columnas.';

// POST /api/world/generate
router.post('/generate', verifyToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'El prompt es obligatorio' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt.trim() }],
    });

    const rawText = message.content[0].text.trim();

    // Extraer JSON aunque Claude añada texto extra
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'La IA no retornó un JSON válido' });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (
      !parsed.grid ||
      !Array.isArray(parsed.grid) ||
      parsed.grid.length !== 10 ||
      parsed.grid.some(row => !Array.isArray(row) || row.length !== 10)
    ) {
      return res.status(422).json({ error: 'El grid generado no tiene la estructura correcta' });
    }

    res.json({ grid: parsed.grid });
  } catch (e) {
    console.error('[world POST /generate]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
