// server.js — Plan2Quote API (minimal, working)
// Purpose: prove OAuth works, auto-discover simPRO company ID,
// then you can wire quote creation next.

import express from 'express';
import cors from 'cors';
import axios from 'axios';

// Log unhandled errors so the process doesn't silently die.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const app = express();
app.use(cors({ origin: '*' }));              // lock this down after demo
app.use(express.json({ limit: '25mb' }));

const BASE         = (process.env.SIMPRO_BASE_URL || '').replace(/\/+$/, '');
const CLIENT_ID    = process.env.SIMPRO_CLIENT_ID || '';
const CLIENT_SECRET= process.env.SIMPRO_CLIENT_SECRET || '';
let   COMPANY_ID   = (process.env.SIMPRO_COMPANY_ID || '').trim();
const COMPANY_NAME = (process.env.SIMPRO_COMPANY_NAME || '').trim();

function reqFail(msg, res, code=500) {
  if (typeof msg === 'object') msg = JSON.stringify(msg);
    console.error('reqFail:', msg);

  return res.status(code).json({ ok:false, error:String(msg) });
}

async function getToken() {
  if (!BASE || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing SIMPRO_BASE_URL / SIMPRO_CLIENT_ID / SIMPRO_CLIENT_SECRET');
  }
  const url  = `${BASE}/oauth/token`;
  const body = {
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    ...(COMPANY_ID ? { scope: `company:${COMPANY_ID}` } : {}) // use scope if we already know it
  };
  const { data } = await axios.post(url, body, { headers: { 'Content-Type':'application/json' } });
  if (!data?.access_token) throw new Error('Token response missing access_token');
  return data.access_token;
}

async function ensureCompanyId(token) {
  // If already numeric, done.
  if (COMPANY_ID && /^\d+$/.test(String(COMPANY_ID))) return COMPANY_ID;

  // Ask simPRO which companies this token can see.
  const url = `${BASE}/api/v1.0/companies`;
  const { data } = await axios.get(url, { headers: { Authorization:`Bearer ${token}` } });

  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  if (!items?.length) throw new Error('No companies returned from simPRO');

  if (COMPANY_NAME) {
    const match = items.find(c => (c.name || '').toLowerCase() === COMPANY_NAME.toLowerCase());
    if (match?.id) { COMPANY_ID = String(match.id); return COMPANY_ID; }
  }
  COMPANY_ID = String(items[0].id); // fallback to first visible
  return COMPANY_ID;
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    base: BASE || null,
    haveClient: !!CLIENT_ID,
    haveSecret: !!CLIENT_SECRET
  });
});

// Respond to GET with 405; this endpoint expects a POST
app.get('/api/quote-runs/commit', (req, res) => {
  res.status(405).json({ ok: false, error: 'Use POST for this endpoint.' });
});

// For the demo: prove OAuth + company detection. Next step will create a Draft Quote.
app.post('/api/quote-runs/commit', async (req, res) => {
  try {
    const token = await getToken();
    const companyId = await ensureCompanyId(token);
    // Placeholder success — this is where we’ll actually create the quote next.
    return res.json({ ok:true, connected:true, companyId });
  } catch (e) {
    const msg = e?.response?.data || e?.message || e;
        console.error('Commit error:', e);

    return reqFail(msg, res);
  }
});

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`Plan2Quote API listening on ${port}`));
