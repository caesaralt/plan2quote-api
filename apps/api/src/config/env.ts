import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000'),
  SIMPRO_API_BASE: z.string().url().optional(),
  SIMPRO_TOKEN_URL: z.string().url().optional(),
  SIMPRO_CLIENT_ID: z.string().optional(),
  SIMPRO_CLIENT_SECRET: z.string().optional(),
  SIMPRO_SCOPES: z.string().optional(),
  SIMPRO_COMPANY_ID: z.string().optional(),
  BRAND_COMPANY_NAME: z.string().optional(),
  BRAND_ABN: z.string().optional(),
  BRAND_ADDRESS: z.string().optional(),
  BRAND_PHONE: z.string().optional(),
  BRAND_EMAIL: z.string().optional(),
  DEFAULT_MARGIN_PERCENT: z.string().default('15'),
  MIN_CALLOUT_FEE_EX_GST: z.string().default('0'),
  JOB_DATABASE_PATH: z.string().default('apps/api/data/jobs.db'),
  NEXT_PUBLIC_API_BASE_URL: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = {
  ...parsed.data,
  DEFAULT_MARGIN_PERCENT: Number(parsed.data.DEFAULT_MARGIN_PERCENT),
  MIN_CALLOUT_FEE_EX_GST: Number(parsed.data.MIN_CALLOUT_FEE_EX_GST)
};
