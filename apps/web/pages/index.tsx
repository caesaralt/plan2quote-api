import { FormEvent, useState } from 'react';

interface QuoteResponse {
  ok: boolean;
  companyId?: number | string;
  customerId?: number | string;
  quote?: { id: number | string; number: string };
  error?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [result, setResult] = useState<
    | { companyId: number | string; customerId: number | string; quote: { id: number | string; number: string } }
    | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (customerName.trim().length > 0) formData.append('customerName', customerName.trim());
    if (customerEmail.trim().length > 0) formData.append('customerEmail', customerEmail.trim());

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/ingest`, {
        method: 'POST',
        body: formData
      });

      const json: QuoteResponse = await response.json();
      if (!json.ok || !json.quote || json.companyId == null || json.customerId == null) {
        setError(json.error ?? 'Failed to generate quote');
        return;
      }

      setResult({ companyId: json.companyId, customerId: json.customerId, quote: json.quote });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '24px', background: '#fff', borderRadius: 12 }}>
      <h1>Simpro Quote Agent</h1>
      <p>Upload a project PDF to generate a draft quote in Simpro.</p>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label>
          Customer Name
          <input
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Acme Pty Ltd"
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Customer Email (optional)
          <input
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="quotes@acme.com.au"
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Floor Plan / Scope PDF
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            style={{ marginTop: 4 }}
          />
        </label>
        <button
          type="submit"
          style={{ padding: '12px 16px', background: '#0061ff', color: '#fff', border: 'none', borderRadius: 8 }}
          disabled={loading}
        >
          {loading ? 'Generating…' : 'Generate Quote'}
        </button>
      </form>

      {result && (
        <section style={{ marginTop: 24, background: '#f5f7ff', padding: 16, borderRadius: 8 }}>
          <h2>Quote Created</h2>
          <p>Company ID: {result.companyId}</p>
          <p>Customer ID: {result.customerId}</p>
          <p>
            Quote Number: <strong>{result.quote.number}</strong> (ID: {result.quote.id})
          </p>
        </section>
      )}

      {error && (
        <p style={{ color: 'red', marginTop: 16 }}>
          {error}
        </p>
      )}
    </main>
  );
}
