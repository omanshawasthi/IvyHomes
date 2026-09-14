# Ivy Homes Property Platform

This repository contains the completed submission for the Ivy Homes Software Engineering Internship (September 2026). It includes a robust API ingestion engine and a beautifully styled React frontend, strictly adhering to the assignment requirements.

## How to run it

This project uses a Backend-for-Frontend (BFF) proxy pattern. The backend handles data ingestion, API key protection, and analytical computing, while the frontend handles presentation.

### Prerequisites
- Node.js (v18+)
- `npm` or `yarn`

### 1. Setup the Backend
1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   npm install
   ```
2. Create a `.env` file in the `backend/` directory and add your API key:
   ```env
   IVY_API_KEY=IVY26-F14F7F812F76
   IVY_DEMO_PASSWORD=37ef3a4900
   ```
3. Start the backend proxy server:
   ```bash
   npm run dev
   ```
   *The backend runs on http://localhost:3000 (or 4000)*

### 2. Generate the Analysis & Submission Data
While in the `backend/` directory, run the analytical ingestion engine:
```bash
npm run analyze
```
This fetches the *entire* dataset into memory (approx. 150 API calls) handling rate-limiting and pagination automatically. It tests 5 hypotheses against the data, computes the 10 assignment answers, and outputs `submission.json` (at the repo root) and `analysis-output.json` (used by the frontend Insights page).

### 3. Setup the Frontend
1. Open a second terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend runs on http://localhost:5173*
3. Open your browser and log in with `demo1@ivy.homes` (password: `37ef3a4900`).

---

## Analytical Approach: Distrusting the Documentation

The assignment warned that the documentation was drafted by an AI and contained hallucinations. I built my backend to completely distrust the payload shapes.

**What I did:**
- Instead of using loose `any` types, I implemented strict **Zod schemas** in the API client that validate every single response payload from the upstream `/v1/` endpoints.
- I used `.passthrough()` on the schemas to catch *undocumented* extra fields.
- Whenever a payload failed schema validation, it didn't crash the server. Instead, it was flagged as a `Schema mismatch` and the endpoint, expected field, and actual value were logged. This instantly revealed where the documentation was lying (e.g., `POST /auth/login` returning `access_token` instead of `token`).
- I wrote 5 specific hypothesis detectors in `backend/src/analysis/` that swept the ingested data looking for logical inconsistencies (e.g., "Is carpet area strictly smaller than super built-up area?"). 

---

## What turned out to be fine (Ruled-out Hypotheses)

The hypotheses that did not pan out are often as important as the ones that do. I explicitly tested and ruled out the following:

1. **The In-Memory Project Listing Count (Consistency Check)**
   *Hypothesis:* Since `total_listings` on a project is notoriously out of sync with the live API, perhaps the API's pagination is *also* out of sync, meaning the sum of all individual listing records we ingested per project might not match the project's stated `total_listings`.
   *Result:* **Ruled Out**. I counted every listing record that we ingested per `project_id` and compared it against the project's `total_listings`. The numbers strictly disagreed for 144 out of 150 projects. However, the hypothesis that "our ingested sum would also disagree with the live API's count" was ruled out. The ingested sum perfectly matched the live API's `GET /v1/listings?project_id=X&limit=1` total for a 10-project spot check. The `total_listings` property on the Project object is simply cached and stale.

2. **The "Live vs Memory" Completeness Check**
   *Hypothesis:* Fetching 1,100 records via sequential pagination might miss records if the database is mutating during the fetch (i.e., offset-based pagination drift).
   *Result:* **Ruled Out**. Cross-validating our final in-memory counts against fresh `limit=1` requests showed zero drift. The dataset is stable, and our 1,100 record ingestion was perfectly complete.

---

## What I would do with another two days

If I had another two days to expand this platform, I would focus on:

1. **Persistent Datastore & ETL Pipeline:** 
   Currently, the BFF keeps the analytics entirely in-memory and dumps it to a JSON file. For a production app, I would implement a proper ETL pipeline (e.g., using BullMQ and Postgres) to pull the data nightly, normalize it, and serve it via dedicated GraphQL or tRPC routes.
2. **Advanced Frontend Filtering:**
   I would implement debounced search bars, slider ranges for price/area, and multi-select comboboxes for localities and amenities to make the browsing experience more powerful.
3. **Map-Based Visualization:**
   Since every listing and project includes `latitude` and `longitude`, I would integrate Mapbox GL JS to plot the 1,100 listings on a heatmap, instantly visually surfacing the unit-mismatch anomalies (e.g., a listing plotted in the ocean, or visually clustering the highest rent densities).
4. **End-to-End Testing:**
   Write Playwright E2E tests for the frontend to ensure that the authentication persistence and filtering logic remain flawless as the upstream API evolves.
