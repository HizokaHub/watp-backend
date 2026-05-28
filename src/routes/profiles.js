const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const pool = require('../db');

const PETS = ['🦊', '🐕', '🐈', '🐇', '🐦'];

function initialWorldData() {
  const pet = PETS[Math.floor(Math.random() * PETS.length)];
  return {
    objects: [
      { id: 'tree_1', emoji: '🌲', x: -2, y: 0, z: 0 },
      { id: 'pet_1', emoji: pet, x: 2, y: 0, z: 0 },
      { id: 'slot_1', type: 'canal_slot', x: -4, y: 0, z: 3, label: 'Abrir Canal' },
      { id: 'slot_2', type: 'canal_slot', x: 0, y: 0, z: 3, label: 'Abrir Canal' },
      { id: 'slot_3', type: 'canal_slot', x: 4, y: 0, z: 3, label: 'Abrir Canal' },
    ],
  };
}

// GET /api/profiles/me — mi perfil
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM profiles WHERE id = $1',
      [req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[profiles GET /me]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/profiles/me — actualizar mi perfil
router.put('/me', verifyToken, async (req, res) => {
  const { display_name, bio, avatar_url, is_public } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (display_name !== undefined) { updates.push(`display_name = $${idx++}`); values.push(display_name); }
  if (bio !== undefined)          { updates.push(`bio = $${idx++}`);          values.push(bio); }
  if (avatar_url !== undefined)   { updates.push(`avatar_url = $${idx++}`);   values.push(avatar_url); }
  if (is_public !== undefined)    { updates.push(`is_public = $${idx++}`);    values.push(is_public); }

  if (!updates.length) return res.status(400).json({ error: 'No hay campos para actualizar' });

  updates.push(`updated_at = NOW()`);
  values.push(req.user.sub);

  try {
    const { rows } = await pool.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[profiles PUT /me]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/profiles/me/setup — crear perfil inicial + calle al registrarse
router.post('/me/setup', verifyToken, async (req, res) => {
  const { username, display_name, account_type } = req.body;
  const userId = req.user.sub;

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'El username es obligatorio' });
  }
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (clean.length < 3 || clean.length > 30) {
    return res.status(400).json({ error: 'El username debe tener entre 3 y 30 caracteres (letras, números, _)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: profile } = await client.query(
      `INSERT INTO profiles (id, username, display_name, account_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, clean, display_name || clean, account_type || 'user']
    );

    const worldData = initialWorldData();
    const { rows: calle } = await client.query(
      `INSERT INTO calles (user_id, username, world_data)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, clean, JSON.stringify(worldData)]
    );

    await client.query('COMMIT');
    res.status(201).json({ profile: profile[0], calle: calle[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Ese username ya está en uso' });
    console.error('[profiles POST /me/setup]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/profiles/:username — perfil público
router.get('/:username', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, display_name, bio, avatar_url, account_type,
              coins, followers_count, following_count, visits_count, created_at
       FROM profiles WHERE username = $1 AND is_public = true`,
      [req.params.username.toLowerCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[profiles GET /:username]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
