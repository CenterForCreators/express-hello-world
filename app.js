<!DOCTYPE html>
<html lang="en">
<head>
  <!-- BUILD TAG: CFC-FULL-FIX -->
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Center for Creators — CFC on XRPL</title>
  <meta name="description" content="Center for Creators — Faucet + Pay with Xaman on XRPL." />
  <style>
    :root { --bg:#0b1220; --card:#121a2b; --text:#f6f8ff; --muted:#9fb0d1; --accent:#7db8ff; --ok:#1fcf7c; --warn:#ffcc00; --err:#ff6b6b; --line:#7db8ff;}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
    a{color:var(--accent);text-decoration:none}
    .wrap{max-width:1100px;margin:0 auto;padding:22px}
    header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap}
    .brand{display:flex;align-items:center;gap:12px}
    .brand img{width:44px;height:44px;border-radius:10px;display:block;background:#7c3aed}
    h1{font-size:20px;margin:0;line-height:1.2}
    .btn{background:var(--accent);color:#091224;padding:10px 14px;border-radius:10px;border:0;font-weight:700;cursor:pointer}
    .btn.secondary{background:#cfe3ff;color:#041225}
    .btn.ghost{background:transparent;border:1px solid #2a3a60;color:var(--text)}
    .btn.small{padding:8px 10px;font-size:14px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
    .card{background:var(--card);border:1px solid #202c45;border-radius:16px;padding:18px}
    .muted{color:var(--muted)}
    .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .nft-img{width:100%;height:180px;background:#0e1527;border-radius:12px;object-fit:cover;display:block}
    input[type="email"], input[type="text"]{width:100%;outline:none;padding:10px;border-radius:10px;border:1px solid #2a3a60;background:#0e1527;color:#e8f0ff}
    footer{margin-top:30px;color:#9fb0d1;font-size:14px}
    .spinner{display:none;width:16px;height:16px;border-radius:50%;border:3px solid #2a3a60;border-top-color:var(--accent);animation:spin 0.9s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .status{margin-top:8px;font-size:14px}
    .status.ok{color:var(--ok)} .status.warn{color:var(--warn)} .status.err{color:var(--err)}
    .toast{position:fixed;right:16px;bottom:16px;display:none;background:#121a2b;border:1px solid #2a3a60;padding:10px 14px;border-radius:10px}
    .divider{height:2px;background:var(--line);border-radius:999px;margin:14px 0}
  </style>

  <!-- Xumm/Xaman SDK with fallbacks (load BEFORE we call new Xumm) -->
  <script>
    (function loadXumm(srcs, i){
      if(i>=srcs.length){ console.error('Xumm SDK failed'); return; }
      var s=document.createElement('script'); s.src=srcs[i]; s.async=true;
      s.onload=function(){ try{
        if(typeof Xumm!=='undefined' && !window.xumm){
          // Use your existing app UUID here (unchanged)
          window.xumm = new Xumm('ffa83df2-e68d-4172-a77c-e7af7e5274ea');
          console.log('Constructed Xumm Object');
        }
      }catch(e){} };
      s.onerror=function(){ loadXumm(srcs, i+1); };
      document.head.appendChild(s);
    })([
      'https://cdn.xumm.app/xumm.min.js',
      'https://cdn.xumm.pro/js/xumm.min.js',
      'https://cdn.xaman.app/xumm.min.js'
    ], 0);
  </script>

  <!-- XRPL SDK with fallbacks -->
  <script>
    (function loadXRPL(srcs, i){
      if(i>=srcs.length){ console.error('XRPL SDK failed'); return; }
      var s=document.createElement('script'); s.src=srcs[i]; s.async=true;
      s.onload=function(){ console.log('XRPL ready'); };
      s.onerror=function(){ loadXRPL(srcs, i+1); };
      document.head.appendChild(s);
    })([
      'https://unpkg.com/xrpl@2.11.0/dist/xrpl-latest-min.js',
      'https://cdn.jsdelivr.net/npm/xrpl@2.11.0/dist/xrpl-latest-min.js'
    ], 0);
  </script>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">
        <img alt="Center for Creators" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsSAAALEgHS3X78AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAKZJREFUeNpi/P//PwMlgImBQjDwA4o1ZyBqgA3EwGgEoWgJwz8QJmQmQGkGA4QkQ9QJQFQxwD4kGkA7ECr0A8T9B1gYxGkG0CwQ4j6g0g8iF9Jg0wCkZwB2QGkG4g0g0k8QGUT0G0G0g0o8g8g2k4wAkZyB2gYQeQbQGgQ0g4g8gB0Q1gMxFkGkCwBQAABBgAw3X1J7c9OapwAAAABJRU5ErkJggg==" />
        <h1>Center for Creators</h1>
      </div>
      <div class="row">
        <button id="connectBtn" class="btn" type="button">Connect Xaman</button>
      </div>
    </header>

    <div class="grid">
      <!-- Faucet -->
      <section id="faucet" class="card">
        <h2>Daily CFC Faucet</h2>
        <p class="muted">Claim 10 CFC once every 24 hours.</p>

        <!-- Keep ONE simple math captcha -->
        <div class="row" style="margin:8px 0">
          <span class="muted" id="capQ" style="min-width:140px;display:inline-block">Solve: 0 + 0 = ?</span>
          <input id="capA" type="text" inputmode="numeric" placeholder="Answer" style="max-width:140px"/>
          <button id="capRefresh" class="btn small" type="button">↻</button>
        </div>

        <div class="row" style="margin-top:10px">
          <button id="claimBtn" class="btn" type="button">Claim 10 CFC</button>
          <div id="claimSpin" class="spinner"></div>
        </div>
        <div id="claimStatus" class="status"></div>

        <!-- thin divider before the marketplace buttons area -->
        <div class="divider"></div>

        <div class="row">
          <button id="payCFC" class="btn" type="button">Pay CFC</button>
          <button id="payXRP" class="btn secondary" type="button">Pay XRP</button>
        </div>
      </section>

      <!-- Join List -->
      <section id="join" class="card">
        <h2>Join the list</h2>
        <p class="muted">Get updates from CenterForCreators.com</p>
        <div class="row" style="max-width:420px">
          <input id="joinEmail" type="email" placeholder="you@email.com"/>
          <button id="joinBtn" class="btn" type="button">Join</button>
          <div id="joinSpin" class="spinner"></div>
        </div>
        <div id="joinStatus" class="status"></div>
      </section>
    </div>

    <footer>
      © <span id="yr"></span> Center for Creators • XRPL
    </footer>
  </div>

  <div id="toast" class="toast"></div>

  <!-- Single, safe helpers & CONFIG (NO duplicates) -->
  <script>
    // Helper: no jQuery-style $, avoids conflicts
    function qs(id){ return document.getElementById(id); }

    // One safe CONFIG block
    window.CONFIG = window.CONFIG || {};
    Object.assign(window.CONFIG, {
      FAUCET_ENDPOINT: 'https://cfc-faucet.onrender.com/api/faucet',
      JOIN_ENDPOINT: 'https://cfc-faucet.onrender.com/api/join',
      PAY_CFC_URL: 'https://cfc-faucet.onrender.com/api/pay-cfc',
      PAY_XRP_URL: 'https://cfc-faucet.onrender.com/api/pay-xrp',
      faucetAmount: 10,
      currencyCode: 'CFC',
      USE_CORS_PROXY: false,     // leave false now that server CORS is set
      CORS_PROXY: 'https://cors.isomorphic-git.org/' // only used if you set USE_CORS_PROXY=true
    });
    var CONFIG = window.CONFIG; // var on purpose (no "already declared")
  </script>

  <!-- App logic -->
  <script>
    // Footer year & simple toast
    qs('yr').textContent = new Date().getFullYear();
    function toast(t){
      var el=qs('toast'); el.textContent=t; el.style.display='block';
      clearTimeout(window.__t); window.__t=setTimeout(()=>el.style.display='none',2500);
    }

    // Captcha
    let a=0,b=0;
    function genCap(){
      a = Math.floor(Math.random()*10);
      b = Math.floor(Math.random()*10);
      qs('capQ').textContent = `Solve: ${a} + ${b} = ?`;
      qs('capA').value='';
    }
    document.addEventListener('DOMContentLoaded', genCap);
    qs('capRefresh').addEventListener('click', genCap);

    // Xaman connect
    async function connectXaman(){
      try{
        if(!window.xumm){ toast('Xaman SDK not ready'); return; }
        const ping = await xumm.ping();
        if(ping?.pushed){ toast('Xaman ready'); } else { toast('Open Xaman to continue'); }
      }catch(e){ console.error(e); toast('Connect error'); }
    }
    qs('connectBtn').addEventListener('click', connectXaman);

    // Fetch wrapper with optional CORS proxy (off by default)
    async function postJson(url, data){
      const target = CONFIG.USE_CORS_PROXY ? `${CONFIG.CORS_PROXY}${url}` : url;
      const r = await fetch(target, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data||{})
      });
      // If a proxy returns 2xx but inner failed, try parse anyway
      return r.json();
    }

    // CLAIM
    qs('claimBtn').addEventListener('click', async function(){
      const ans = parseInt(qs('capA').value,10);
      const status = qs('claimStatus'); const spin = qs('claimSpin');
      if(isNaN(ans) || ans !== (a+b)){
        status.className='status err'; status.textContent='Wrong math answer'; return;
      }
      status.className='status warn'; status.textContent='Sending…'; spin.style.display='inline-block';
      try{
        const j = await postJson(CONFIG.FAUCET_ENDPOINT, { captcha_ok:true });
        if(j && j.ok){
          status.className='status ok'; status.textContent=`✅ ${CONFIG.faucetAmount} ${CONFIG.currencyCode} sent!`;
          genCap();
        }else{
          status.className='status err';
          status.textContent = (j && j.error) ? j.error : 'Request failed';
        }
      }catch(e){
        console.error(e);
        status.className='status err'; status.textContent='Network error';
      }finally{
        spin.style.display='none';
      }
    });

    // JOIN
    qs('joinBtn').addEventListener('click', async function(){
      const email = (qs('joinEmail').value||'').trim();
      const status = qs('joinStatus'); const spin = qs('joinSpin');
      if(!email || !/^\S+@\S+\.\S+$/.test(email)){
        status.className='status err'; status.textContent='Enter a valid email'; return;
      }
      status.className='status warn'; status.textContent='Submitting…'; spin.style.display='inline-block';
      try{
        const j = await postJson(CONFIG.JOIN_ENDPOINT, { email });
        if(j && j.ok){
          status.className='status ok'; status.textContent='🎉 You’re in!';
          qs('joinEmail').value='';
        }else{
          status.className='status err';
          status.textContent = (j && j.error) ? j.error : 'Join failed';
        }
      }catch(e){
        console.error(e);
        status.className='status err'; status.textContent='Network error';
      }finally{
        spin.style.display='none';
      }
    });

    // Support/Buy buttons
    qs('payCFC').addEventListener('click', ()=> window.open(CONFIG.PAY_CFC_URL,'_blank'));
    qs('payXRP').addEventListener('click', ()=> window.open(CONFIG.PAY_XRP_URL,'_blank'));
  </script>
</body>
</html>
