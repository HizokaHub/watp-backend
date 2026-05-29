const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const pool = require('../db');

// GET /api/comunidades/me — comunidades que sigue el usuario autenticado
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.* FROM comunidades c
       JOIN comunidad_members cm ON cm.comunidad_id = c.id
       WHERE cm.user_id = $1
       ORDER BY cm.joined_at DESC`,
      [req.user.sub]
    );
    res.json(rows);
  } catch (e) {
    console.error('[comunidades GET /me]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/comunidades/join
router.post('/join', verifyToken, async (req, res) => {
  const { comunidad_id } = req.body;
  if (!comunidad_id) return res.status(400).json({ error: 'comunidad_id requerido' });

  try {
    await pool.query(
      `INSERT INTO comunidad_members (user_id, comunidad_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.sub, comunidad_id]
    );
    await pool.query(
      `UPDATE comunidades SET members_count = members_count + 1 WHERE id = $1`,
      [comunidad_id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[comunidades POST /join]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/comunidades/leave
router.delete('/leave', verifyToken, async (req, res) => {
  const { comunidad_id } = req.body;
  if (!comunidad_id) return res.status(400).json({ error: 'comunidad_id requerido' });

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM comunidad_members WHERE user_id = $1 AND comunidad_id = $2`,
      [req.user.sub, comunidad_id]
    );
    if (rowCount > 0) {
      await pool.query(
        `UPDATE comunidades SET members_count = GREATEST(members_count - 1, 0) WHERE id = $1`,
        [comunidad_id]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[comunidades DELETE /leave]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/comunidades — lista con filtros opcionales ?parent_id=&nivel=
router.get('/', async (req, res) => {
  const { parent_id, nivel } = req.query;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (parent_id) {
    conditions.push(`parent_id = $${idx++}`);
    values.push(parent_id);
  } else if (!nivel) {
    conditions.push(`parent_id IS NULL`);
  }

  if (nivel) {
    conditions.push(`nivel = $${idx++}`);
    values.push(nivel);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT * FROM comunidades ${where} ORDER BY members_count DESC, nombre ASC`,
      values
    );
    res.json(rows);
  } catch (e) {
    console.error('[comunidades GET /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
