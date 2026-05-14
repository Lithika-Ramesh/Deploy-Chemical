# AIFI dashboard (Next.js)

This folder is the **Vercel “Root Directory”**: the `package.json` here lists `next` and must be the directory Vercel builds from.

## Deploy on Vercel (this repo is a monorepo)

1. Vercel → your project → **Settings** → **Build & Deployment** → **Root Directory** → **Edit**.
2. Set Root Directory to **`dashboard`** (the folder that contains this file and `package.json`), then save.
3. Redeploy. If Root Directory is the repository root, Vercel will not see `next` and shows “No Next.js version detected”.

Longer run instructions and API notes live in `../md/RUN.md` and `../md/dashboard/README.md`.
