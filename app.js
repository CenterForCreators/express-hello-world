// ===== app.js (final faucet backend with working Xumm pay + CORS fix) ===== 
const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));
const express = require("express");
const xrpl = require("xrpl");
const cors = require("cors");
const app = express();

/* ---------- CORS (Allow GitHub + Unstoppable + IPFS + main site) ---------- */
app.use(cors({
origin: [
"https://centerforcreators.com",
"https://centerforcreators.github.io",
"https://centerforcreators.nft",
"https://cf-ipfs.com",
"https://dweb.link"
],
methods: ["GET", "POST"],
allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

/* ---------- HEALTH ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- SDK serve ---------- */
app.get('/sdk/xumm.min.js', async (_req, res) => {
const r = await fetch('https://xumm.app/assets/cdn/xumm.min.js');
res.type('application/javascript').send(await r.text());
});

app.get('/sdk/xrpl-latest-min.js', async (_req, res) => {
const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/xrpl/3.2.0/xrpl-latest-min.js');
res.type('application/javascript').send(await r.text());
});

/* ---------- PAY (live Xumm redirect) ---------- */
const XUMM_API_KEY = process.env.XUMM_API_KEY || "ffa83df2-e68d-4172-a77c-e7af7e5274ea";
const XUMM_API_SECRET = process.env.XUMM_API_SECRET || "";
const PAY_DESTINATION = process.env.PAY_DESTINATION || "rU15yYD3cHmNXGxHJSJGoLUSogxZ17FpKd"; // updated to RU address

async function createXummPayload(payload) {
const r = await fetch("https://xumm.app/api/v1/platform/payload", {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-api-key": XUMM_API_KEY,
"x-api-secret": XUMM_API_SECRET
},
body: JSON.stringify(payload)
});

const j = await r.json();
console.log("Xumm payload response:", j);

if (!j.next || !j.next.always) {
console.error("Invalid Xumm API response:", j);
throw new Error("Xumm API key/secret invalid or response malformed");
}

return j.next.always; // return redirect link
}

// Pay RLUSD (was Pay CFC)
app.get("/api/pay-rlusd", async (_req, res) => {
try {
const link = await createXummPayload({
txjson: {
TransactionType: "Payment",
Destination: PAY_DESTINATION,
Amount: {
currency: "524C555344000000000000000000000000000000", // hex for RLUSD
issuer: PAY_DESTINATION,
value: "10"
}
},
options: { 
submit: true,
return_url: { web: "https://centerforcreators.com/nft-marketplace" }
}
});
console.log("Redirecting to:", link);
return res.redirect(link);
} catch (e) {
console.error("pay-rlusd error:", e);
return res.status(500).json({ ok: false, error: "Xumm error" });
}
});

// Pay XRP (unchanged)
app.get("/api/pay-xrp", async (_req, res) => {
try {
const link = await createXummPayload({
txjson: {
TransactionType: "Payment",
Destination: PAY_DESTINATION,
Amount: xrpl.xrpToDrops("5")
},
options: { 
submit: true,
return_url: { web: "https://centerforcreators.com/nft-marketplace" }
}
});
console.log("Redirecting to:", link);
return res.redirect(link);
} catch (e) {
console.error("pay-xrp error:", e);
return res.status(500).json({ ok: false, error: "Xumm error" });
}
});

/* ---------- JOIN (updated to forward email to Google Sheets) ---------- */
app.post('/api/join', async (req, res) => {
const email = (req.body && req.body.email || '').trim();
if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });

console.log('JOIN email:', email);

const scriptURL = "https://script.google.com/macros/s/AKfycbx4xRkESlayCqBmXV1GlYJMh90_WpfytBGbTMoLIt8oCq6MYMTxnghbFv7FjFQynxEQ/exec";

try {
const r = await fetch(scriptURL, {
method: "POST",
body: new URLSearchParams({ email })
});
const j = await r.json();
console.log('Sheets response:', j);
return res.json({ ok: true, sheetResponse: j });
} catch (e) {
console.error('Error saving email to Google Sheets:', e);
return res.status(500).json({ ok: false, error: 'Google Sheets error' });
}
});

/* ---------- FAUCET (real CFC send) ---------- */
const grants = new Map();

app.post('/api/faucet', async (req, res) => {
try {
const { account, captcha_ok } = req.body || {};
if (!captcha_ok) return res.status(400).json({ ok: false, error: 'Captcha required' });
if (!account || !/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(account)) {
return res.status(400).json({ ok: false, error: 'Invalid account' });
}

const last = grants.get(account) || 0;
const now = Date.now();
if (now - last < 24 * 60 * 60 * 1000) {
return res.status(429).json({ ok: false, error: 'Faucet already claimed (24h limit)' });
}

const issuer = process.env.ISSUER_CLASSIC || process.env.CFC_ISSUER;
const seed = process.env.ISSUER_SEED || process.env.FAUCET_SEED;
const currency = process.env.CFC_CURRENCY || 'CFC';
const value = String(process.env.AMOUNT_CFC || '10');
if (!issuer || !seed) {
return res.status(500).json({ ok: false, error: 'Server faucet not configured' });
}

const client = new xrpl.Client(process.env.RIPPLED_URL || 'wss://s1.ripple.com');
await client.connect();

const al = await client.request({ command: 'account_lines', account, ledger_index: 'validated', peer: issuer });
const hasLine = (al.result?.lines || []).some(l => l.currency === currency);
if (!hasLine) {
await client.disconnect();
return res.status(400).json({ ok: false, error: 'No CFC trustline. Please add trustline first.' });
}

const wallet = xrpl.Wallet.fromSeed(seed);
const tx = {
TransactionType: "Payment",
Account: wallet.address,
Destination: account,
Amount: { currency, issuer, value }
};

// ✅ Increased ledger window to avoid XRPL latency issues
const filled = await client.autofill(tx, { max_ledger_offset: 120 });

const signed = wallet.sign(filled);
const result = await client.submitAndWait(signed.tx_blob);

await client.disconnect();

if (result.result?.meta?.TransactionResult === 'tesSUCCESS') {
grants.set(account, now);
return res.json({ ok: true, hash: result.result?.tx_json?.hash });
} else {
return res.status(500).json({
ok: false,
error: result.result?.meta?.TransactionResult || 'Submit failed'
});
}
} catch (e) {
console.error('faucet error:', e);
return res.status(500).json({ ok: false, error: String(e.message || e) });
}
});

/* ---------- ROOT ---------- */
app.get("/", (_req, res) =>
res.type('html').send(`<!doctype html><html><body><h1>Hello from Render</h1></body></html>`)
);

/* ---------- START ---------- */
const port = process.env.PORT || 10000;
const server = app.listen(port, () => console.log(`Server listening on ${port}`));
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// ===== end app.js =====
