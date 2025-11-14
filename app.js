// ===== app.js (final faucet backend with full XUMM SDK CORS/MIME fix + static frontend) =====

const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));
const express = require("express");
const xrpl = require("xrpl");
const cors = require("cors");
const path = require("path");

const app = express();

/* ---------- STATIC FRONTEND ---------- */
app.use(express.static(path.join(__dirname, "public")));

/* ---------- CORS ---------- */
app.use(cors({
  origin: [
    "https://centerforcreators.com",
    "https://centerforcreators.github.io",
    "https://centerforcreators.nft",
    "https://cf-ipfs.com",
    "https://dweb.link",
    "https://cfc-faucet.onrender.com"  // allow own frontend
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

/* ---------- HEALTH ---------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ============================================================
   FIXED XUMM SDK + XRPL SDK ENDPOINTS
   (Correct headers, correct MIME, caching, no redirect breaks)
   ============================================================ */
app.get("/sdk/xumm.min.js", async (req, res) => {
  try {
    const upstream = await fetch("https://xumm.app/assets/cdn/xumm.min.js");

    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");               // <-- BIG FIX
    res.setHeader("Cache-Control", "public, max-age=86400");         // 1 day

    const txt = await upstream.text();
    return res.send(txt);
  } catch (e) {
    console.error("xumm.min.js error:", e);
    res.status(500).send("// xumm load failed");
  }
});

app.get("/sdk/xrpl-latest-min.js", async (req, res) => {
  try {
    const upstream = await fetch("https://cdnjs.cloudflare.com/ajax/libs/xrpl/3.2.0/xrpl-latest-min.js");

    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");               // <-- BIG FIX
    res.setHeader("Cache-Control", "public, max-age=86400");

    const txt = await upstream.text();
    return res.send(txt);
  } catch (e) {
    console.error("xrpl-latest-min.js error:", e);
    res.status(500).send("// xrpl load failed");
  }
});

/* ---------- PAY (RLUSD & XRP) ---------- */
const XUMM_API_KEY = process.env.XUMM_API_KEY || "ffa83df2-e68d-4172-a77c-e7af7e5274ea";
const XUMM_API_SECRET = process.env.XUMM_API_SECRET || "";
const PAY_DESTINATION = process.env.PAY_DESTINATION || "rU15yYD3cHmNXGxHJSJGoLUSogxZ17FpKd";

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

  if (!j.next || !j.next.always) throw new Error("Invalid Xumm response");

  return j.next.always;
}

// RLUSD
app.get("/api/pay-rlusd", async (_req, res) => {
  try {
    const link = await createXummPayload({
      txjson: {
        TransactionType: "Payment",
        Destination: PAY_DESTINATION,
        Amount: {
          currency: "524C555344000000000000000000000000000000",
          issuer: PAY_DESTINATION,
          value: "10"
        }
      },
      options: {
        submit: true,
        return_url: { web: "https://centerforcreators.com/nft-marketplace" }
      }
    });

    res.redirect(link);
  } catch (e) {
    console.error("pay-rlusd error:", e);
    res.status(500).json({ ok: false, error: "Xumm error" });
  }
});

// XRP
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

    res.redirect(link);
  } catch (e) {
    console.error("pay-xrp error:", e);
    res.status(500).json({ ok: false, error: "Xumm error" });
  }
});

/* ---------- JOIN ---------- */
app.post("/api/join", async (req, res) => {
  const email = (req.body?.email || "").trim();
  if (!email) return res.status(400).json({ ok: false, error: "Missing email" });

  try {
    const scriptURL = "https://script.google.com/macros/s/AKfycbx4xRkESlayCqBmXV1GlYJMh90_WpfytBGbTMoLIt8oCq6MYMTxnghbFv7FjFQynxEQ/exec";

    const r = await fetch(scriptURL, {
      method: "POST",
      body: new URLSearchParams({ email })
    });

    const j = await r.json();
    return res.json({ ok: true, sheetResponse: j });
  } catch (e) {
    console.error("JOIN error:", e);
    return res.status(500).json({ ok: false, error: "Google Sheets error" });
  }
});

/* ---------- FAUCET ---------- */
const grants = new Map();

app.post("/api/faucet", async (req, res) => {
  try {
    const { account, captcha_ok } = req.body || {};

    if (!captcha_ok) return res.status(400).json({ ok: false, error: "Captcha required" });
    if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(account))
      return res.status(400).json({ ok: false, error: "Invalid account" });

    const last = grants.get(account) || 0;
    const now = Date.now();

    if (now - last < 86400000)
      return res.status(429).json({ ok: false, error: "Faucet already claimed (24h)" });

    const issuer = process.env.ISSUER_CLASSIC || process.env.CFC_ISSUER;
    const seed = process.env.ISSUER_SEED || process.env.FAUCET_SEED;
    const currency = process.env.CFC_CURRENCY || "CFC";
    const value = String(process.env.AMOUNT_CFC || "10");

    if (!issuer || !seed)
      return res.status(500).json({ ok: false, error: "Server faucet not configured" });

    const client = new xrpl.Client(process.env.RIPPLED_URL || "wss://s1.ripple.com");
    await client.connect();

    const al = await client.request({
      command: "account_lines",
      account,
      ledger_index: "validated",
      peer: issuer
    });

    const hasLine = (al.result?.lines || []).some(l => l.currency === currency);
    if (!hasLine) {
      await client.disconnect();
      return res.status(400).json({ ok: false, error: "No CFC trustline" });
    }

    const wallet = xrpl.Wallet.fromSeed(seed);

    const tx = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: account,
      Amount: { currency, issuer, value }
    };

    const filled = await client.autofill(tx, { max_ledger_offset: 60 });
    const signed = wallet.sign(filled);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();

    if (result.result?.meta?.TransactionResult === "tesSUCCESS") {
      grants.set(account, now);
      return res.json({ ok: true, hash: result.result.tx_json.hash });
    }

    return res.status(500).json({ ok: false, error: "Submit failed" });

  } catch (e) {
    console.error("FAUCET error:", e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* ---------- ROOT SERVES FRONTEND ---------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ---------- START ---------- */
const port = process.env.PORT || 10000;
const server = app.listen(port, () => console.log(`Server listening on ${port}`));

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// ===== end app.js =====
