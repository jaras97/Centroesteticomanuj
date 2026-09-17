'use client';

/**
 * El selector de "¿a quiénes?" de una campaña.
 *
 * No segmenta nada por su cuenta: solo arma el objeto `CampaignAudience` que
 * define `lib/notifications/types.ts` y que resuelve Postgres. Toda la
 * clasificación de clientas (cumpleañeras, inactivas, nuevas) vive en las
 * funciones SQL de la migración 0017 — ver el encabezado de
 * `lib/notifications/audience.ts`, que explica por qué.
 */

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchClients } from '@/app/admin/(dashboard)/actions';
import {
  AUDIENCE_KIND_DESCRIPTIONS,
  AUDIENCE_KIND_LABELS,
  MONTH_LABELS,
} from '@/lib/notifications/audience';
import { todayInBogota } from '@/lib/booking/timezone';
import type { CampaignAudience, CampaignAudienceKind } from '@/lib/notifications/types';

/** Lo mínimo que necesita el buscador para mostrar a una clienta. */
export interface CampaignClientOption {
  id: string;
  name: string;
  phone: string | null;
}

const KIND_ORDER: CampaignAudienceKind[] = [
  'all',
  'birthday_month',
  'inactive',
  'new',
  'manual',
];

/**
 * Antigüedades ofrecidas, en meses. Es una lista y no un campo numérico
 * libre porque esto se usa desde el celular: un `<select>` no abre el teclado
 * y no admite un valor inválido a medio escribir (un campo vacío dejaría el
 * segmento roto mientras se tipea).
 */
const MONTH_AMOUNTS = [1, 2, 3, 6, 9, 12, 18, 24, 36];

/** El mes en curso en Bogotá (1-12). Nunca `getMonth()`: el proceso corre en UTC. */
function currentMonthNumber(): number {
  return Number(todayInBogota().split('-')[1]);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Valores de arranque al cambiar de tipo de grupo. */
function defaultAudienceFor(kind: CampaignAudienceKind): CampaignAudience {
  switch (kind) {
    case 'all':
      return { kind: 'all' };
    case 'birthday_month':
      return { kind: 'birthday_month', month: currentMonthNumber() };
    case 'inactive':
      return { kind: 'inactive', months: 6 };
    case 'new':
      return { kind: 'new', months: 3 };
    case 'manual':
      return { kind: 'manual', clientIds: [] };
  }
}

export default function CampaignAudienceField({
  audience,
  onChange,
  knownClients,
}: {
  audience: CampaignAudience;
  onChange: (audience: CampaignAudience) => void;
  /**
   * Clientas cuyos nombres ya se conocen (las que el borrador tenía elegidas
   * a mano). Sin esto, al reabrir una campaña guardada se verían ids sueltos.
   */
  knownClients: CampaignClientOption[];
}) {
  return (
    <div className='space-y-3'>
      <div className='space-y-2'>
        <Label htmlFor='campaign-audience-kind'>¿A quiénes?</Label>
        <Select
          value={audience.kind}
          onValueChange={(kind) => onChange(defaultAudienceFor(kind as CampaignAudienceKind))}
        >
          <SelectTrigger id='campaign-audience-kind'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_ORDER.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {AUDIENCE_KIND_LABELS[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className='text-xs leading-snug text-gray-500'>
          {AUDIENCE_KIND_DESCRIPTIONS[audience.kind]}
        </p>
      </div>

      {audience.kind === 'birthday_month' && (
        <div className='space-y-2'>
          <Label htmlFor='campaign-audience-month'>Mes del cumpleaños</Label>
          <Select
            value={String(audience.month)}
            onValueChange={(value) =>
              onChange({ kind: 'birthday_month', month: Number(value) })
            }
          >
            <SelectTrigger id='campaign-audience-month'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.map((label, index) => (
                <SelectItem key={label} value={String(index + 1)}>
                  {capitalize(label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(audience.kind === 'inactive' || audience.kind === 'new') && (
        <div className='space-y-2'>
          <Label htmlFor='campaign-audience-months'>
            {audience.kind === 'inactive' ? 'Sin venir hace más de' : 'Llegaron dentro de'}
          </Label>
          <Select
            value={String(audience.months)}
            onValueChange={(value) =>
              onChange({ kind: audience.kind, months: Number(value) })
            }
          >
            <SelectTrigger id='campaign-audience-months'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Si el borrador traía un valor que no está en la lista, se
                  agrega para no cambiarle el segmento por abrirlo. */}
              {Array.from(new Set([...MONTH_AMOUNTS, audience.months]))
                .sort((a, b) => a - b)
                .map((months) => (
                  <SelectItem key={months} value={String(months)}>
                    {months === 1 ? '1 mes' : `${months} meses`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className='text-xs leading-snug text-gray-500'>
            {audience.kind === 'inactive'
              ? 'Se mira la última cita COMPLETADA. Quien nunca completó ninguna también entra: es justo a quien quieres escribirle.'
              : 'Se mira la PRIMERA cita COMPLETADA. Quien todavía no completó ninguna no entra.'}
          </p>
        </div>
      )}

      {audience.kind === 'manual' && (
        <ManualClientPicker
          clientIds={audience.clientIds}
          knownClients={knownClients}
          onChange={(clientIds) => onChange({ kind: 'manual', clientIds })}
        />
      )}
    </div>
  );
}

/**
 * Buscador con selección múltiple. Busca en el servidor (`searchClients`, por
 * nombre o teléfono) en vez de filtrar una lista traída de antemano: PostgREST
 * corta los `select` en 1000 filas sin avisar, y una lista recortada dejaría
 * clientas invisibles para siempre.
 */
function ManualClientPicker({
  clientIds,
  knownClients,
  onChange,
}: {
  clientIds: string[];
  knownClients: CampaignClientOption[];
  onChange: (clientIds: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CampaignClientOption[]>([]);
  // Caché de nombres: arranca con los del borrador y crece con cada búsqueda,
  // para que un chip ya elegido no pierda el nombre al limpiar la búsqueda.
  const [namesById, setNamesById] = useState<Record<string, CampaignClientOption>>(() =>
    Object.fromEntries(knownClients.map((c) => [c.id, c])),
  );

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const found = (await searchClients(query)) as CampaignClientOption[];
      if (cancelled) return;
      setResults(found);
      setNamesById((current) => {
        const next = { ...current };
        for (const client of found) next[client.id] = client;
        return next;
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  function toggle(client: CampaignClientOption) {
    setNamesById((current) => ({ ...current, [client.id]: client }));
    onChange(
      clientIds.includes(client.id)
        ? clientIds.filter((id) => id !== client.id)
        : [...clientIds, client.id],
    );
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor='campaign-client-search'>Buscar clientas</Label>
      <div className='relative'>
        <Search aria-hidden className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
        <Input
          id='campaign-client-search'
          className='pl-9'
          placeholder='Nombre o teléfono…'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {results.length > 0 && (
        <ul className='divide-y rounded-md border bg-white'>
          {results.map((client) => {
            const isSelected = clientIds.includes(client.id);
            return (
              <li key={client.id}>
                <button
                  type='button'
                  aria-pressed={isSelected}
                  onClick={() => toggle(client)}
                  className='flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal'
                >
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-medium text-brand-ink'>
                      {client.name}
                    </span>
                    <span className='block truncate text-xs text-gray-500'>
                      {client.phone || 'Sin teléfono'}
                    </span>
                  </span>
                  <span className='shrink-0 text-xs font-medium text-brand-teal'>
                    {isSelected ? 'Quitar' : 'Agregar'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {clientIds.length === 0 ? (
        <p className='text-xs text-gray-500'>
          Todavía no elegiste a nadie. Busca por nombre o teléfono y toca para agregar.
        </p>
      ) : (
        <div className='space-y-2'>
          <p className='text-xs text-gray-500'>
            {clientIds.length === 1 ? '1 clienta elegida' : `${clientIds.length} clientas elegidas`}
          </p>
          <ul className='flex flex-wrap gap-2'>
            {clientIds.map((id) => (
              <li key={id}>
                <button
                  type='button'
                  onClick={() => onChange(clientIds.filter((other) => other !== id))}
                  className='flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-brand-teal/30 bg-brand-teal/5 py-1 pl-3 pr-2 text-xs text-brand-teal transition-colors hover:bg-brand-teal/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal'
                >
                  <span className='truncate'>{namesById[id]?.name ?? 'Clienta elegida'}</span>
                  <X aria-hidden className='h-3.5 w-3.5 shrink-0' />
                  <span className='sr-only'>Quitar de la campaña</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
