import { getSimproToken } from "./simproAuth";

const base = process.env.SIMPRO_API_BASE;
if (!base) {
  throw new Error("Missing SIMPRO_API_BASE env");
}

const API_BASE = `${base}/api/v1.0`;

async function request(path: string, init: RequestInit = {}) {
  const token = await getSimproToken();
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${init.method || "GET"} ${path} failed ${res.status}: ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function resolveCompanyId(): Promise<number> {
  const envId = process.env.SIMPRO_COMPANY_ID;
  if (envId) return Number(envId);
  const data = await request(`/companies`);
  const items = (data?.items ?? data) as any[];
  if (!items?.length) throw new Error("No companies returned from Simpro");
  return items[0].id;
}

export async function findOrCreateCompanyCustomer(companyId: number, name: string, email?: string) {
  const params = email ? `?search=${encodeURIComponent(email)}` : "";
  const data = await request(`/companies/${companyId}/customers/companies${params}`);
  const items = (data?.items ?? data) as any[];
  if (items?.length) return items[0].id;

  const created = await request(`/companies/${companyId}/customers/companies`, {
    method: "POST",
    body: JSON.stringify({ name, ...(email ? { email } : {}) })
  });
  return created.id;
}

export async function createDraftQuote(companyId: number, customerId: number, description: string) {
  const payload = {
    customer: { id: customerId },
    stage: "Draft",
    description
  };
  const q = await request(`/companies/${companyId}/quotes`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return { id: q.id, number: q.quoteNumber ?? q.number ?? `Q-${q.id}` };
}
