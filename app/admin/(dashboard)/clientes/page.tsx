import { Suspense } from 'react';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import ClientsTable, {
  parseClientsOrder,
  type ClientRow,
  type ClientsOrder,
} from '@/components/admin/clients-table';
import ClientsSearch from '@/components/admin/clients-search';
import Pagination from '@/components/admin/pagination';
import ClientFormDialog from '@/components/admin/client-form-dialog';

const PAGE_SIZE = 25;
const BASE_PATH = '/admin/clientes';

/** Fila tal como la devuelve la vista `clients_with_stats` (migración 0013). */
interface ClientStatsRow {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  birthday: string | null;
  visit_count: number;
  last_visit: string | null;
}

/**
 * Sanea el texto de búsqueda antes de meterlo en un filtro `.or()` de
 * PostgREST. El valor viaja crudo dentro de `or=(name.ilike."%x%",…)`, así
 * que una coma, un paréntesis o una comilla del usuario romperían la
 * sintaxis del filtro, y `%`/`_` son comodines de `ilike` que ensancharían
 * la búsqueda sin que el usuario lo pida. Se usa lista blanca (letras con
 * tilde y ñ incluidas, dígitos, espacios y los signos normales de un
 * teléfono) en vez de lista negra, que siempre se queda corta.
 */
function sanitizeQuery(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s@+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Aplica orden + filtro + rango. Se extrae porque puede correr dos veces
 * (ver el reajuste de página fuera de rango más abajo). */
async function fetchClients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { query, orden, page }: { query: string; orden: ClientsOrder; page: number },
) {
  let request = supabase
    .from('clients_with_stats')
    .select('id, name, phone, notes, birthday, visit_count, last_visit', {
      count: 'exact',
    });

  if (query) {
    // Las comillas dobles son la forma documentada de PostgREST para valores
    // con caracteres reservados; `sanitizeQuery` garantiza que el texto no
    // trae comillas ni barras que puedan cerrarlas antes de tiempo.
    request = request.or(`name.ilike."%${query}%",phone.ilike."%${query}%"`);
  }

  if (orden === 'visitas') {
    request = request
      .order('visit_count', { ascending: false })
      .order('name', { ascending: true });
  } else if (orden === 'ultima') {
    // Los clientes sin ninguna visita van al final, no al principio.
    request = request
      .order('last_visit', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true });
  } else {
    request = request.order('name', { ascending: true });
  }

  const from = (page - 1) * PAGE_SIZE;
  return request.range(from, from + PAGE_SIZE - 1);
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; orden?: string }>;
}) {
  const params = await searchParams;
  const query = sanitizeQuery(params.q);
  const orden = parseClientsOrder(params.orden);
  const requestedPage = parsePage(params.page);

  const supabase = await createClient();

  let { data, count, error } = await fetchClients(supabase, {
    query,
    orden,
    page: requestedPage,
  });

  // Página fuera de rango (ej. se buscó algo estando en la página 5, o se
  // pegó una URL vieja): se reconsulta la última página real en vez de
  // mostrar una tabla vacía sin explicación.
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  let page = requestedPage;
  if (requestedPage > totalPages && totalCount > 0) {
    page = totalPages;
    ({ data, error } = await fetchClients(supabase, { query, orden, page }));
  }

  const rows: ClientRow[] = ((data ?? []) as ClientStatsRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    birthday: row.birthday,
    visitCount: row.visit_count ?? 0,
    lastVisit: row.last_visit,
  }));

  return (
    <div>
      <div className='flex items-center justify-between gap-3 mb-6'>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink'>
          <Users className='h-6 w-6 text-brand-teal' />
          Clientes
        </h1>
        <ClientFormDialog />
      </div>

      <div className='mb-4'>
        <Suspense fallback={<div className='h-10 w-full sm:max-w-sm rounded-md border bg-white' />}>
          <ClientsSearch />
        </Suspense>
      </div>

      {error ? (
        <p className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
          No se pudo cargar la lista de clientes. Si es la primera vez que ves
          esto, revisa que la migración <code>0013_clientes_busqueda.sql</code>{' '}
          ya se haya corrido en Supabase.
        </p>
      ) : (
        <>
          <ClientsTable clients={rows} orden={orden} query={query} basePath={BASE_PATH} />
          {totalCount > 0 && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              basePath={BASE_PATH}
              params={{ q: query, orden: orden === 'nombre' ? undefined : orden }}
              itemLabel={{ singular: 'cliente', plural: 'clientes' }}
            />
          )}
        </>
      )}
    </div>
  );
}
