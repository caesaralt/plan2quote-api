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

export const ingestHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Missing file field "file"' });
    }

    const hash = computeDocumentHash(req.file.buffer, req.body?.customerName);
    const existing = jobStore.findByHash(hash);
    if (existing) {
      return res.json({ ok: true, jobId: existing.id, status: existing.status, reused: true });
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const job = {
      id,
      status: 'pending',
      hash,
      payload: {
        customerName: req.body?.customerName,
        originalFileName: req.file.originalname,
        fileBase64: req.file.buffer.toString('base64')
      },
      createdAt: now,
      updatedAt: now
    };

    jobStore.upsertJob(job);

    process.nextTick(async () => {
      await runJob({ ...job }, req.file.buffer);
    });

    return res.status(202).json({ ok: true, jobId: id, status: 'pending' });
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

export const retryJobHandler = (req, res) => {
  const job = jobStore.findById(req.params.jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: 'Job not found' });
  }
  if (job.status !== 'failed') {
    return res.status(400).json({ ok: false, error: 'Only failed jobs can be retried' });
  }

  const now = new Date().toISOString();
  jobStore.upsertJob({ ...job, status: 'pending', updatedAt: now, error: undefined });
  process.nextTick(async () => {
    const fileBase64 = job.payload?.fileBase64;
    if (!fileBase64) {
      logger.error('Missing file payload for retry', { jobId: job.id });
      jobStore.upsertJob({
        ...job,
        status: 'failed',
        error: 'Original file payload missing; cannot retry',
        updatedAt: new Date().toISOString()
      });
      return;
    }
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    await runJob({ ...job, status: 'pending', updatedAt: now }, fileBuffer);
  });

  return res.json({ ok: true, jobId: job.id, status: 'pending' });
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
      customerName: job.payload?.customerName
    });

    const companyId = await resolveCompanyId();
    const customerName = job.payload?.customerName || 'Automated Customer';
    const customerEmail = job.payload?.customerEmail;
    const customerId = await findOrCreateCompanyCustomer(
      companyId,
      customerName,
      typeof customerEmail === 'string' ? customerEmail : undefined
    );

    const quoteDescription = parsed.project?.title || `Automated quote for ${customerName}`;
    const quote = await createDraftQuote(companyId, customerId, quoteDescription);

    update({
      status: 'completed',
      result: {
        quoteId: quote.id,
        quoteNumber: quote.number,
        pdfBase64: pdf.toString('base64'),
        unresolved,
        durationMs: Date.now() - start
      }
    });
  } catch (error) {
    logger.error('Job failed', { error: error.message, jobId: job.id });
    update({ status: 'failed', error: error.message });
  }
};
