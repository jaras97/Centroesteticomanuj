'use client';

/**
 * El alcance REAL de una campaña, antes de enviarla — y las tres cosas que
 * hay que advertir antes, no después.
 *
 * Por qué esto es lo más importante de la pantalla de campañas: en producción
 * 40 de 59 clientas no tienen correo registrado (en /reservar el correo es
 * opcional). Una campaña "a todas" por correo le llega a 19 personas. Si ese
 * número no está a la vista antes de apretar Enviar, la diferencia entre lo
 * que Manu espera y lo que pasa se descubre cuando ya no tiene arreglo.
 *
 * El conteo NO se calcula acá: sale de `previewCampaignAudience`, que llama a
 * la función SQL `campaign_audience_stats` (ver lib/notifications/audience.ts,
 * que explica por qué segmenta Postgres y no JavaScript). Este archivo solo
 * lo pide, lo muestra y lo explica.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, MessageCircle, Mail, Users } from 'lucide-react';
import { previewCampaignAudience } from '@/app/admin/(dashboard)/actions';
import { parseCampaignAudience } from '@/lib/notifications/audience';
import type {
  CampaignAudience,
  CampaignAudienceStats,
  NotificationChannel,
} from '@/lib/notifications/types';

/**
 * `incompleto` no es un error: es el segmento a medio armar (p. ej. una
 * selección a mano todavía sin ninguna clienta). Pedirle el alcance al
 * servidor en ese estado devolvería "el segmento no es válido", que suena a
 * falla cuando en realidad solo falta terminar de elegir.
 */
export type CampaignReachState =
  | { status: 'incompleto' }
  | { status: 'cargando' }
  | { status: 'error'; error: string }
  | { status: 'listo'; stats: CampaignAudienceStats };

/**
 * Pide el alcance cada vez que cambia el segmento, con un respiro de 350ms
 * para no disparar una consulta por cada tecla del buscador de clientas.
 *
 * `enabled` en `false` (diálogo cerrado) evita consultar de fondo algo que
 * nadie está mirando.
 */
export function useCampaignReach(
  audience: CampaignAudience,
  enabled = true,
): CampaignReachState {
  // El segmento es un objeto nuevo en cada render del formulario: comparar por
  // identidad relanzaría la consulta para siempre. Se compara su contenido.
  const key = JSON.stringify(audience);
  const [state, setState] = useState<CampaignReachState>({ status: 'incompleto' });

  useEffect(() => {
    if (!enabled) return;

    const parsed = parseCampaignAudience(JSON.parse(key) as unknown);
    if (!parsed) {
      setState({ status: 'incompleto' });
      return;
    }

    setState({ status: 'cargando' });

    let cancelled = false;
    const timeout = setTimeout(async () => {
      const result = await previewCampaignAudience(parsed);
      // Sin esto, una respuesta lenta de un segmento viejo pisaría el conteo
      // del segmento que Manu está mirando ahora.
      if (cancelled) return;

      if (!result.ok) {
        setState({ status: 'error', error: result.error });
        return;
      }
      setState({
        status: 'listo',
        stats: {
          total: result.total,
          reachableByEmail: result.reachableByEmail,
          reachableByWhatsapp: result.reachableByWhatsapp,
          excludedByOptOut: result.excludedByOptOut,
        },
      });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [key, enabled]);

  return state;
}

/**
 * El panel grande con el número. `aria-live` porque el conteo cambia solo al
 * mover el segmento: sin eso, quien navega con lector de pantalla no se
 * entera de que el alcance se actualizó.
 */
export function CampaignReachCard({
  state,
  channels,
}: {
  state: CampaignReachState;
  channels: NotificationChannel[];
}) {
  const hasEmail = channels.includes('email');
  const hasWhatsapp = channels.includes('whatsapp');

  return (
    <div
      aria-live='polite'
      className='rounded-lg border border-brand-teal/30 bg-brand-teal/5 p-4'
    >
      <div className='flex items-center gap-2'>
        <Users aria-hidden className='h-4 w-4 shrink-0 text-brand-teal' />
        <h4 className='text-sm font-semibold text-brand-ink'>¿A cuántas le llega?</h4>
      </div>

      {channels.length === 0 ? (
        <p className='mt-2 text-sm text-gray-500'>
          Elige al menos un canal para ver a cuántas clientas le llega.
        </p>
      ) : state.status === 'incompleto' ? (
        <p className='mt-2 text-sm text-gray-500'>
          Termina de armar el grupo para ver el alcance.
        </p>
      ) : state.status === 'cargando' ? (
        <p className='mt-2 flex items-center gap-2 text-sm text-gray-500'>
          <Loader2 aria-hidden className='h-4 w-4 animate-spin' />
          Calculando el alcance…
        </p>
      ) : state.status === 'error' ? (
        <p className='mt-2 text-sm text-destructive'>{state.error}</p>
      ) : (
        <>
          {/* 2 columnas también a 360px: son dos números cortos y ponerlos
              uno debajo del otro empuja las advertencias fuera de pantalla. */}
          <div className='mt-3 grid grid-cols-2 gap-3'>
            {hasEmail && (
              <ReachTile
                icon={Mail}
                value={state.stats.reachableByEmail}
                label='por correo'
              />
            )}
            {hasWhatsapp && (
              <ReachTile
                icon={MessageCircle}
                value={state.stats.reachableByWhatsapp}
                label='por WhatsApp'
              />
            )}
          </div>

          <p className='mt-3 text-sm leading-relaxed text-gray-600'>
            El grupo tiene <strong className='text-brand-ink'>{state.stats.total}</strong>{' '}
            {state.stats.total === 1 ? 'clienta' : 'clientas'}. Llega a{' '}
            {hasEmail && (
              <>
                <strong className='text-brand-ink'>{state.stats.reachableByEmail}</strong> por
                correo
              </>
            )}
            {hasEmail && hasWhatsapp && ' y a '}
            {hasWhatsapp && (
              <>
                <strong className='text-brand-ink'>{state.stats.reachableByWhatsapp}</strong> por
                WhatsApp
              </>
            )}
            .
            {state.stats.excludedByOptOut > 0 && (
              <>
                {' '}
                <strong className='text-brand-ink'>{state.stats.excludedByOptOut}</strong>{' '}
                {state.stats.excludedByOptOut === 1 ? 'quedó' : 'quedaron'} fuera porque{' '}
                {state.stats.excludedByOptOut === 1 ? 'pidió' : 'pidieron'} no recibir
                promociones.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

function ReachTile({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Mail;
  value: number;
  label: string;
}) {
  return (
    <div className='rounded-md border bg-white px-3 py-2'>
      <div className='flex items-center gap-1.5 text-gray-500'>
        <Icon aria-hidden className='h-3.5 w-3.5 shrink-0' />
        <span className='truncate text-xs'>{label}</span>
      </div>
      <p className='mt-0.5 text-2xl font-semibold tabular-nums text-brand-ink'>{value}</p>
    </div>
  );
}

/**
 * Las tres advertencias. No son adorno: cada una es una consecuencia real del
 * diseño del módulo que, sin decirla acá, se descubre después de enviar.
 *
 *  1. El grupo y "a cuántas llegó" no son el mismo número.
 *  2. El WhatsApp de una campaña es asistido: son N clics de Manu.
 *  3. Los correos salen por tandas del despachador, no todos de golpe.
 */
export function CampaignDeliveryWarnings({
  state,
  channels,
}: {
  state: CampaignReachState;
  channels: NotificationChannel[];
}) {
  if (channels.length === 0) return null;

  const stats = state.status === 'listo' ? state.stats : null;
  const hasEmail = channels.includes('email');
  const hasWhatsapp = channels.includes('whatsapp');

  // Solo tiene sentido advertir de la diferencia cuando de verdad la hay:
  // si todas las del grupo son alcanzables por todos los canales elegidos,
  // el número final va a coincidir con el del grupo.
  const countsWillDiffer =
    !!stats &&
    ((hasEmail && stats.reachableByEmail < stats.total) ||
      (hasWhatsapp && stats.reachableByWhatsapp < stats.total));

  return (
    <ul className='space-y-2'>
      {countsWillDiffer && (
        <WarningItem>
          <strong className='font-semibold'>
            El tamaño del grupo y el número final no van a coincidir, y está bien.
          </strong>{' '}
          El grupo son {stats.total} clientas; al enviar se cuentan solo las que quedaron con al
          menos un mensaje para encolar. A una clienta sin correo, en una campaña que va solo por
          correo, no se le puede escribir: su fila queda en el historial como{' '}
          <em>omitida</em> con el motivo. Ver un número más chico después de enviar no es un
          error.
        </WarningItem>
      )}

      {hasWhatsapp && (
        <WarningItem>
          <strong className='font-semibold'>
            Los WhatsApp no salen solos: los mandas tú, uno por uno.
          </strong>{' '}
          Van a la bandeja <em>Pendientes de WhatsApp</em> con el texto ya escrito, y cada uno se
          envía con un click
          {stats ? ` — son ${stats.reachableByWhatsapp} clicks` : ''}. Es a propósito: WhatsApp no
          permite mandar mensajes masivos desde un link.
        </WarningItem>
      )}

      {hasEmail && (
        <WarningItem>
          <strong className='font-semibold'>Los correos no salen todos de golpe.</strong> El
          despachador los manda por tandas, así que una campaña grande se reparte entre varias
          corridas del envío diario. Puedes seguirlas en el <em>Historial</em>.
        </WarningItem>
      )}
    </ul>
  );
}

function WarningItem({ children }: { children: React.ReactNode }) {
  return (
    <li className='flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900'>
      <AlertTriangle aria-hidden className='mt-0.5 h-3.5 w-3.5 shrink-0' />
      <span className='min-w-0'>{children}</span>
    </li>
  );
}
