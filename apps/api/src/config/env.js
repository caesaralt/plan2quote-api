import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envCache = {};

const loadDotEnv = () => {
  if (Object.keys(envCache).length > 0) return;
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in envCache)) {
      envCache[key] = value.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
  }
};

const read = (key, fallback = '') => {
  if (process.env[key] !== undefined) return process.env[key];
  loadDotEnv();
  if (envCache[key] !== undefined) return envCache[key];
  return fallback;
};

const readNumber = (key, fallback) => {
  const value = read(key);
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const env = {
  NODE_ENV: read('NODE_ENV', 'development'),
  PORT: readNumber('PORT', 3000),
  SIMPRO_API_BASE: read('SIMPRO_API_BASE', ''),
  SIMPRO_TOKEN_URL: read('SIMPRO_TOKEN_URL', ''),
  SIMPRO_CLIENT_ID: read('SIMPRO_CLIENT_ID', ''),
  SIMPRO_CLIENT_SECRET: read('SIMPRO_CLIENT_SECRET', ''),
  SIMPRO_SCOPES: read('SIMPRO_SCOPES', ''),
  SIMPRO_COMPANY_ID: read('SIMPRO_COMPANY_ID', ''),
  BRAND_COMPANY_NAME: read('BRAND_COMPANY_NAME', 'Simpro Quote Agent'),
  BRAND_ABN: read('BRAND_ABN', ''),
  BRAND_ADDRESS: read('BRAND_ADDRESS', ''),
  BRAND_PHONE: read('BRAND_PHONE', ''),
  BRAND_EMAIL: read('BRAND_EMAIL', ''),
  DEFAULT_MARGIN_PERCENT: readNumber('DEFAULT_MARGIN_PERCENT', 15),
  MIN_CALLOUT_FEE_EX_GST: readNumber('MIN_CALLOUT_FEE_EX_GST', 0),
  JOB_DATABASE_PATH: read('JOB_DATABASE_PATH', 'apps/api/data/jobs.json'),
  NEXT_PUBLIC_API_BASE_URL: read('NEXT_PUBLIC_API_BASE_URL', '')
};
