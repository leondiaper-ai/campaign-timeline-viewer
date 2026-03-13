# Campaign Timeline Viewer

A lightweight internal web app for music campaign review meetings. Visualises campaign moments against streaming performance and sales data over time. Each campaign lives in its own Google Sheet, discovered via a central registry.

## Quick Start (Mock Data)

```bash
npm install
cp .env.local.example .env.local
# USE_MOCK_DATA is already set to "true" in the example
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Architecture: Registry Model

The app uses a **two-tier Google Sheets** architecture:

1. **Registry spreadsheet** — a single central sheet that lists all campaigns
2. **Campaign spreadsheets** — one per campaign, each with 3 tabs of data

This means teams can create new campaigns by adding a row to the registry and setting up a new spreadsheet from the template, without touching any code.

---

## Google Sheets Setup

### Registry Spreadsheet

Create a Google Sheet with one tab:

**Tab: `campaign_registry`**

| campaign_id | artist_name | campaign_name | sheet_url | sheet_id | status | campaign_owner |
|---|---|---|---|---|---|---|
| arlo_parks_deluxe | Arlo Parks | Deluxe Q1 2026 | https://docs.google.com/... | 1D5_HlV... | active | Leon |

- `status` values: `active`, `archived`, `draft` — only `active` campaigns appear in the app
- `sheet_id` is the spreadsheet ID from the campaign sheet's URL

### Campaign Spreadsheets (one per campaign)

Each campaign sheet has **3 tabs**:

**Tab: `campaign_setup`** (single row)

| campaign_id | artist_name | campaign_name | start_date | release_date | default_territory |
|---|---|---|---|---|---|
| arlo_parks_deluxe | Arlo Parks | Deluxe Q1 2026 | 2026-01-06 | 2026-02-14 | global |

**Tab: `campaign_moments`**

| date | moment_title | event_type | event_subtype | territory | notes | is_core_moment | show_on_chart | observed_impact | what_we_learned | confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-01-12 | Deluxe edition announced | music | album_announcement | global | Social reveal + pre-save | TRUE | TRUE | +12K pre-saves in 48hrs | Pre-save CTA converts better than teaser-first | high |

- `event_type` values: `music`, `marketing`, `editorial`, `product`, `live`
- `territory` values: `global`, `UK`
- `is_core_moment`: TRUE/FALSE — marks defining campaign beats
- `show_on_chart`: TRUE/FALSE — force show/hide on the timeline chart
- `confidence`: `high`, `medium`, `low`

**Tab: `weekly_metrics`**

| week_ending | territory | total_streams | retail_units | d2c_units |
|---|---|---|---|---|
| 2026-01-13 | global | 1800000 | 0 | 0 |
| 2026-01-13 | UK | 310000 | 0 | 0 |

### Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Sheets API**
4. Go to **IAM & Admin > Service Accounts**
5. Create a service account (e.g. "ctv-sheets-reader")
6. Create a JSON key and download it
7. Share **every** spreadsheet (registry + all campaign sheets) with the service account email as **Viewer**

### Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
REGISTRY_SPREADSHEET_ID=your_registry_spreadsheet_id_here
USE_MOCK_DATA=false
```

The registry spreadsheet ID is in the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

---

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm i -g vercel
vercel
```

Set environment variables when prompted:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `REGISTRY_SPREADSHEET_ID`
- `USE_MOCK_DATA` → `false`

### Option B: Vercel Dashboard

1. Push the project to a GitHub repository
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repository
4. Add environment variables in the **Environment Variables** section
5. Click **Deploy**

### Notes

- The `GOOGLE_PRIVATE_KEY` value must include the full key with `\n` characters
- In Vercel's environment variable UI, paste the key as-is (Vercel handles the escaping)
- Data is cached for 5 minutes (ISR). To adjust, change `revalidate` in `src/app/page.tsx`

---

## Project Structure

```
src/
├── app/
│   ├── api/data/route.ts        # API endpoint (optional client-side fetching)
│   ├── globals.css               # Tailwind + custom styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page (server component with ISR)
├── components/
│   ├── CampaignLearnings.tsx    # Key learnings panel
│   ├── CampaignSelector.tsx     # Campaign dropdown
│   ├── CategoryLegend.tsx       # Event category legend
│   ├── Dashboard.tsx            # Main dashboard (client component)
│   ├── EventList.tsx            # Scrollable event table with details
│   ├── EventMarkers.tsx         # Event markers below chart
│   ├── PerformanceChart.tsx     # Recharts dual-line chart
│   └── TerritoryToggle.tsx      # Global / UK toggle
├── lib/
│   ├── data.ts                  # Data orchestration + transforms
│   ├── event-categories.ts      # Category colours, icons, labels
│   ├── mock-data.ts             # Mock data for development
│   ├── observations.ts          # Auto-observation engine
│   ├── sheets.ts                # Google Sheets API client (registry model)
│   └── transforms.ts            # Data transforms + learnings
└── types/
    └── index.ts                 # TypeScript type definitions
```

## Adding a New Campaign

1. Create a new Google Sheet from the campaign template (3 tabs: `campaign_setup`, `campaign_moments`, `weekly_metrics`)
2. Share it with the service account email as Viewer
3. Add a row to the **registry** spreadsheet with `status: active`
4. The campaign will appear in the app within 5 minutes (ISR cache)

---

## Tech Stack

- **Next.js 15** (App Router, ISR)
- **Tailwind CSS** for styling
- **Recharts** for charts
- **Google Sheets API** via `googleapis`
- **TypeScript** throughout
