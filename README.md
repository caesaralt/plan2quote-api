# Simpro Quote Agent

This repository contains a monorepo with the API and frontend required to ingest floor plan PDFs, reconcile them against the simPRO catalogue, and create priced quotes that are attached back into simPRO.

> **Status:** API scaffolding, pricing, PDF output, SQLite job store, and simPRO client are implemented. Item reconciliation currently uses an in-memory catalogue placeholder; integrate with the live simPRO catalogue before production use.

## Repository Layout

- `apps/api` — Express + TypeScript backend. Handles ingestion, PDF parsing, pricing, PDF generation, and simPRO API calls.
- `apps/web` — Next.js frontend for uploading documents and monitoring job status. (Setup below.)
- `.env.example` — Template for required environment variables.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in the simPRO credentials:

   ```bash
   cp .env.example .env
   ```

3. Start the development servers (API + Web) in separate terminals:

   ```bash
 npm run dev:api
  # in another terminal
  npm run dev:web
  ```

  The API listens on `PORT` (default `3000`). The web client proxies requests to the API via `NEXT_PUBLIC_API_BASE_URL`.

4. With valid simPRO credentials in `.env`, run the local smoke test (only available while `NODE_ENV !== "production"`):

   ```bash
   curl -s -X POST http://localhost:3000/api/dev/create-quote \
     -H "Content-Type: application/json" \
     -d '{"name":"Integrated Holdings Pty Ltd QA","email":"qa+quote@integrated-holdings.com.au"}'
   ```

   The endpoint returns `{ ok, companyId, customerId, quote }` when the OAuth credentials and tenant base are configured correctly. The route is disabled automatically in production builds.

## API Endpoints

### `POST /api/ingest`

Upload a PDF or image using `multipart/form-data` with a `file` field. Returns a `jobId` and starts asynchronous processing.

```bash
curl -X POST \
  -F "file=@fixtures/sample.pdf" \
  -F "customerName=Acme" \
  "$API_BASE/api/ingest"
```

### `GET /api/jobs/:jobId`

Retrieve the status and result payload for a job. Returns the matched estimate ID, generated PDF filename, and unresolved line items when available.

```bash
curl "$API_BASE/api/jobs/<jobId>"
```

### `POST /api/retry/:jobId`

Retry a failed job. The original file payload is reprocessed.

```bash
curl -X POST "$API_BASE/api/retry/<jobId>"
```

## Connecting to simPRO

All authentication happens server-side via OAuth2 client_credentials using the exact token URL from our Simpro Key File.

Required envs (set in `.env`):
- SIMPRO_TOKEN_URL=https://integratd.simprosuite.com/oauth2/token
- SIMPRO_API_BASE=https://integratd.simprosuite.com    (the tenant base; the client appends /api/v1.0)
- SIMPRO_CLIENT_ID, SIMPRO_CLIENT_SECRET
- SIMPRO_SCOPES (space-delimited)
- SIMPRO_COMPANY_ID (optional; auto-resolves via /companies if omitted)

The frontend never sees secrets; it calls the backend at NEXT_PUBLIC_API_BASE_URL.

## Running Tests

```bash
npm run test --workspace=apps/api
```

## Deployment Notes

- The API stores job metadata in `apps/api/data/jobs.db` (SQLite). Persist this file between deployments for idempotency.
- Ensure the process has write access to the `data` directory.
- Secrets must never be exposed client-side; the Next.js frontend should proxy actions through the API only.

## Contributing & Pull Requests

1. Create a feature branch from `work` for any changes you make.
2. Commit your work with meaningful messages once tests pass locally.
3. Push the branch to GitHub and open a pull request using the "Create pull request" button. Use the PR checklist in the template to confirm linting, tests, and documentation updates.
4. Wait for the automated checks to complete and address any feedback before merging.

## Postman Collection

See `postman/simpro-quote-agent.postman_collection.json` for preconfigured requests covering OAuth, ingestion, and status polling.

## TODO

- Integrate with the simPRO catalogue endpoints to populate reconciliation data.
- Add human-in-the-loop UI for unresolved line mappings.
- Expand PDF parsing for structured tables and OCR.
- Implement PDF attachment upload once file storage is configured in simPRO tenancy.
