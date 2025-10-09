import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import {
  ensureDraftQuote,
  ingestHandler,
  jobStatusHandler,
  retryJobHandler,
  uploadMiddleware
} from './services/quoteRunner.js';
import { logger } from './lib/logger.js';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: { apiBase: env.SIMPRO_API_BASE || null } });
});

app.post('/api/ingest', uploadMiddleware, ingestHandler);
app.get('/api/jobs/:jobId', jobStatusHandler);
app.post('/api/retry/:jobId', retryJobHandler);

if (env.NODE_ENV !== 'production') {
  app.post('/api/dev/create-quote', async (req, res, next) => {
    try {
      const { name, email, description } = req.body ?? {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ ok: false, error: 'name is required' });
      }

      const outcome = await ensureDraftQuote({
        customerName: name,
        customerEmail: typeof email === 'string' ? email : undefined,
        description: typeof description === 'string' ? description : undefined
      });

      return res.json({ ok: true, companyId: outcome.companyId, customerId: outcome.customerId, quote: outcome.quote });
    } catch (error) {
      next(error);
    }
  });
}

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ ok: false, error: err.message });
});

const port = Number(env.PORT);

app.listen(port, () => {
  logger.info(`API server listening on ${port}`);
});
