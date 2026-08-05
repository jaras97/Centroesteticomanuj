import 'server-only';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '@/lib/booking/config';

// Rate limit básico "en memoria del proceso" por IP. No es compartido entre
// instancias serverless ni sobrevive cold starts — suficiente como fricción
// contra bots en un sitio de bajo tráfico (la protección real anti-duplicados
// es el índice único por cliente a nivel de DB, que sí es atómico).
const hits = new Map<string, number[]>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);
  return false;
}
