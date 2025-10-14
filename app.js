// ===== app.js (full server) =====
const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));
const express = require("express");
const app = express();

// Parse JSON bodies for POST /api/faucet and /api/join
app.use(express.json());

/* ---------- CORS (allow IPFS origin) ---------- */
// Exact origin you deploy from (update this if you switch gateways)
const EXACT_IPFS_ORIGIN = "https://bafybeidep75e2tbvzhvclrvuapcfojsymc4e5mshvnxpscpfzv7p5lrvpq.ipfs.dweb.link";

// If you want to allow ANY ipfs.dweb.link subdomain (so new CIDs work automatically),
// set this to true. If you prefer to restrict to ONLY the exact origin above, set to false.
const ALLOW_ANY_IPFS_SUBDOMAIN = true;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === EXACT_IPFS_ORIGIN) return true;
  if (ALLOW_ANY_IPFS_SUBDOMAIN) {
    try { return new URL(origin).hostname.endsWith(".ipfs.dweb.link"); }
    catch { /* ignore */ }
  }
  return false;
}

function setCorsHeaders(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) setCorsHeaders(res, origin);
  if (req.method === "OPTIONS") {
    if (isAllowedOrigin(origin)) setCorsHeaders(res, origin);
    return res.status(200).end();
  }
  next();
});
/* ---------- end CORS ---------- */

/* ---------- HEALTH CHECK ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- Serve SDKs from your domain (avoids gateway/CSP hassles) ---------- */
app.get('/sdk/xumm.min.js', async (_req, res) => {
  const r = await fetch('https://xumm.app/assets/cdn/xumm.min.js');
  const js = await r.text();
  res.type('application/javascript').send(js);
});

app.get('/sdk/xrpl-latest-min.js', async (_req, res) => {
  const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/xrpl/2.11.0/xrpl-latest-min.js');
  const js = await r.text();
  res.type('application/javascript').send(js);
});

/* ---------- PAY VIA XAMAN: XRP ---------- */
app.get('/api/pay-xrp', async (_req, res) => {
  try {
    const payload = {
      txjson: {
        TransactionType: 'Payment',
        Destination: process.env.DESTINATION_RS,
        Amount: String(process.env.AMOUNT_XRP_DROPS || '1000000') // 1 XRP in drops
      }
    };
    const r = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.XUMM_API_KEY,
        'X-API-Secret': process.env.XUMM_API_SECRET,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (j?.next?.always) return res.redirect(j.next.always);
    return res.status(500).send('Could not create XRP payment payload');
  } catch (e) {
    console.error('pay-xrp error:', e);
    return res.status(500).send('Error creating XRP payment payload');
  }
});

/* ---------- PAY VIA XAMAN: CFC (issued currency) ---------- */
app.get('/api/pay-cfc', async (_req, res) => {
  try {
    const payload = {
      txjson: {
        TransactionType: 'Payment',
        Destination: process.env.DESTINATION_RS,
        Amount: {
          currency: process.env.CFC_CURRENCY || 'CFC',
          value: String(process.env.AMOUNT_CFC || '10'),
          issuer: process.env.CFC_ISSUER
        }
      }
    };
    const r = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.XUMM_API_KEY,
        'X-API-Secret': process.env.XUMM_API_SECRET,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (j?.next?.always) return res.redirect(j.next.always);
    return res.status(500).send('Could not create CFC payment payload');
  } catch (e) {
    console.error('pay-cfc error:', e);
    return res.status(500).send('Error creating CFC payment payload');
  }
});

/* ---------- Minimal backend for your front-end buttons ---------- */
// Claim faucet: front-end expects { ok: true } on success
app.post('/api/faucet', (req, res) => {
  console.log('FAUCET request:', req.body);
  // TODO: hook real faucet logic (XRPL send + rate limit).
  return res.json({ ok: true });
});

// Join list: front-end sends { email }; return { ok: true } on success
app.post('/api/join', (req, res) => {
  const email = (req.body && req.body.email || '').trim();
  if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });
  // TODO: save email to DB / sheet
  console.log('JOIN email:', email);
  return res.json({ ok: true });
});

/* ---------- Simple root page ---------- */
app.get("/", (_req, res) => res.type('html').send(`<!doctype html><html><body><h1>Hello from Render</h1><p>Service is live.</p></body></html>`));

/* ---------- START SERVER (ONE listen only) ---------- */
const port = process.env.PORT || 3001;
const server = app.listen(port, () => console.log(`Server listening on ${port}`));
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
// ===== end app.js =====
