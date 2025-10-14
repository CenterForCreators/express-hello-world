// ===== app.js (paste this whole file) =====
const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));
const express = require("express");
const app = express();

// Parse JSON bodies for POST /api/faucet and /api/join
app.use(express.json());

/* ---------- CORS (allow IPFS origin) ---------- */
// Exact origin you deploy from (update if you switch to a new domain)
const EXACT_IPFS_ORIGIN = "https://bafybeidep75e2tbvzhvclrvuapcfojsymc4e5mshvnxpscpfzv7p5lrvpq.ipfs.dweb.link";

// If you want to allow ANY ipfs.dweb.link subdomain (so new CIDs work automatically),
// set this to true. If you prefer to restrict to ONLY the exact origin above, set to false.
const ALLOW_ANY_IPFS_SUBDOMAIN = true;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === EXACT_IPFS_ORIGIN) return true;
  // Optional: any *.ipfs.dweb.link subdomain (handy if you redeploy with new CIDs)
  if (ALLOW_ANY_IPFS_SUBDOMAIN) {
    try {
      const host = new URL(origin).hostname;
      return host.endsWith(".ipfs.dweb.link");
    } catch { /* ignore */ }
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
  if (isAllowedOrigin(origin)) {
    setCorsHeaders(res, origin);
  }
  if (req.method === "OPTIONS") {
    // IMPORTANT: echo CORS headers on preflight if origin was allowed
    if (isAllowedOrigin(origin)) setCorsHeaders(res, origin);
    return res.status(200).end();
  }
  next();
});
/* ---------- end CORS ---------- */

/* ---------- HEALTH CHECK ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- SDK ROUTES (optional: serve via your domain) ---------- */
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
        Amount: String(process.env.AMOUNT_XRP_DROPS || '1000000') // 1 XRP (1,000,000 drops)
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
    return res.status(500).send('Error creating CFC payment payload');
  }
});

/* ---------- MINIMAL BACKEND FOR YOUR FRONTEND BUTTONS ---------- */
// Claim faucet: front-end expects { ok: true } on success
app.post('/api/faucet', (req, res) => {
  // TODO: implement real faucet logic (XRPL send + rate limit).
  // For now, return success so the UI works end-to-end.
  console.log('FAUCET request:', req.body);
  return res.json({ ok: true });
});

// Join list: front-end sends { email }; return { ok: true } on success
app.post('/api/join', (req, res) => {
  const email = (req.body && req.body.email || '').trim();
  if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });
  // TODO: store email in your DB (e.g., Supabase, Postgres, etc.)
  console.log('JOIN email:', email);
  return res.json({ ok: true });
});

/* ---------- ROOT PAGE (Render demo HTML) ---------- */
const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Hello from Render!</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    <script>
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          disableForReducedMotion: true
        });
      }, 500);
    </script>
    <style>
      @import url("https://p.typekit.net/p.css?s=1&k=vnd5zic&ht=tk&f=39475.39476.39477.39478.39479.39480.39481.39482&a=18673890&app=typekit&e=css");
      @font-face {
        font-family: "neo-sans";
        src: url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff2"),
             url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/d?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff"),
             url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/a?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("opentype");
        font-style: normal;
        font-weight: 700;
      }
      html { font-family: neo-sans; font-weight: 700; font-size: calc(62rem / 16); }
      body { background: white; }
      section {
        border-radius: 1em; padding: 1em; position: absolute;
        top: 50%; left: 50%; transform: translate(-50%, -50%);
      }
    </style>
  </head>
  <body>
    <section>Hello from Render!</section>
  </body>
</html>
`;

/* ---------- ROUTE TO SERVE THE HTML ---------- */
app.get("/", (_req, res) => res.type('html').send(html));

/* ---------- START SERVER (ONE listen only) ---------- */
const port = process.env.PORT || 3001;
const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
// ===== end app.js =====
