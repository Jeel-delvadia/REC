import { supabase, supabaseEnabled } from '../lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function authHeader() {
  // RS-16: attaches the auditor's Supabase session token so the backend's get_current_auditor
  // can verify it. Harmless to send on GET requests too - the backend only checks it on the
  // auditor-only write routes. Silently omitted when Supabase isn't configured or there's no
  // session yet (backend then falls back to its own local-dev identity).
  if (!supabaseEnabled) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: res.statusText }));
      let msg = res.statusText;
      if (typeof errorData.detail === 'string') {
        msg = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        msg = errorData.detail.map(d => `${d.loc ? d.loc.join('.') + ': ' : ''}${d.msg}`).join(', ');
      } else if (errorData.detail) {
        msg = JSON.stringify(errorData.detail);
      }
      throw new Error(msg || `HTTP Error ${res.status}`);
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('image/svg+xml')) {
      return await res.text();
    }
    if (contentType && contentType.includes('application/pdf')) {
      return await res.blob();
    }
    return await res.json();
  } catch (err) {
    console.error(`API Request Error [${endpoint}]:`, err);
    throw err;
  }
}

export async function checkBackendHealth() {
  try {
    const res = await fetch('/health');
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return { status: 'ok' };
}

export async function fetchDashboardSummary() {
  return request('/dashboard/summary');
}

export async function fetchPlants() {
  return request('/recs/plants');
}

export async function createRec(data) {
  return request('/recs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchRecs({ search, band, min_score, status, date_from, date_to, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (band) params.append('band', band);
  if (min_score !== undefined && min_score !== null && min_score !== '') params.append('min_score', min_score);
  if (status) params.append('status', status);
  if (date_from) params.append('date_from', date_from);
  if (date_to) params.append('date_to', date_to);

  const safeLimit = Math.min(Math.max(1, limit), 200);
  params.append('limit', safeLimit);
  params.append('offset', offset);

  return request(`/recs?${params.toString()}`);
}

export async function fetchRecDetail(recId) {
  return request(`/recs/${encodeURIComponent(recId)}`);
}

export async function verifyRec(recId) {
  return request(`/recs/${encodeURIComponent(recId)}/verify`, {
    method: 'POST',
  });
}

export async function submitAuditAction(recId, { action, auditor, note }) {
  return request(`/recs/${encodeURIComponent(recId)}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action, auditor, note }),
  });
}

export async function fetchRecReport(recId) {
  return request(`/recs/${encodeURIComponent(recId)}/report`);
}

export async function fetchRecLedgerHistory(recId) {
  return request(`/recs/${encodeURIComponent(recId)}/history`);
}

export async function fetchGraph(recId = null) {
  const endpoint = recId ? `/graph?rec_id=${encodeURIComponent(recId)}` : '/graph';
  return request(endpoint);
}

export async function verifyLedgerIntegrity() {
  return request('/ledger/verify');
}

export async function fetchAlerts(openOnly = false, limit = 50) {
  const safeLimit = Math.min(Math.max(1, limit), 200);
  return request(`/alerts?open_only=${openOnly}&limit=${safeLimit}`);
}

export async function fetchPublicVerification(recId) {
  return request(`/public/verify/${encodeURIComponent(recId)}`);
}

export async function triggerDataIngest(reset = true, verify = true) {
  return request('/ingest', {
    method: 'POST',
    body: JSON.stringify({ reset, verify }),
  });
}
