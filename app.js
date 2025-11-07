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

    const client = new xrpl.Client(process.env.RIPPLED_URL || 'wss://s2.ripple.com');
    await client.connect();

    // Check Trustline first
    const al = await client.request({ command: 'account_lines', account, ledger_index: 'validated', peer: issuer });
    const hasLine = (al.result?.lines || []).some(l => l.currency === currency);
    if (!hasLine) {
      await client.disconnect();
      return res.status(400).json({ ok: false, error: 'No CFC trustline. Please add trustline first.' });
    }

    const wallet = xrpl.Wallet.fromSeed(seed);

    // Build Payment TX
    const tx = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: account,
      Amount: { currency, issuer, value }
    };

    // autofill to add Fee, Sequence, and set ~20-ledger TTL
    const filled = await client.autofill(tx, { maxLedgerVersionOffset: 20 });

    // Sign + Submit
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
