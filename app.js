// ===== app.js (paste the whole file) =====
const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));
const express = require("express");
const app = express();

/* ---------- SDK ROUTES (served from YOUR domain) ---------- */
app.get('/sdk/xumm.min.js', async (req, res) => {
  const r = await fetch('https://xumm.app/assets/cdn/xumm.min.js');
  const js = await r.text();
  res.type('application/javascript').send(js);
});

app.get('/sdk/xrpl-latest-min.js', async (req, res) => {
  const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/xrpl/2.11.0/xrpl-latest-min.js');
  const js = await r.text();
  res.type('application/javascript').send(js);
});

/* ---------- HEALTH CHECK ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

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
app.get("/", (req, res) => res.type('html').send(html));

/* ---------- START SERVER (ONE listen only) ---------- */
const port = process.env.PORT || 3001;
const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
// ===== end app.js =====
