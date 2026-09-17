/**
 * Resolución de la audiencia de una campaña. **Este archivo es el contrato
 * con la UI**: la página de campañas no debe volver a segmentar clientas a
 * mano, igual que `lib/finance/queries.ts` es el único lugar donde se hacen
 * las cuentas de Finanzas.
 *
 * ---------------------------------------------------------------------------
 * POR QUÉ SEGMENTA POSTGRES Y NO JAVASCRIPT
 * ---------------------------------------------------------------------------
 * PostgREST corta todo `select` en `max_rows` (1000 por defecto en Supabase) y
 * **no avisa**: pasado el corte simplemente devuelve menos filas. Un segmento
 * como "sin cita COMPLETADA en los últimos 6 meses" resuelto en TypeScript
 * tendría que traerse el historial de citas entero y cruzarlo acá; el día que
 * la base pase las 1000 filas, la campaña dejaría gente afuera en silencio.
 *
 * Por eso el `where` de cada segmento vive en las funciones SQL
 * `campaign_audience` / `campaign_audience_stats` (0017_campanas.sql, §4). Los
 * conteos vuelven como UNA fila; la lista de destinatarias se pagina acá
 * (`AUDIENCE_PAGE_SIZE`) para que `max_rows` tampoco la pueda truncar.
 *
 * ---------------------------------------------------------------------------
 * LEY 1581 DE 2012 (HABEAS DATA)
 * ---------------------------------------------------------------------------
 * Una campaña es MARKETING, igual que el saludo de cumpleaños. Quien tenga
 * `clients.marketing_opt_out = true` NUNCA entra en la audiencia, sea cual
 * sea el segmento — incluso si Manu la eligió a mano en un segmento
 * `manual`. La exclusión se aplica dentro de `campaign_audience` (SQL), no
 * acá, para que no dependa de que quien llame se acuerde. `excludedByOptOut`
 * existe para que la UI pueda decir cuántas quedaron fuera y por qué.
 *
 * La línea de baja del mensaje la agrega `renderCampaignMessage`
 * (`lib/notifications/templates.ts`), en los dos canales.
 *
 * ---------------------------------------------------------------------------
 * ZONA HORARIA
 * ---------------------------------------------------------------------------
 * `inactive` y `new` necesitan un instante de corte ("hace N meses"). Se
 * calcula ACÁ, en hora de pared de Bogotá (UTC-5 fijo) con los helpers de
 * `lib/booking/timezone.ts`, y se le pasa ya resuelto a Postgres como
 * `timestamptz`. No se calcula en SQL con `now() - interval` a propósito:
 * tener el criterio de fechas en dos lenguajes es justo la regla de dos
 * cabezas que 0016 advierte que hay que evitar.
 *
 * NOTA PARA LA UI: este módulo se puede importar desde un componente
 * 'use client' — lo único que trae del servidor es un `import type`, que
 * TypeScript borra al compilar. Las funciones que hablan con Supabase reciben
 * el cliente por parámetro.
 */
import type { createClient } from '@/lib/supabase/server';
import { bogotaWallTimeToUtc, todayInBogota } from '@/lib/booking/timezone';
import type {
  CampaignAudience,
  CampaignAudienceKind,
  CampaignAudienceStats,
  CampaignRecipient,
} from './types';

type AudienceClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Tamaño de página al traer destinatarias. Muy por debajo del `max_rows` de
 * PostgREST: si un segmento devuelve más, se pide la página siguiente.
 */
const AUDIENCE_PAGE_SIZE = 500;

/** Tope duro de destinatarias por campaña. Es un freno, no una expectativa. */
const AUDIENCE_HARD_LIMIT = 10_000;

// ---------------------------------------------------------------------------
// Metadatos para la UI
// ---------------------------------------------------------------------------

export const AUDIENCE_KIND_LABELS: Record<CampaignAudienceKind, string> = {
  all: 'Todas las clientas',
  birthday_month: 'Cumpleañeras del mes',
  inactive: 'Hace rato no vienen',
  new: 'Clientas nuevas',
  manual: 'Selección a mano',
};

export const AUDIENCE_KIND_DESCRIPTIONS: Record<CampaignAudienceKind, string> = {
  all: 'Toda la base de clientas registradas.',
  birthday_month: 'Las que cumplen años en el mes que elijas.',
  inactive: 'Las que no tienen ninguna cita completada en los últimos meses que elijas.',
  new: 'Las que tuvieron su primera cita completada dentro de los últimos meses que elijas.',
  manual: 'Las clientas que elijas una por una.',
};

export const MONTH_LABELS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Segmento por defecto de una campaña nueva. */
export const DEFAULT_CAMPAIGN_AUDIENCE: CampaignAudience = { kind: 'all' };

/** Frase corta para la tarjeta de la campaña ("Cumpleañeras de agosto"). */
export function describeCampaignAudience(audience: CampaignAudience): string {
  switch (audience.kind) {
    case 'all':
      return 'Todas las clientas';
    case 'birthday_month':
      return `Cumpleañeras de ${MONTH_LABELS[audience.month - 1] ?? ''}`.trim();
    case 'inactive':
      return `Sin venir hace ${audience.months} ${audience.months === 1 ? 'mes' : 'meses'}`;
    case 'new':
      return `Nuevas de los últimos ${audience.months} ${audience.months === 1 ? 'mes' : 'meses'}`;
    case 'manual':
      return `${audience.clientIds.length} ${
        audience.clientIds.length === 1 ? 'clienta elegida' : 'clientas elegidas'
      }`;
  }
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

/**
 * Valida y normaliza el `audience` que llega de la UI o de la columna jsonb.
 *
 * Devuelve `null` si no es un segmento válido. Quien lo llame tiene que
 * tratarlo como error y NO mandar nada: un segmento que no se entiende se
 * resuelve como audiencia vacía en SQL, pero es mejor decirlo antes.
 */
export function parseCampaignAudience(value: unknown): CampaignAudience | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  switch (raw.kind) {
    case 'all':
      return { kind: 'all' };

    case 'birthday_month': {
      const month = Number(raw.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) return null;
      return { kind: 'birthday_month', month };
    }

    case 'inactive':
    case 'new': {
      const months = Number(raw.months);
      // Tope de 60 meses: más allá, "inactiva hace 5 años" es lo mismo que
      // "todas", y evita que un número absurdo llegue a la aritmética de fechas.
      if (!Number.isInteger(months) || months < 1 || months > 60) return null;
      return { kind: raw.kind, months };
    }

    case 'manual': {
      if (!Array.isArray(raw.clientIds)) return null;
      const clientIds = raw.clientIds.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      );
      if (clientIds.length === 0) return null;
      return { kind: 'manual', clientIds };
    }

    default:
      return null;
  }
}

/** Mensaje en español para cuando `parseCampaignAudience` devuelve `null`. */
export const INVALID_AUDIENCE_ERROR =
  'El segmento de la campaña no es válido. Vuelve a elegirlo.';

// ---------------------------------------------------------------------------
// Fecha de corte (hora Bogotá)
// ---------------------------------------------------------------------------

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Instante (UTC) correspondiente a la medianoche de Bogotá de hace `months`
 * meses.
 *
 * La aritmética se hace sobre el string 'YYYY-MM-DD' que devuelve
 * `todayInBogota()` y con `Date.UTC` — nunca con getters locales, porque el
 * proceso de Vercel corre en UTC y `getMonth()` daría el mes equivocado entre
 * las 19:00 y la medianoche de Bogotá.
 *
 * El día se recorta al último día del mes destino (31 de marzo − 1 mes = 28 o
 * 29 de febrero), que es lo que la gente espera de "hace un mes".
 */
export function monthsAgoCutoffIso(months: number): string {
  const [year, month, day] = todayInBogota().split('-').map(Number);

  const shifted = year * 12 + (month - 1) - months;
  const targetYear = Math.floor(shifted / 12);
  const targetMonth = shifted - targetYear * 12 + 1; // 1-12

  // Día 0 del mes siguiente = último día del mes destino.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);

  return bogotaWallTimeToUtc(
    `${targetYear}-${pad2(targetMonth)}-${pad2(targetDay)}`,
    '00:00',
  ).toISOString();
}

/** Argumentos de las funciones SQL `campaign_audience*`. */
interface AudienceRpcArgs {
  p_kind: CampaignAudienceKind;
  p_month: number | null;
  p_cutoff: string | null;
  p_client_ids: string[] | null;
}

function toRpcArgs(audience: CampaignAudience): AudienceRpcArgs {
  return {
    p_kind: audience.kind,
    p_month: audience.kind === 'birthday_month' ? audience.month : null,
    p_cutoff:
      audience.kind === 'inactive' || audience.kind === 'new'
        ? monthsAgoCutoffIso(audience.months)
        : null,
    p_client_ids: audience.kind === 'manual' ? audience.clientIds : null,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Error de la capa de audiencia, con mensaje ya listo para mostrar. */
export class CampaignAudienceError extends Error {
  constructor(what: string) {
    super(`No se pudo calcular ${what}. Revisa que la migración 0017 haya corrido.`);
    this.name = 'CampaignAudienceError';
  }
}

/**
 * Alcance del segmento, para mostrarlo ANTES de enviar.
 *
 * Con 40 de 59 clientas sin correo en producción, `reachableByEmail` es la
 * diferencia entre una expectativa y una decepción: el segmento puede tener
 * 59 personas y el correo llegarle a 19.
 */
export async function getCampaignAudienceStats(
  supabase: AudienceClient,
  audience: CampaignAudience,
): Promise<CampaignAudienceStats> {
  const { data, error } = await supabase.rpc('campaign_audience_stats', toRpcArgs(audience));

  if (error) throw new CampaignAudienceError('el alcance de la campaña');

  const row = ((data ?? []) as Array<{
    total: number;
    reachable_email: number;
    reachable_whatsapp: number;
    excluded_opt_out: number;
  }>)[0];

  return {
    total: Number(row?.total) || 0,
    reachableByEmail: Number(row?.reachable_email) || 0,
    reachableByWhatsapp: Number(row?.reachable_whatsapp) || 0,
    excludedByOptOut: Number(row?.excluded_opt_out) || 0,
  };
}

/**
 * Las destinatarias del segmento, ya SIN las que pidieron no recibir
 * marketing (lo filtra la función SQL, no este código).
 *
 * Pagina con `range()` hasta agotar el segmento: la función SQL ordena por
 * `id`, así que las páginas no se pisan ni se saltan filas. Sin esto,
 * `max_rows` cortaría la campaña en 1000 destinatarias sin decir nada.
 */
export async function resolveCampaignAudience(
  supabase: AudienceClient,
  audience: CampaignAudience,
): Promise<CampaignRecipient[]> {
  const args = toRpcArgs(audience);
  const recipients: CampaignRecipient[] = [];

  for (let from = 0; from < AUDIENCE_HARD_LIMIT; from += AUDIENCE_PAGE_SIZE) {
    // El `order by` explícito no es redundante con el de la función SQL: es
    // lo que garantiza que PostgREST emita un ORDER BY al paginar. Sin un
    // orden estable, dos páginas pueden repetir o saltarse filas.
    const { data, error } = await supabase
      .rpc('campaign_audience', args)
      .order('id', { ascending: true })
      .range(from, from + AUDIENCE_PAGE_SIZE - 1);

    if (error) throw new CampaignAudienceError('las destinatarias de la campaña');

    const page = (data ?? []) as Array<{
      id: string;
      name: string | null;
      phone: string | null;
      email: string | null;
    }>;

    for (const row of page) {
      recipients.push({
        id: row.id,
        name: row.name?.trim() || 'Hola',
        phone: row.phone,
        email: row.email,
      });
    }

    if (page.length < AUDIENCE_PAGE_SIZE) break;
  }

  return recipients;
}
