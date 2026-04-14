import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

// For staff users (admin/AM), let them pick which client they're managing
// billing for. For client users we use their own client_id implicitly.
export default function Billing() {
  const { profile } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [plans, setPlans] = useState([]);
  const [sub, setSub] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const isClient = profile.role === 'client';

  useEffect(() => {
    api('/billing/plans').then(setPlans).catch(console.error);
    if (!isClient) {
      api('/clients').then((cs) => {
        setClients(cs);
        if (cs[0]) setClientId(cs[0].id);
      });
    }
  }, []);

  useEffect(() => {
    const q = isClient ? '' : clientId ? `?client_id=${clientId}` : null;
    if (q === null) return;
    api(`/billing/subscription${q}`).then(setSub).catch(console.error);
    api(`/billing/invoices${q}`).then(setInvoices).catch(console.error);
  }, [clientId, isClient]);

  async function startCheckout(planId) {
    setBusy(true);
    setErr(null);
    try {
      const body = isClient ? { plan_id: planId } : { plan_id: planId, client_id: clientId };
      const { url } = await api('/billing/checkout', { method: 'POST', body });
      window.location.href = url;
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setErr(null);
    try {
      const body = isClient ? {} : { client_id: clientId };
      const { url } = await api('/billing/portal', { method: 'POST', body });
      window.location.href = url;
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const usagePct =
    sub?.monthly_post_limit && sub.monthly_post_limit > 0
      ? Math.min(100, Math.round((sub.posts_this_period / sub.monthly_post_limit) * 100))
      : null;

  return (
    <div>
      <h2>Billing</h2>

      {!isClient && (
        <div className="card">
          <div className="field">
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {sub && (
        <div className="card">
          <div className="row between">
            <div>
              <div className="muted">Current plan</div>
              <h3 style={{ margin: '4px 0' }}>{sub.plan?.name || 'No active plan'}</h3>
              <div className="muted">
                Status: <span className={`badge ${sub.status === 'active' ? 'approved' : 'failed'}`}>
                  {sub.status}
                </span>
                {sub.cancel_at_period_end && <span className="muted"> · cancels at period end</span>}
              </div>
              {sub.current_period_end && (
                <div className="muted">Renews {new Date(sub.current_period_end).toLocaleDateString()}</div>
              )}
            </div>
            {sub.plan && (
              <button onClick={openPortal} disabled={busy}>
                Manage subscription
              </button>
            )}
          </div>

          {sub.monthly_post_limit != null && (
            <div style={{ marginTop: 16 }}>
              <div className="muted">
                {sub.posts_this_period} / {sub.monthly_post_limit} posts this period
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, marginTop: 4 }}>
                <div
                  style={{
                    width: `${usagePct}%`,
                    height: '100%',
                    background: usagePct >= 100 ? 'var(--danger)' : 'var(--primary)',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {err && <div className="card" style={{ borderColor: 'var(--danger)' }}>{err}</div>}

      <h3>Invoice history</h3>
      <div className="card">
        {invoices.length === 0 ? (
          <div className="muted">No invoices yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Invoice</th>
                <th align="left">Date</th>
                <th align="right">Amount</th>
                <th align="left">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0' }}>{inv.number || inv.id}</td>
                  <td>{new Date(inv.created * 1000).toLocaleDateString()}</td>
                  <td align="right">
                    {formatMoney(inv.amount_paid || inv.amount_due, inv.currency)}
                  </td>
                  <td>
                    <span className={`badge ${invoiceBadgeClass(inv.status)}`}>{inv.status}</span>
                  </td>
                  <td align="right">
                    {inv.hosted_invoice_url && (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">View</a>
                    )}
                    {inv.hosted_invoice_url && inv.invoice_pdf && <span className="muted"> · </span>}
                    {inv.invoice_pdf && (
                      <a href={inv.invoice_pdf} target="_blank" rel="noreferrer">PDF</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h3>Plans</h3>
      <div className="grid grid-3">
        {plans.map((p) => {
          const current = sub?.plan?.id === p.id;
          return (
            <div key={p.id} className="card">
              <h3 style={{ marginTop: 0 }}>{p.name}</h3>
              <div style={{ fontSize: 24, fontWeight: 600 }}>
                ${(p.monthly_price_cents / 100).toFixed(0)}
                <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> / month</span>
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                {p.monthly_post_limit ? `${p.monthly_post_limit} posts / month` : 'Unlimited posts'}
              </div>
              <button
                style={{ marginTop: 12, width: '100%' }}
                disabled={busy || current}
                onClick={() => (sub?.plan ? openPortal() : startCheckout(p.id))}
              >
                {current ? 'Current plan' : sub?.plan ? 'Change plan' : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatMoney(amountMinor, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format((amountMinor || 0) / 100);
  } catch {
    return `${((amountMinor || 0) / 100).toFixed(2)} ${currency || ''}`.trim();
  }
}

function invoiceBadgeClass(status) {
  switch (status) {
    case 'paid': return 'approved';
    case 'open': return 'in_review';
    case 'uncollectible':
    case 'void': return 'failed';
    default: return 'draft';
  }
}
