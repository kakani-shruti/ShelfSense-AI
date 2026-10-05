# ShelfSense AI

ShelfSense AI is a production-oriented household food intelligence application. It turns inventory and consumption history into explainable waste-risk estimates, timely actions, waste analytics, and optional Gemini-powered rescue recipes.

The product loop is:

**inventory → behavior → deterministic risk → recommendation → action → historical feedback**

## What is included

- Email/password authentication with protected routes
- Food inventory, estimated shelf life, consumption, and waste logging
- Explainable 0–100 Waste Risk Scores with prioritized actions
- Gemini rescue recipes through a server-side Supabase Edge Function
- 7-, 30-, and 90-day waste analytics and behavioral insights
- Deterministic in-app notifications with deduplication
- Responsive navigation, deliberate empty/loading/error states, accessible modal behavior, and account settings

## Architecture

```text
React + Vite
  ├─ Supabase Auth
  ├─ PostgreSQL + row-level security
  ├─ deterministic prediction and analytics utilities
  └─ authenticated Edge Function → Gemini API
```

Gemini never calculates or modifies the numerical risk score. The browser sends only an inventory-item ID to the Edge Function; the function authenticates the request, re-fetches RLS-scoped context, verifies ownership, and sends only relevant food context to Gemini.

## Local setup

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add the public Supabase project URL and anon key.
5. Apply the SQL migrations below in order.
6. Run `npm run dev`.

```bash
npm run lint
npm test
npm run build
```

### Browser environment

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Public Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key protected by RLS |

Never place a service-role key or Gemini secret in a `VITE_` variable. The centralized browser client is in `src/lib/supabase.js`.

## Database setup

Run these files from `supabase-scripts/` in chronological order:

1. `001_create_tables.sql`
2. `002_create_indexes.sql`
3. `003_create_rls_policies.sql`
4. `004_seed_foods.sql`
5. `005_add_inventory_action_functions.sql`
6. `006_enforce_one_prediction_per_item.sql`
7. `007_add_ai_recipe_context.sql`
8. `008_add_analytics_notification_support.sql`
9. `009_repair_prediction_and_recipe_schema.sql`

These migrations are the authoritative schema history. Add future changes as new numbered files; do not rewrite deployed migrations.

## Gemini configuration

Store the Gemini key only as a Supabase Edge Function secret:

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
supabase functions deploy generate-rescue-recipe
```

Keep JWT verification enabled. Do not commit the real key to environment files, source, SQL, logs, or documentation.

## Intelligence model

The explainable Waste Risk Score is a deterministic application estimate:

| Factor | Weight |
| --- | ---: |
| Expiry pressure | 30% |
| Quantity surplus | 30% |
| Consumption pattern | 20% |
| Historical waste | 15% |
| Purchase quantity | 5% |

Risk levels are Low (0–24), Moderate (25–49), High (50–74), and Critical (75–100). Personal consumption needs at least two matching events; historical waste needs at least three previous matching purchases. With insufficient data, the interface explicitly describes limited personalization and uses a deterministic fallback.

Predictions refresh when relevant inventory/history changes and otherwise after six hours. Queries are batched at household level, and one current prediction is maintained per item.

## Analytics and notifications

Analytics use RLS-scoped records and local-calendar ranges. Quantity totals preserve measurement meaning: kilograms normalize to grams, and litres to millilitres; incompatible unit families remain separate. Food Waste Performance combines recorded waste rate, period trend, and recurring patterns, and stays in a baseline state until enough events exist.

Notifications are evaluated during app usage for urgent inventory, recurring waste, over-purchase, and meaningful improvement. Type, related entity, and local date provide database-backed deduplication, with an additional 24-hour cooldown. Background, email, and push delivery are intentionally outside this version.

## Project structure

```text
src/
  components/  context/  hooks/  layouts/  pages/
  routes/      services/ utils/  styles/
supabase/
  functions/generate-rescue-recipe/
supabase-scripts/
public/
```

## Product boundaries

- Shelf-life dates and Waste Risk Scores are planning estimates, not food-safety guarantees.
- Analytics reflect user-recorded activity and do not fabricate missing quantities, prices, trends, or environmental impact.
- Gemini output is generative assistance and can be unavailable without affecting inventory, prediction, or analytics.
- Users must apply appropriate judgment before consuming food or following generated recipes.
