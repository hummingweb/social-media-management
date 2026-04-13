import { supabase } from './supabase.js';

async function authHeaders(extra = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = await authHeaders(formData ? {} : { 'Content-Type': 'application/json' });
  const res = await fetch(path.startsWith('http') ? path : `/api${path}`, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}
