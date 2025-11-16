// ===== FIXED app.js — Render/iPhone/Edge Safe =====

const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));
const express = require("express");
const xrpl = require("xrpl");
const cors = require("cors");
const path = require("path");

const app = express();

/* -------------------------------------------------
   NEW FIX — PREVENT RENDER FROM CACHING/REWRITING JS
---------------------------------------------------*/
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

/* -------------------------------------------------
   0) GLOBAL MIDDLEWARE — Ensure JS served correctly
---------------------------------------------------*/
app.use((req, res, next) => {
  if (req.path.endsWith(".js")) {
    res.type("application/javascript");
  }
  next();
});

/* -------------------------------------------------
   1) ENABLE CORS BEFORE ROUTES
---------------------------------------------------*/
app.use(cors({
  origin: [
    "https://centerforcreators.com",
    "https://centerforcreators.github.io",
    "https://centerforcreators.nft",
    "https://cf-ipfs.com",
    "https://dweb.link",
    "https://cfc-faucet.onrender.com"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

/* -------------------------------------------------
   2) SELF-HOSTED SDK FILES
---------------------------------------------------*/
app.get('/sdk/xumm.min.js', async (_req, res) => {
  try {
    const r = await fetch("https://xumm.app/assets/cdn/xumm.min.js");
    const text = await r.text();
    res.type("application/javascript").send(text);
  } catch (err) {
    console.error("Error loading XUMM SDK:", err);
    res.status(500).send("// Failed to load XUMM SDK");
  }
});

app.get('/sdk/xrpl-latest-min.js', async (_req, res) => {
  try {
    const r = await fetch("https://cdnjs.cloudflare.com/ajax/libs/xrpl/3.2.0/xrpl-latest-min.js");
    const text = await r.text();
    res.type("application/javascript").send(text);
  } catch (err) {
    console.error("Error loading XRPL SDK:",
