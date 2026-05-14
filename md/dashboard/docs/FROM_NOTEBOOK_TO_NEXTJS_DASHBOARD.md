# From notebook outputs to a Next.js dashboard (teammate guide)

This document is for people who are comfortable in **Jupyter** but new to how we turn analysis into the **operator-style dashboard** in the `dashboard/` app. It stays on the **Next.js / React** side: what to install, which folders matter, and how notebook results become something you can click through and deploy.

For how our existing pages connect (overview, simulation, alerts, and so on), see [NAVIGATION_AND_FLOW.md](./NAVIGATION_AND_FLOW.md).

### Do we need `.py` files?

- **Inside `dashboard/`:** **No.** The operator UI is **TypeScript / React** (`.ts`, `.tsx`). Next.js does not execute Python; there should be no `.py` in that folder for normal dashboard work.
- **In the rest of this repo:** **Often yes**, for the same reasons you already use Python: notebooks, `src/` pipelines, batch exports to JSON/CSV, or a **FastAPI** service under `api/` that returns JSON the browser can `fetch` (see [NAVIGATION_AND_FLOW.md](./NAVIGATION_AND_FLOW.md)).
- **Practical split:** Python (notebook or `.py`) **produces or serves data**; Next.js **displays** it. If you only occasionally dump a series to `dashboard/public/data/...json` from a notebook cell, you might never add a new `.py` file. If you need a repeatable export, scheduled job, or live predictions, a small script or the existing API layer is the right place—not inside `page.tsx`.

---

## 1. What changes when you leave the notebook

| In a notebook | In the dashboard |
|---------------|------------------|
| You run cells in order; outputs sit under each cell | The app is a **website**: routes (`/`, `/analytics`, …), layout, navigation |
| Charts are often one-off (matplotlib, Plotly in-cell) | Charts are **React components** that read **data** (arrays/objects) and re-render when that data updates |
| State lives in kernel memory | State lives in the **browser** (React) or on a **server/API** you call from the app |
| Sharing means sending the `.ipynb` or HTML export | Sharing means **running or deploying** the Next.js app so others open a URL |

The job is not “paste the notebook into the browser.” The job is: **define the data your charts and KPIs need**, then **build pages and components** that display that data the way you want.

---

## 2. What you need installed (once)

- **Node.js** (LTS is fine), which gives you `npm`.
- A code editor (VS Code / Cursor is typical).

From the **`dashboard/`** directory in this repo:

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. If that works, your Next.js toolchain is ready.

---

## 3. Tiny Next.js vocabulary (enough to navigate this repo)

- **Next.js**: a framework on top of **React** that adds routing, bundling, and production build steps.
- **App Router**: our routes live under `dashboard/src/app/`. A folder with a `page.tsx` file is a **URL path**.
  - Example: `src/app/(shell)/analytics/page.tsx` → route **`/analytics`** (the `(shell)` group is only for layout organization; it does not appear in the URL).
- **`layout.tsx`**: shared chrome (sidebar, top bar). Child pages render where `{children}` is placed.
- **React component**: a function that returns UI (JSX). Files are often named `Something.tsx`.
- **`"use client"`**: at the top of a file, it marks a **Client Component**. You need this when you use browser-only APIs, `useState`, `useEffect`, or interactive charts that assume the DOM.
- **Imports like `@/...`**: project alias for `src/` (see `tsconfig.json` paths).

You do **not** need to memorize the whole Next.js docs on day one. You mainly need: **find the right `page.tsx`, add or adjust a component, feed it data.**

---

## 4. The bridge: notebook → data the app can read

Notebooks produce **tables, series, metrics, and figures**. The dashboard consumes **plain data** (and sometimes small static files).

**Practical handoff options (Next.js–centric):**

1. **Static JSON (good for demos and fixed reports)**  
   - Export from the notebook whatever you would have plotted (e.g. list of `{ t, value, ... }`).  
   - Save as `dashboard/public/data/my-series.json` (or under `src/` if you prefer importing as a module).  
   - In React, `fetch('/data/my-series.json')` or `import data from './my-series.json'` (depending on setup) gives you an array you can pass to a chart.

2. **TypeScript constants / generated types (good when the shape is stable)**  
   - Define a **type** for each row (see `src/lib/types.ts` for examples like `SensorPoint`).  
   - Put curated numbers in a small module, e.g. `src/lib/myNotebookExport.ts`, and import from components.

3. **API route or external backend (good for live or large data)**  
   - Next.js can expose `route.ts` handlers under `app/api/...` *or* you point the UI at an existing HTTP API via `fetch` and environment variables.  
   - This repo already documents an optional FastAPI URL in [NAVIGATION_AND_FLOW.md](./NAVIGATION_AND_FLOW.md); the same idea applies to any JSON API your team exposes.

**Rule of thumb:** if teammates can open a **JSON file** and recognize the same columns they saw in pandas, you are close. The UI code should not depend on “how” the notebook computed it—only on the **final shape** of the data.

---

## 5. Where to put things in this repo’s `dashboard/`

| You want to… | Start here |
|--------------|------------|
| Add a **new screen** (new URL) | `src/app/(shell)/<your-route>/page.tsx` and register the link in `src/components/layout/SideNav.tsx` if it should appear in the nav |
| Reuse **shared layout** (nav, background) | Already wired in `(shell)/layout.tsx` — new routes under `(shell)/` get the shell for free |
| Add a **presentational block** (card, chart strip) | `src/components/dashboard/` or `src/components/pages/` depending on whether it is page-specific |
| Share **numbers/state** across several widgets | `src/context/PlantSimulationContext.tsx` is the current pattern: one provider, many consumers via `usePlantSimulation()` |
| Central **TypeScript types** for domain objects | `src/lib/types.ts` (extend with new interfaces as needed) |
| **Static assets** (images, exported JSON) | `public/` |

Existing charting in the app uses **Recharts** (see `SensorCharts.tsx`): it expects **arrays of plain objects** with string keys (e.g. `{ i, reactorTemp, ... }`). If your notebook used matplotlib, you still export the underlying **x/y (or multi-series) table** and map column names to `dataKey` props in Recharts.

---

## 6. Checklist: turn a notebook “view” into a dashboard page

1. **Name the audience and the URL** (e.g. “stakeholders need `/reports/tep-sensors`”).
2. **Freeze the data contract**: list each chart/KPI and the exact fields (types, units, time index).
3. **Export once** from the notebook to JSON (or paste a small slice into a `.ts` file for iteration).
4. **Add a type** in `src/lib/types.ts` (or a colocated type file) matching that contract.
5. **Create a Client Component** for interactive charts (`"use client"` + Recharts or your chosen library—stay consistent with the rest of the app).
6. **Create `page.tsx`** under `src/app/(shell)/...` that composes your components inside the existing shell.
7. **Run** `npm run dev`, click through the sidebar (add a nav item if the page should be discoverable).
8. **Iterate on layout** with Tailwind utility classes to match the glass / grid style of neighboring pages.

---

## 7. Common pitfalls (worth reading once)

- **Server vs client**: importing a chart library that uses `window` in a Server Component will error. Put those imports in a Client Component, or use `next/dynamic` with `ssr: false` (see `OverviewPage.tsx` + `SensorCharts` pattern).
- **Huge JSON in the bundle**: very large exports should live in `public/` and load with `fetch`, or be served by an API—not imported as a giant static module unless you accept slower builds.
- **Drift**: if the notebook changes column names but the React code does not, charts go blank. Treat the **type/interface** as the contract and update both sides together.

---

## 8. What to learn next (optional depth)

- Official Next.js **App Router** docs: [Routing](https://nextjs.org/docs/app/building-your-application/routing) and [Server and Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components).
- **React** basics: JSX, props, `useState`, `useMemo`, context.
- **Tailwind CSS** (used in this app): utility-first styling in `className` strings.

Once you can add a route, render a table from JSON, and plot one series with Recharts, you can replicate most notebook “dashboard-like” layouts inside this codebase.
