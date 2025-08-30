// lib/gtag.ts
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

const canTrack = () =>
  typeof window !== "undefined" && typeof window.gtag === "function" && GA_ID;

export const pageview = (url: string) => {
  if (!canTrack()) return;
  // Recomendado por Google para SPA: llamar "config" en cada navegación
  window.gtag("config", GA_ID, { page_path: url });
};

export const gaEvent = (action: string, params?: Record<string, unknown>) => {
  if (!canTrack()) return;
  window.gtag("event", action, params ?? {});
};
