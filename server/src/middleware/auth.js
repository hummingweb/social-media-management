import { authenticateRequest } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
  const session = await authenticateRequest(req.headers.authorization);
  if (!session) return res.status(401).json({ error: 'unauthorized' });
  req.user = session.user;
  req.profile = session.profile;
  next();
}

// Same as requireAuth but tolerates a missing profile (used by /me/bootstrap).
export async function requireUser(req, res, next) {
  const session = await authenticateRequest(req.headers.authorization);
  if (!session?.user) return res.status(401).json({ error: 'unauthorized' });
  req.user = session.user;
  req.profile = session.profile;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

// A client user can only touch resources tied to their client_id.
// Admin / account_manager / designer can touch any client.
export function scopeToClient(resourceClientId, profile) {
  if (profile.role === 'client') return profile.client_id === resourceClientId;
  return true;
}
