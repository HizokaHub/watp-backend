const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { verifyToken } = require('../middleware/auth');

const SYSTEM_PROMPT =
  'Eres un asistente que genera mundos 2D en cuadrícula 10x10. El usuario describe su mundo y tú debes retornar SOLO un JSON válido con esta estructura: {"grid": [[emoji o null por cada celda, 10 columnas], [10 filas en total]]}. Usa emojis de estas categorías disponibles: Naturaleza (🌲🌳🌵🌺🌸🍄🪨💧🌊🏔️), Construcción (🏠🏰🏯🗼🏗️🚪🪟⬛🧱🪵), Decoración (🎨🖼️🪑🛋️🛏️🚿🪞💡🕯️🎭), Tienda (🏪🛒💰🎁📦🏷️💎🪙🏦💳), Entretenimiento (🎮🎵🎬🎤🎸🎹🎲🎯🎳🎪). Deja null en celdas vacías. El JSON debe tener exactamente 10 filas y 10 columnas.';

// POST /api/world/generate
router.post('/generate', verifyToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'El prompt es obligatorio' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[world POST /generate] ANTHROPIC_API_KEY no está definida en las variables de entorno');
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' });
  }

  let rawText = '';
  try {
    const anthropic = new Anthropic({ apiKey });

    console.log('[world POST /generate] Llamando a Claude con prompt:', prompt.trim().slice(0, 80));

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt.trim() }],
    });

    rawText = message.content[0].text.trim();
    console.log('[world POST /generate] Respuesta raw de Claude (primeros 200 chars):', rawText.slice(0, 200));

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[world POST /generate] No se encontró JSON en la respuesta:', rawText);
      return res.status(422).json({ error: 'La IA no retornó un JSON válido', raw: rawText.slice(0, 300) });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[world POST /generate] JSON.parse falló:', parseErr.message, '| Texto:', jsonMatch[0].slice(0, 200));
      return res.status(422).json({ error: 'No se pudo parsear el JSON de la IA', detail: parseErr.message });
    }

    if (
      !parsed.grid ||
      !Array.isArray(parsed.grid) ||
      parsed.grid.length !== 10 ||
      parsed.grid.some(row => !Array.isArray(row) || row.length !== 10)
    ) {
      console.error('[world POST /generate] Grid inválido — filas:', parsed.grid?.length, '| primera fila cols:', parsed.grid?.[0]?.length);
      return res.status(422).json({ error: 'El grid generado no tiene la estructura correcta (debe ser 10x10)' });
    }

    console.log('[world POST /generate] Grid generado correctamente');
    res.json({ grid: parsed.grid });
  } catch (e) {
    console.error('[world POST /generate] ERROR COMPLETO:');
    console.error('  message:', e.message);
    console.error('  status:', e.status);
    console.error('  type:', e.error?.type);
    console.error('  error:', JSON.stringify(e.error));
    console.error('  rawText hasta ahora:', rawText.slice(0, 200));
    res.status(e.status || 500).json({
      error: e.message,
      type: e.error?.type,
      status: e.status,
    });
  }
});

module.exports = router;
