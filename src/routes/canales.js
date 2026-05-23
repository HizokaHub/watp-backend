const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// GET /api/canales — lista todos los canales ordenados por fecha
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM canales ORDER BY created_at DESC LIMIT 100'
    );
    res.json(rows);
  } catch (e) {
    console.error('[canales GET /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/canales/:id — detalle de un canal
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM canales WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Canal no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[canales GET /:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/canales — crear canal (requiere auth)
router.post('/', verifyToken, async (req, res) => {
  const { name, description, chat_type } = req.body;
  const creator_id = req.user.sub;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'La descripción es obligatoria' });
  }

  const validChatTypes = ['free', 'moderated'];
  const finalChatType = validChatTypes.includes(chat_type) ? chat_type : 'free';

  try {
    const { rows } = await pool.query(
      `INSERT INTO canales (name, description, creator_id, chat_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), description.trim(), creator_id, finalChatType]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un canal con ese nombre' });
    }
    console.error('[canales POST /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/canales/:id — editar canal (solo el creador)
router.put('/:id', verifyToken, async (req, res) => {
  const { name, description, chat_type } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT creator_id FROM canales WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Canal no encontrado' });
    if (rows[0].creator_id !== req.user.sub) {
      return res.status(403).json({ error: 'Solo el creador puede editar este canal' });
    }

    const validChatTypes = ['free', 'moderated'];
    const updates = [];
    const values = [];
    let idx = 1;

    if (name && name.trim()) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
    if (description && description.trim()) { updates.push(`description = $${idx++}`); values.push(description.trim()); }
    if (validChatTypes.includes(chat_type)) { updates.push(`chat_type = $${idx++}`); values.push(chat_type); }

    if (!updates.length) return res.status(400).json({ error: 'No hay campos para actualizar' });

    values.push(req.params.id);
    const { rows: updated } = await pool.query(
      `UPDATE canales SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(updated[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un canal con ese nombre' });
    console.error('[canales PUT /:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/canales/:id/world — retorna world_data del canal
router.get('/:id/world', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT world_data FROM canales WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Canal no encontrado' });
    res.json(rows[0].world_data || { grid: Array.from({ length: 10 }, () => Array(10).fill(null)) });
  } catch (e) {
    console.error('[canales GET /:id/world]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/canales/:id/world — actualiza world_data (solo el creador)
router.put('/:id/world', verifyToken, async (req, res) => {
  const { grid } = req.body;
  if (
    !grid ||
    !Array.isArray(grid) ||
    grid.length !== 10 ||
    grid.some(row => !Array.isArray(row) || row.length !== 10)
  ) {
    return res.status(400).json({ error: 'El grid debe tener exactamente 10x10 celdas' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT creator_id FROM canales WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Canal no encontrado' });
    if (rows[0].creator_id !== req.user.sub) {
      return res.status(403).json({ error: 'Solo el creador puede editar el mundo' });
    }

    await pool.query(
      'UPDATE canales SET world_data = $1 WHERE id = $2',
      [JSON.stringify({ grid }), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[canales PUT /:id/world]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/canales/:id — eliminar canal (solo el creador)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT creator_id FROM canales WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Canal no encontrado' });
    if (rows[0].creator_id !== req.user.sub) {
      return res.status(403).json({ error: 'Solo el creador puede eliminar este canal' });
    }
    await pool.query('DELETE FROM canales WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[canales DELETE /:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
