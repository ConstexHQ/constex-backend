import { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  saveOtp, consumeOtp, findUserByEmail, createUser,
  createSession, validateSession, deleteSession, seedUserWatchlist,
} from '../db/index.js';
import { RESEND_API_KEY } from '../config.js';
import { DEFAULT_WATCHLIST } from '../data/watchlist.js';

const router = Router();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtp(email, code) {
  if (!RESEND_API_KEY) {
    console.log(`[auth] OTP for ${email}: ${code}  (RESEND_API_KEY not set — logged only)`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Constex <noreply@constexhq.com>',
      to: [email],
      subject: 'Your Constex access code',
      html: `
        <div style="font-family:monospace;background:#0a0a0a;color:#fff;padding:32px;max-width:420px;">
          <div style="font-size:22px;font-weight:700;letter-spacing:0.04em;margin-bottom:6px;">CONSTEX</div>
          <div style="color:#6b6b6b;font-size:11px;margin-bottom:28px;letter-spacing:0.06em;">INSTITUTIONAL INTELLIGENCE. RETAIL ACCESS.</div>
          <div style="font-size:10px;letter-spacing:0.12em;color:#A0A0A0;margin-bottom:10px;">YOUR ACCESS CODE</div>
          <div style="font-size:40px;font-weight:700;letter-spacing:0.24em;color:#00C853;margin-bottom:18px;">${code}</div>
          <div style="font-size:10px;color:#6b6b6b;line-height:1.6;">Expires in 10 minutes. Do not share this code.</div>
        </div>
      `,
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`Resend error: ${err.message || r.status}`);
  }
}

// POST /api/auth/request-otp
router.post('/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' });
  }
  const code = generateOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  saveOtp(email.toLowerCase(), code, expires);
  try {
    await sendOtp(email, code);
  } catch (err) {
    console.error('[auth] Failed to send OTP:', err.message);
    return res.status(500).json({ error: 'Failed to send code. Please try again.' });
  }
  res.json({ ok: true });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'email and code required' });

  const valid = consumeOtp(email.toLowerCase(), String(code).trim());
  if (!valid) return res.status(401).json({ error: 'Invalid or expired code.' });

  let user = findUserByEmail(email.toLowerCase());
  let isNew = false;
  if (!user) {
    user = createUser(randomUUID(), email.toLowerCase());
    isNew = true;
    seedUserWatchlist(user.id, DEFAULT_WATCHLIST);
  }

  const token = createSession(user.id);
  res.json({ token, user: { id: user.id, email: user.email, tier: user.tier }, isNew });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const session = validateSession(auth.slice(7));
  if (!session) return res.status(401).json({ error: 'invalid or expired session' });
  res.json({ user: { id: session.user_id, email: session.email, tier: session.tier } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) deleteSession(auth.slice(7));
  res.json({ ok: true });
});

export default router;
