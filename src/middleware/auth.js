const jwt = require('jsonwebtoken');
const { getKey } = require('../utils/jwks');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, getKey, { algorithms: ['ES256'] }, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido o expirado' });
    req.user = decoded;
    next();
  });
}

module.exports = { verifyToken };
