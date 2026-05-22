const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'https://cocwoakxslyebbcpdtzf.supabase.co/auth/v1/.well-known/jwks.json',
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutos
  rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

module.exports = { getKey };
