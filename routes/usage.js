import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUsage } from '../db/index.js';
import { FREE_REPORT_CAP, PAID_REPORT_CAP } from '../config.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const used = getUsage(req.user.user_id);
  const cap = req.user.tier === 'paid' ? PAID_REPORT_CAP : FREE_REPORT_CAP;
  const now = new Date();
  const resets = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  res.json({
    used,
    cap,
    tier: req.user.tier,
    month: now.toISOString().slice(0, 7),
    resets_on: resets.toISOString(),
  });
});

export default router;
