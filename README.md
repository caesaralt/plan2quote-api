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
- Ensure the process has write access to the `data` directory. When using Docker the volume `api-data` handles persistence automatically.
- Secrets must never be exposed client-side; the Next.js frontend should proxy actions through the API only.

### Option A — Single VM or VPS with Docker Compose

1. Provision a VM (Ubuntu 22.04+ recommended) with Docker and Docker Compose v2 installed.
2. Copy the repository to the server and create a production `.env` file (only the API container consumes the simPRO secrets).
3. Build and start both services in the background:

   ```bash
   docker compose up --build -d
   ```

4. Expose the services through your preferred reverse proxy:
   - Point `https://api.yourdomain.com` → container `api:3000` (use HTTPS via Caddy/Traefik/Nginx).
   - Point `https://quote.yourdomain.com` → container `web:3000` (compose maps it to host port `3001` by default; adjust or proxy accordingly).
5. Set `NEXT_PUBLIC_API_BASE_URL` in the `.env` file to the public API URL so the frontend calls the deployed backend.
6. Share the frontend URL with your team. The API is already CORS-enabled and the dev smoke route stays disabled in production.

### Option B — Render (API) + Vercel (Frontend)

**API on Render**

1. Create a new Render Web Service from this repository.
2. Set the build command to `npm run build --workspace=apps/api` and the start command to `npm run start --workspace=apps/api`.
3. Add environment variables from `.env` (all `SIMPRO_*`, `PORT`, and `JOB_DATABASE_PATH` if you want to override). Render automatically provisions persistent disks; mount `/app/apps/api/data` to keep the SQLite database.

**Frontend on Vercel**

1. Import the repository into Vercel as a new project.
2. Set the build command to `npm run build --workspace=apps/web` and the output directory to `apps/web/.next`.
3. Configure the environment variable `NEXT_PUBLIC_API_BASE_URL` with the public Render API URL (e.g., `https://simpro-api.onrender.com`). No other secrets are required on the frontend.
4. Deploy; Vercel will provide a HTTPS URL that you can share with your team. Add a custom domain if desired.

After both deployments finish, visit the Vercel URL, upload a PDF, and monitor the job status. Use the Postman "Dev Smoke" request against the Render API to confirm OAuth connectivity.

### Option C — Your Existing Platform

If you already use Render, Railway, or AWS:

- Build the API with `npm run build --workspace=apps/api` and run `node apps/api/dist/index.js`.
- Ensure the working directory contains a writable `apps/api/data` folder or override `JOB_DATABASE_PATH` to a persistent location.
- For any Next.js host (Netlify, Amplify, etc.), set `NEXT_PUBLIC_API_BASE_URL` to the API URL before building.

### Launch Checklist Before Sharing the Link

1. Confirm the API health endpoint responds at `https://api.yourdomain.com/api/health`.
2. Run the Postman **Dev Smoke: Create Quote** request (or the curl command above) against the live API to validate OAuth credentials and quote creation.
3. Deploy the frontend and verify the upload flow end-to-end with a sample PDF.
4. Update `NEXT_PUBLIC_API_BASE_URL` so the frontend points at the live API, then redeploy the frontend if necessary.
5. Share the frontend URL (e.g., `https://quote.yourdomain.com`) with internal users. All sensitive operations remain on the backend.

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
