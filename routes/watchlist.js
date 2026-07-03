import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUserWatchlist, addToUserWatchlist, removeFromUserWatchlist } from '../db/index.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const list = getUserWatchlist(req.user.user_id);
  res.json({ watchlist: list });
});

router.post('/', requireAuth, (req, res) => {
  const { ticker, display, name, type } = req.body;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });
  try {
    addToUserWatchlist(req.user.user_id, {
      ticker: ticker.toUpperCase(),
      display: display || ticker.toUpperCase(),
      name: name || ticker.toUpperCase(),
      type: type || 'stock',
    });
    res.json({ watchlist: getUserWatchlist(req.user.user_id) });
  } catch (err) {
    if (err.message === 'already in watchlist') {
      return res.status(409).json({ error: 'already in watchlist' });
    }
    throw err;
  }
});

router.delete('/:ticker', requireAuth, (req, res) => {
  removeFromUserWatchlist(req.user.user_id, req.params.ticker.toUpperCase());
  res.json({ watchlist: getUserWatchlist(req.user.user_id) });
});

export default router;
