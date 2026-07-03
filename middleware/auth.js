import { validateSession } from '../db/index.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const session = validateSession(auth.slice(7));
  if (!session) return res.status(401).json({ error: 'invalid or expired session' });
  req.user = session;
  next();
}
