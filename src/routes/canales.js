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
