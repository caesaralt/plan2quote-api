import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { computeDocumentHash } from '../lib/idempotency.js';
import { parsePdf } from '../lib/parsePdf.js';
import { reconcileLines } from '../lib/reconcile.js';
import { applyPricing } from '../lib/pricing.js';
import { buildQuotePdf } from '../lib/pdf.js';
import { createDraftQuote, findOrCreateCompanyCustomer, resolveCompanyId } from '../lib/simproClient.js';
import { jobStore } from './jobStore.js';
import { logger } from '../lib/logger.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export const uploadMiddleware = upload.single('file');

const DEFAULT_CUSTOMER_NAME = 'Automated Customer';

export const ensureDraftQuote = async ({ customerName, customerEmail, description }) => {
  const name = customerName && customerName.trim().length > 0 ? customerName.trim() : DEFAULT_CUSTOMER_NAME;
  const email = customerEmail && customerEmail.trim().length > 0 ? customerEmail.trim() : undefined;
  const companyId = await resolveCompanyId();
  const customerId = await findOrCreateCompanyCustomer(companyId, name, email);
  const quote = await createDraftQuote(
    companyId,
    customerId,
    description && description.trim().length > 0 ? description.trim() : `Automated quote for ${name}`
  );
  return { companyId, customerId, quote };
};

export const ingestHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Missing file field "file"' });
    }

    const customerName = typeof req.body?.customerName === 'string' ? req.body.customerName : '';
    const customerEmail = typeof req.body?.customerEmail === 'string' ? req.body.customerEmail : '';

    const hash = computeDocumentHash(req.file.buffer, customerName);
    const existing = jobStore.findByHash(hash);
    if (existing && existing.status === 'completed' && existing.result?.quote) {
      return res.json({
        ok: true,
        reused: true,
        companyId: existing.result.companyId,
        customerId: existing.result.customerId,
        quote: existing.result.quote
      });
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const job = {
      id,
      status: 'pending',
      hash,
      payload: {
        customerName,
        customerEmail,
        originalFileName: req.file.originalname,
        fileBase64: req.file.buffer.toString('base64')
      },
      createdAt: now,
      updatedAt: now
    };

    jobStore.upsertJob(job);

    const outcome = await runJob({ ...job }, req.file.buffer);

    return res.json({ ok: true, companyId: outcome.companyId, customerId: outcome.customerId, quote: outcome.quote });
  } catch (error) {
    next(error);
  }
};

export const jobStatusHandler = (req, res) => {
  const job = jobStore.findById(req.params.jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: 'Job not found' });
  }
  return res.json({ ok: true, job });
};

export const retryJobHandler = async (req, res, next) => {
  try {
    const job = jobStore.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ ok: false, error: 'Job not found' });
    }
    if (job.status !== 'failed') {
      return res.status(400).json({ ok: false, error: 'Only failed jobs can be retried' });
    }

    const now = new Date().toISOString();
    const updated = { ...job, status: 'pending', updatedAt: now, error: undefined };
    jobStore.upsertJob(updated);

    const fileBase64 = job.payload?.fileBase64;
    if (!fileBase64) {
      const errorMessage = 'Original file payload missing; cannot retry';
      logger.error(errorMessage, { jobId: job.id });
      jobStore.upsertJob({
        ...updated,
        status: 'failed',
        error: errorMessage,
        updatedAt: new Date().toISOString()
      });
      return res.status(500).json({ ok: false, error: errorMessage });
    }

    const outcome = await runJob({ ...updated }, Buffer.from(fileBase64, 'base64'));
    return res.json({ ok: true, companyId: outcome.companyId, customerId: outcome.customerId, quote: outcome.quote });
  } catch (error) {
    next(error);
  }
};

const runJob = async (job, buffer) => {
  const start = Date.now();
  const update = (partial) => {
    jobStore.upsertJob({
      id: job.id,
      hash: job.hash,
      payload: {
        ...job.payload,
        fileBase64: buffer.toString('base64')
      },
      status: partial.status ?? job.status,
      createdAt: job.createdAt,
      updatedAt: new Date().toISOString(),
      result: partial.result ?? job.result,
      error: partial.error ?? job.error
    });
    job.status = partial.status ?? job.status;
    job.result = partial.result ?? job.result;
    job.error = partial.error ?? job.error;
    job.updatedAt = new Date().toISOString();
  };

  try {
    update({ status: 'processing' });

    const parsed = await parsePdf(buffer);
    const parsedLines = parsed.lines ?? [];
    const { lines, unresolved } = reconcileLines(parsedLines, [], 0.1);
    const pricing = applyPricing(lines);
    const pdf = await buildQuotePdf({
      summary: pricing,
      customerName: job.payload?.customerName || DEFAULT_CUSTOMER_NAME
    });

    const description = parsed.project?.title;
    const { companyId, customerId, quote } = await ensureDraftQuote({
      customerName: job.payload?.customerName,
      customerEmail: job.payload?.customerEmail,
      description
    });

    const result = {
      quoteId: quote.id,
      quoteNumber: quote.number,
      companyId,
      customerId,
      quote,
      pdfBase64: pdf.toString('base64'),
      unresolved,
      durationMs: Date.now() - start
    };

    update({ status: 'completed', result });
    return { companyId, customerId, quote };
  } catch (error) {
    logger.error('Job failed', { error: error.message, jobId: job.id });
    update({ status: 'failed', error: error.message });
    throw error;
  }
};
