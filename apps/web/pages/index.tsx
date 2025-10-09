import { FormEvent, useEffect, useState } from 'react';

interface JobResponse {
  ok: boolean;
  job?: {
    id: string;
    status: string;
    result?: {
      estimateId?: string;
      pdfFileName?: string;
      unresolved?: Array<{ lineIndex: number; reason: string; suggestions: string[] }>;
    };
    error?: string;
    updatedAt: string;
  };
  error?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse['job'] | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
        const json: JobResponse = await res.json();
        if (json.ok && json.job) {
          setJob(json.job);
          setStatus(json.job.status);
          if (json.job.status === 'completed' || json.job.status === 'failed') {
            clearInterval(interval);
          }
        } else if (!json.ok) {
          setError(json.error ?? 'Unknown error');
          clearInterval(interval);
        }
      } catch (err) {
        setError((err as Error).message);
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus('');
    setJob(null);
    setJobId(null);

    if (!file) {
      setError('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (customerName) formData.append('customerName', customerName);

    try {
      const response = await fetch(`${API_BASE}/api/ingest`, {
        method: 'POST',
        body: formData
      });

      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? 'Failed to ingest');
        return;
      }

      setJobId(json.jobId);
      setStatus(json.status);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '24px', background: '#fff', borderRadius: 12 }}>
      <h1>Simpro Quote Agent</h1>
      <p>Upload a project PDF to generate a quote automatically.</p>

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
          Floor Plan / Scope PDF
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            style={{ marginTop: 4 }}
          />
        </label>
        <button type="submit" style={{ padding: '12px 16px', background: '#0061ff', color: '#fff', border: 'none', borderRadius: 8 }}>
          Start Quote Run
        </button>
      </form>

      {status && (
        <section style={{ marginTop: 24 }}>
          <h2>Status: {status}</h2>
          {job?.result?.estimateId && <p>Estimate ID: {job.result.estimateId}</p>}
          {job?.result?.pdfFileName && <p>Generated PDF: {job.result.pdfFileName}</p>}
          {job?.result?.unresolved && job.result.unresolved.length > 0 && (
            <div>
              <h3>Unresolved Items</h3>
              <ul>
                {job.result.unresolved.map((item) => (
                  <li key={item.lineIndex}>
                    Line {item.lineIndex + 1}: {item.reason} — Suggestions: {item.suggestions.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {job?.error && <p style={{ color: 'red' }}>Error: {job.error}</p>}
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
