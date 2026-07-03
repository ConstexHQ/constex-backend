import { Router } from 'express';

const router = Router();

router.post('/', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const key = process.env.NOTION_API_KEY;
  const db  = process.env.NOTION_DATABASE_ID;

  if (key && db) {
    try {
      const r = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: db },
          properties: {
            Email:     { title: [{ text: { content: email } }] },
            Submitted: { date:  { start: new Date().toISOString() } },
          },
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        console.error('[gate] Notion error:', err.message || r.status);
      }
    } catch (err) {
      console.error('[gate] Notion fetch failed:', err.message);
    }
  } else {
    console.warn('[gate] NOTION_API_KEY or NOTION_DATABASE_ID not set — skipping Notion write');
  }

  // Always return ok — never block the user
  res.json({ ok: true });
});

export default router;
