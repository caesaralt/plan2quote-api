import { getSimproToken } from './simproAuth.js';

const base = process.env.SIMPRO_API_BASE;
if (!base) {
  throw new Error('Missing SIMPRO_API_BASE env');
}

const API_BASE = `${base}/api/v1.0`;

const request = async (path, init = {}) => {
  const token = await getSimproToken();
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${init.method || 'GET'} ${path} failed ${res.status}: ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
};

export const resolveCompanyId = async () => {
  const envId = process.env.SIMPRO_COMPANY_ID;
  if (envId) return Number(envId);
  const data = await request(`/companies`);
  const items = (data?.items ?? data) || [];
  if (!Array.isArray(items) || items.length === 0) throw new Error('No companies returned from Simpro');
  return items[0].id;
};

export const findOrCreateCompanyCustomer = async (companyId, name, email) => {
  const params = email ? `?search=${encodeURIComponent(email)}` : '';
  const data = await request(`/companies/${companyId}/customers/companies${params}`);
  const items = (data?.items ?? data) || [];
  if (Array.isArray(items) && items.length > 0) return items[0].id;

  const created = await request(`/companies/${companyId}/customers/companies`, {
    method: 'POST',
    body: JSON.stringify({ name, ...(email ? { email } : {}) })
  });
  return created.id;
};

export const createDraftQuote = async (companyId, customerId, description) => {
  const payload = {
    customer: { id: customerId },
    stage: 'Draft',
    description
  };
  const q = await request(`/companies/${companyId}/quotes`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return { id: q.id, number: q.quoteNumber ?? q.number ?? `Q-${q.id}` };
};
