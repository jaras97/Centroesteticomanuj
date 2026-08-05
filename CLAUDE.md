# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Marketing website for "Centro Estético Manuj" (professional makeup artist / cosmetologist), built with Next.js App Router. This is a single-page site (`app/page.tsx`) composed of section components rendered in order: Header, HeroCarousel, ServicesSection, GallerySection, AboutSection, Footer. In-page navigation uses hash anchors (`#servicios`, `#galeria`, etc.) matching each section's `id`.

The repo originates from and stays in sync with a [v0.dev](https://v0.dev) project (see README.md) — changes made in v0 are pushed here automatically and deployed via Vercel.

## Commands

Package manager is pnpm (see `pnpm.onlyBuiltDependencies` in package.json).

- `pnpm dev` — start the dev server
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — run `next lint`

There is no test suite configured in this repository.

## Architecture notes

- **Next.js config (`next.config.mjs`)** intentionally ignores ESLint and TypeScript errors during `build` (`ignoreDuringBuilds` / `ignoreBuildErrors`), and disables Next's image optimization (`images.unoptimized: true`). Images are served from Cloudinary (`res.cloudinary.com`), whitelisted via `remotePatterns`.
- **Analytics**: Google Analytics is wired manually rather than via a library. `lib/gtag.ts` exposes `pageview`/`gaEvent` helpers that call `window.gtag`. `app/layout.tsx` injects the GA script tags only when `NODE_ENV === 'production'` and `NEXT_PUBLIC_GA_ID` is set, with `send_page_view: false` so pageviews are tracked manually. `app/ga-listener.tsx` is a client component (wrapped in `Suspense` in the layout, required because it uses `useSearchParams`) that calls `pageview()` on every route/query change.
- **Styling**: Tailwind, configured via `components.json` (shadcn/ui conventions, `baseColor: neutral`, no class prefix). Brand colors (`brand.gold` `#C6A451`, `brand.brown` `#8D7040`, plus light/dark variants) are defined in `tailwind.config.ts` alongside the shadcn CSS-variable-based palette (`border`, `background`, `primary`, etc.). Section headings and CTAs consistently use `bg-gradient-to-r from-brand-gold to-brand-brown` text/background gradients. Note there are two global stylesheets — `app/globals.css` (used by the app, referenced by `components.json`) and `styles/globals.css` — check which is actually imported before editing global styles.
- **UI components**: `components/ui/` holds shadcn-style primitives (`button.tsx`, `card.tsx`, `input.tsx`) plus one custom primitive, `AnimatedButton.tsx`, used across sections as the "Reservar cita" CTA. It renders a `motion.a`: if given a `phone` prop it builds a `wa.me` WhatsApp deep link (with a prefilled `message`), otherwise it links to `href` (typically `#contacto`). Path alias `@/*` maps to the repo root (see `tsconfig.json` / `components.json` aliases).
- **Animation**: Framer Motion is used throughout section components with a shared cubic-bezier ease (`EASE_OUT`, defined both as a local const per-file and centrally in `lib/constants.ts`). Common pattern: a `headerContainer`/`headerVariants` for section titles animated with `whileInView`, and a `cardItem` variant applied per-card with `custom={index}` for staggered delays. `useReducedMotion()` / `prefers-reduced-motion` is checked before applying hover/tap motion in several components (e.g. `ServicesSection`, `HeroCarousel`, `AnimatedButton`).
- **Hero carousel** (`components/hero-carousel.tsx`): built on `embla-carousel-react` with the `embla-carousel-autoplay` plugin (autoplay disabled when reduced motion is preferred). Slide data is a local `slides` array in the component.
- **Gallery** (`components/gallery-section.tsx`): local `galleryImages` array with a `category` field drives client-side filtering (`Todos` / `Artístico` / `Social` / `Editorial`). Clicking an image opens `yet-another-react-lightbox`, loaded via `next/dynamic` with `ssr: false` (with Thumbnails/Zoom/Fullscreen plugins) since it isn't SSR-safe.
- Content data (slides, services, gallery images) is currently hardcoded inline in each section component rather than centralized — check the relevant component directly when updating copy or images rather than searching for a shared data file.
