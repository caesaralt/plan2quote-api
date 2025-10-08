import { URLSearchParams } from "node:url";

const TOKEN_URL = process.env.SIMPRO_TOKEN_URL!;
const CLIENT_ID = process.env.SIMPRO_CLIENT_ID!;
const CLIENT_SECRET = process.env.SIMPRO_CLIENT_SECRET!;
const SCOPES = process.env.SIMPRO_SCOPES || "";

let cached: { access_token: string; expires_at: number } | null = null;

export async function getSimproToken(): Promise<string> {
  if (!TOKEN_URL || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing SIMPRO_* envs");
  }
  const now = Date.now();
  if (cached && now < cached.expires_at - 30_000) return cached.access_token;

  const body = new URLSearchParams({ grant_type: "client_credentials", scope: SCOPES });
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token failed ${res.status}: ${text}`);
  }
  const json: any = await res.json();
  const ttl = (json.expires_in ?? 3600) * 1000;
  cached = { access_token: json.access_token, expires_at: now + ttl };
  return json.access_token;
}
