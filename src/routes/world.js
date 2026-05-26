const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { verifyToken } = require('../middleware/auth');

const EMOJI_LIST = `
NATURALEZA:
- Árboles: 🌲 🌳 🌴 🍁 🎋 🎄 🌵
- Plantas: 🌱 🌿 ☘️ 🍃
- Flores: 🌸 🌺 🌻 🌼 🪷
- Hongos: 🍄
- Rocas: 🪨 ⛰️ 🏔️
- Madera: 🪵
- Cultivos: 🥕 🌽 🎃 🍈 🎍 🍎
- Agua: 🌊 💧 🏖️ 🏝️
- Exterior: 🔥 ⛺ 🏕️ 🛶 🌉
- Decoración: 🪴 🗿 🪧 ☁️
- Animales: 🦊 🐺 🐄 🐴 🦌 🐕 🦙 🐂 🫏 🐝 🦀
- Campo: 🌾 🐔 ⛲

CIUDAD:
- Edificios modernos: 🏠 🏡 🏢 🏦 🏪 🏨 🏩 🏫 🏬 🏛️ 🏘️ 🏙️
- Vehículos: 🚗 🚕 🚛
- Urbano: 🚦 🚧 🛣️ 🗑️ 🧱

MEDIEVAL / FANTASÍA:
- Estructuras: 🏰 🏯 ⛪ 🏚️ 🏗️ 🏥 ⛩️ 🛕 🏺 🗼 ⛲ 🏟️
- Items: 🔔 🪑 🛒 ⚒️ 🪚 🛢️ ⚓ 🌬️ 🗡️ 🪓 🔮

ESPACIO / SCIFI:
- Espacio: 🚀 🛸 🪐 ☄️ 👽 🛰️ 📡 🔭 🌑
- SciFi: 👾 🛡️ 💻 🌐 📺 💡 📦 🔌 🛩️ 🪖 💊 🔩 🌀 🏭 ⚙️ 🤖 🔫 💣 🚂 🛤️ 🦴 💀

ITEMS / DECORACIÓN:
- Coleccionables: 🪙 💎 🔑 ❤️ ⚡ 🚩 💥 🔧 🎁 🧪 💰 🎮 🪝 ⭐ 🌟 🧸
- Bloques: 🧊 ❄️ 🏆
- Personajes: 🧟 🧑 🎸 🛋️
`;

const WORLD_TYPES = {
  forest: { terrain: 'forest_floor_02', sun_angle: -45, ambient: 1.2 },
  city: { terrain: 'asphalt_02', sun_angle: -60, ambient: 1.5 },
  beach: { terrain: 'sand_01', sun_angle: -35, ambient: 1.8 },
  desert: { terrain: 'sand_02', sun_angle: -70, ambient: 2.0 },
  medieval: { terrain: 'cobblestone_02', sun_angle: -50, ambient: 1.3 },
  fantasy: { terrain: 'rock_moss_01', sun_angle: -40, ambient: 1.0 },
  scifi: { terrain: 'metal_plate_01', sun_angle: -80, ambient: 0.8 },
  space: { terrain: 'rock_ground_01', sun_angle: -90, ambient: 0.5 },
  snow: { terrain: 'snow_01', sun_angle: -30, ambient: 1.6 },
  farm: { terrain: 'grass_01', sun_angle: -45, ambient: 1.4 },
};

const BASE_SYSTEM_PROMPT = `Eres un generador de mundos 3D para una red social metaverso llamada WATP.
El usuario describe un mundo con texto y tú generas un JSON con la cuadrícula 10x10 y metadatos.

EMOJIS DISPONIBLES (usa SOLO estos):
${EMOJI_LIST}

REGLAS IMPORTANTES:
1. El grid debe tener EXACTAMENTE 10 filas y 10 columnas
2. Usa null para celdas vacías (suelo visible)
3. El agua (🌊 💧) debe agruparse en zonas coherentes, no dispersa
4. Los árboles deben formar bosques o grupos naturales
5. Las construcciones deben tener espacio entre ellas
6. world_type debe ser uno de: forest, city, beach, desert, medieval, fantasy, scifi, space, snow, farm
7. Retorna SOLO el JSON, sin texto adicional, sin markdown

FORMATO DE RESPUESTA:
{
  "world_type": "forest",
  "theme": "descripción breve del mundo en español",
  "grid": [
    [emoji o null, ...10 columnas],
    ...10 filas
  ]
}`;

function buildSystemPrompt(currentGrid) {
  if (!currentGrid || !Array.isArray(currentGrid) || !currentGrid.some(row => Array.isArray(row) && row.some(c => c !== null))) {
    return BASE_SYSTEM_PROMPT;
  }
  return BASE_SYSTEM_PROMPT + `\n\nEL USUARIO YA TIENE ESTE MUNDO:\n${JSON.stringify(currentGrid)}\nConserva lo que no contradiga el nuevo prompt. Retorna el grid completo actualizado.`;
}

// POST /api/world/generate
router.post('/generate', verifyToken, async (req, res) => {
  const { prompt, currentGrid } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'El prompt es obligatorio' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }

  let rawText = '';
  try {
    const anthropic = new Anthropic({ apiKey });
    console.log('[world/generate] prompt:', prompt.trim().slice(0, 80));

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: buildSystemPrompt(currentGrid),
      messages: [{ role: 'user', content: prompt.trim() }],
    });

    rawText = message.content[0].text.trim();
    console.log('[world/generate] raw (200):', rawText.slice(0, 200));

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'La IA no retornó JSON válido', raw: rawText.slice(0, 300) });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(422).json({ error: 'JSON inválido', detail: e.message });
    }

    if (!parsed.grid || !Array.isArray(parsed.grid) || parsed.grid.length !== 10 || parsed.grid.some(r => !Array.isArray(r) || r.length !== 10)) {
      return res.status(422).json({ error: 'Grid inválido — debe ser exactamente 10x10' });
    }

    const worldType = parsed.world_type || 'forest';
    const worldConfig = WORLD_TYPES[worldType] || WORLD_TYPES.forest;

    console.log('[world/generate] world_type:', worldType, '| theme:', parsed.theme);

    res.json({
      grid: parsed.grid,
      world_type: worldType,
      theme: parsed.theme || '',
      terrain_texture: worldConfig.terrain,
      sun_angle: worldConfig.sun_angle,
      ambient_light: worldConfig.ambient,
    });

  } catch (e) {
    console.error('[world/generate] ERROR:', e.message, e.status);
    res.status(e.status || 500).json({ error: e.message, type: e.error?.type });
  }
});

module.exports = router;
