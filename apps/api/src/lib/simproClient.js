import { getSimproToken } from './simproAuth.js';

const apiBaseEnv = (process.env.SIMPRO_API_BASE || '').trim();
if (!apiBaseEnv) {
  throw new Error('Missing SIMPRO_API_BASE env');
}

const API_BASE = `${apiBaseEnv}/api/v1.0`;

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
    let txt = '';
    try {
      txt = await res.text();
    } catch (error) {
      txt = '';
    }
    throw new Error(`${init.method || 'GET'} ${path} failed ${res.status}: ${txt}`);
  }
  return res.status === 204 ? null : res.json();
};

export const resolveCompanyId = async () => {
  const envId = process.env.SIMPRO_COMPANY_ID;
  if (envId && String(envId).trim().length > 0) {
    return Number(envId);
  }

  try {
    const data = await request(`/companies`);
    if (data && typeof data === 'object' && Array.isArray(data.errors)) {
      const firstMessage = data.errors[0]?.message;
      if (firstMessage && /invalid route/i.test(firstMessage)) {
        return 0;
      }
    }
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : [];
    if (items.length && items[0]?.id != null) {
      return Number(items[0].id);
    }
  } catch (error) {
    const message = String(error?.message || '');
    if (/failed\s+404/i.test(message) || /invalid route/i.test(message)) {
      return 0;
    }
    throw error;
  }

  return 0;
};

export const findOrCreateCompanyCustomer = async (companyId, name, email) => {
  const searchTerm = email && email.trim().length > 0 ? email : name;
  const query = `?search=${encodeURIComponent(searchTerm)}`;
  const data = await request(`/companies/${companyId}/customers/companies${query}`);
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
      ? data
      : [];
  if (items.length > 0) {
    return items[0].id;
  }

  const created = await request(`/companies/${companyId}/customers/companies`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      ...(email && email.trim().length > 0 ? { email } : {})
    })
  });
  return created.id;
};

const postJson = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

export const createDraftQuote = async (companyId, customerId, description) => {
  const payload = { customer: { id: customerId }, stage: 'Draft', description };
  try {
    const quote = await postJson(`/companies/${companyId}/quotes`, payload);
    return { id: quote.id, number: quote.quoteNumber ?? quote.number ?? String(quote.id) };
  } catch (error) {
    const message = String(error?.message || '');
    if (!/failed\s+404/i.test(message) && !/invalid route/i.test(message)) {
      throw error;
    }
  }

  const estimate = await postJson(`/companies/${companyId}/estimates`, payload);
  return { id: estimate.id, number: estimate.number ?? estimate.estimateNumber ?? String(estimate.id) };
};
