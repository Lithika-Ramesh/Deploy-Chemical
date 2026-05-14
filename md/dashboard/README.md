This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

This app lives under `dashboard/` in a **monorepo**. On Vercel, open **Project → Settings → Build & Deployment → Root Directory**, set it to **`dashboard`**, then save and redeploy. That directory must be the one that contains this project’s `package.json` with `next` in `dependencies`; if Root Directory stays at the repo root, Vercel reports “No Next.js version detected”. See Vercel’s [Using Monorepos](https://vercel.com/docs/monorepos) and [Root Directory](https://vercel.com/docs/deployments/configure-a-build#root-directory).

For a default Next.js template deploy flow, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
