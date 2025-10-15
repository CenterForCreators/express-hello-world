// ===== app.js (full backend with real faucet) =====
const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));
const express = require("express");
const xrpl = require("xrpl");
const app = express();

app.use(express.json());

/* ---------- CORS (allow IPFS/UD origins) ---------- */
const EXACT_IPFS_ORIGIN = process.env.EXACT_IPFS_ORIGIN || ""; // e.g. https://<CID>.ipfs.dweb.link
const UD_ORIGIN = process.env.UD_ORIGIN || "";                  // e.g. https://yourname.crypto.link
const ALLOW_ANY_IPFS_SUBDOMAIN = true;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (EXACT_IPFS_ORIGIN && origin === EXACT_IPFS_ORIGIN) return true;
  if (UD_ORIGIN && origin === UD_ORIGIN) return true;
  if (ALLOW_ANY_IPFS_SUBDOMAIN) {
    try { return new URL(origin).hostname.endsWith(".ipfs.dweb.link"); } catch {}
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

/* ---------- HEALTH ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- Serve SDKs from your domain (optional) ---------- */
app.get('/sdk/xumm.min.js', async (_req, res) => {
  const r = await fetch('https://xumm.app/assets/cdn/xumm.min.js');
  res.type('application/javascript').send(await r.text());
});
app.get('/sdk/xrpl-latest-min.js', async (_req, res) => {
  const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/xrpl/2.11.0/xrpl-latest-min.js');
  res.type('application/javascript').send(await r.text());
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

/* ---------- BALANCES (optional helper) ---------- */
app.get('/api/balances', async (req, res) => {
  const account = (req.query.account || '').trim();
  if (!account) return res.status(400).json({ ok:false, error:'Missing account' });
  try {
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    let xrp = null, cfc = null, hasTrust = false;
    try {
      const ai = await client.request({ command:'account_info', account, ledger_index:'validated' });
      xrp = ai.result?.account_data?.Balance ? (ai.result.account_data.Balance/1000000) : null;
    } catch {}
    if (process.env.CFC_ISSUER) {
      try {
        const al = await client.request({ command:'account_lines', account, ledger_index:'validated', peer: process.env.CFC_ISSUER });
        const lines = al.result?.lines || [];
        hasTrust = lines.some(l => l.currency === (process.env.CFC_CURRENCY || 'CFC'));
        const line = lines.find(l => l.currency === (process.env.CFC_CURRENCY || 'CFC'));
        cfc = line ? line.balance : null;
      } catch {}
    }
    await client.disconnect();
    return res.json({ ok:true, xrp, cfc, hasTrust });
  } catch (e) {
    console.error('balances error:', e);
    return res.status(500).json({ ok:false, error:'XRPL error' });
  }
});

/* ---------- JOIN (store later) ---------- */
app.post('/api/join', (req, res) => {
  const email = (req.body && req.body.email || '').trim();
  if (!email) return res.status(400).json({ ok:false, error:'Missing email' });
  console.log('JOIN email:', email); // TODO: store in DB / sheet
  return res.json({ ok:true });
});

/* ---------- FAUCET (real send of 10 CFC) ---------- */
const grants = new Map(); // simple in-memory rate limit: account -> lastTimestamp

app.post('/api/faucet', async (req, res) => {
  try {
    const { account, captcha_ok } = req.body || {};
    if (!captcha_ok) return res.status(400).json({ ok:false, error:'Captcha required' });
    if (!account || !/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(account)) {
      return res.status(400).json({ ok:false, error:'Invalid account' });
    }

    // rate limit: once per 24h per account
    const last = grants.get(account) || 0;
    const now = Date.now();
    if (now - last < 24*60*60*1000) {
      return res.status(429).json({ ok:false, error:'Faucet already claimed (24h limit)' });
    }

    const issuer = process.env.CFC_ISSUER;
    const currency = process.env.CFC_CURRENCY || 'CFC';
    const value = String(process.env.AMOUNT_CFC || '10');
    const seed = process.env.FAUCET_SEED;
    if (!issuer || !seed) {
      return res.status(500).json({ ok:false, error:'Server faucet not configured' });
    }

    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();

    // Ensure trustline exists
    const al = await client.request({ command:'account_lines', account, ledger_index:'validated', peer: issuer });
    const hasLine = (al.result?.lines || []).some(l => l.currency === currency);
    if (!hasLine) {
      await client.disconnect();
      return res.status(400).json({ ok:false, error:'No CFC trustline. Please add trustline first.' });
    }

    // Send issued currency Payment
    const wallet = xrpl.Wallet.fromSeed(seed);
    const tx = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: account,
      Amount: { currency, issuer, value }
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();

    if (result.result?.meta?.TransactionResult === 'tesSUCCESS') {
      grants.set(account, now);
      return res.json({ ok:true, hash: result.result?.tx_json?.hash });
    } else {
      return res.status(500).json({
        ok:false,
        error: result.result?.meta?.TransactionResult || 'Submit failed'
      });
    }
  } catch (e) {
    console.error('faucet error:', e);
    return res.status(500).json({ ok:false, error:'Server error' });
  }
});

/* ---------- ROOT ---------- */
app.get("/", (_req, res) => res.type('html').send(`<!doctype html><html><body><h1>Hello from Render</h1></body></html>`));

/* ---------- START ---------- */
const port = process.env.PORT || 3001;
const server = app.listen(port, () => console.log(`Server listening on ${port}`));
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
// ===== end app.js =====

