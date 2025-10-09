import { URLSearchParams } from 'node:url';

let cached = null;

export const getSimproToken = async () => {
  const tokenUrl = process.env.SIMPRO_TOKEN_URL;
  const clientId = process.env.SIMPRO_CLIENT_ID;
  const clientSecret = process.env.SIMPRO_CLIENT_SECRET;
  const scopes = (process.env.SIMPRO_SCOPES || '').trim();

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('Missing SIMPRO_* envs');
  }

  const now = Date.now();
  if (cached && now < cached.expires_at - 30_000) {
    return cached.access_token;
  }

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  if (scopes.length > 0) {
    body.set('scope', scopes);
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const ttl = (json.expires_in ?? 3600) * 1000;
  cached = { access_token: json.access_token, expires_at: now + ttl };
  return json.access_token;
};
