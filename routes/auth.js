import { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  findUserByEmail, createUser,
  createSession, validateSession, deleteSession, seedUserWatchlist,
} from '../db/index.js';
import { DEFAULT_WATCHLIST } from '../data/watchlist.js';

const NOTION_API_KEY = process.env.NOTION_API_KEY || '';
const NOTION_USERS_DB = process.env.NOTION_USERS_DB || '3adc7f8e-47b4-8189-af58-c8911e8d990a';

const router = Router();

async function logUserToNotion(email, isNew) {
  if (!NOTION_API_KEY) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    if (isNew) {
      await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: NOTION_USERS_DB },
          properties: {
            Email: { title: [{ text: { content: email } }] },
            'First Seen': { date: { start: today } },
            'Last Active': { date: { start: today } },
            Tier: { select: { name: 'free' } },
          },
        }),
      });
    } else {
      const search = await fetch(`https://api.notion.com/v1/databases/${NOTION_USERS_DB}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filter: { property: 'Email', title: { equals: email } } }),
      });
      const data = await search.json();
      if (data.results?.[0]) {
        await fetch(`https://api.notion.com/v1/pages/${data.results[0].id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties: { 'Last Active': { date: { start: today } } } }),
        });
      }
    }
  } catch (err) {
    console.error('[auth] Notion log failed:', err.message);
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' });
  }
  const normalized = email.toLowerCase().trim();
  let user = findUserByEmail(normalized);
  let isNew = false;
  if (!user) {
    user = createUser(randomUUID(), normalized);
    isNew = true;
    seedUserWatchlist(user.id, DEFAULT_WATCHLIST);
  }
  const token = createSession(user.id);
  logUserToNotion(normalized, isNew).catch(() => {});
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
