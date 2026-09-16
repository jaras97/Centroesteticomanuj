'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MOVEMENT_KIND_LABEL } from '@/lib/finance/types';
import type {
  ExpenseCategory,
  FinancialAccount,
  MonthStr,
  MovementKind,
} from '@/lib/finance/types';

const ALL = '__todos__';
const MOVEMENT_KINDS: MovementKind[] = ['INGRESO_OTRO', 'GASTO', 'RETIRO', 'APORTE'];

/**
 * Filtros del libro. El estado vive en la URL (igual que la búsqueda de
 * /admin/clientes): así se puede compartir el enlace, sobrevive un refresh y
 * el botón "atrás" hace lo que se espera.
 *
 * Los valores actuales llegan por props desde el Server Component en vez de
 * leerse con `useSearchParams`, que obligaría a envolver esto en `Suspense`
 * para nada: la página ya es dinámica.
 */
export default function MovementsFilters({
  month,
  kind,
  categoryId,
  accountId,
  accounts,
  categories,
}: {
  month: MonthStr;
  kind?: MovementKind;
  categoryId?: string;
  accountId?: string;
  accounts: FinancialAccount[];
  categories: ExpenseCategory[];
}) {
  const router = useRouter();

  function navigate(changes: Record<string, string | undefined>) {
    const next = { tipo: kind, categoria: categoryId, cuenta: accountId, ...changes };
    const search = new URLSearchParams({ month, tab: 'movimientos' });
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
    }
    // Cualquier cambio de filtro vuelve a la página 1: quedarse en la 3 de un
    // resultado que ahora tiene una sola página muestra una tabla vacía.
    router.push(`/admin/finanzas?${search.toString()}`);
  }

  const hasFilters = !!(kind || categoryId || accountId);

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
      <div className='space-y-1.5 sm:w-44'>
        <Label htmlFor='filter-kind' className='text-xs text-gray-500'>
          Tipo
        </Label>
        <Select
          value={kind ?? ALL}
          onValueChange={(v) => navigate({ tipo: v === ALL ? undefined : v })}
        >
          <SelectTrigger id='filter-kind' className='h-9'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {MOVEMENT_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {MOVEMENT_KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='space-y-1.5 sm:w-44'>
        <Label htmlFor='filter-category' className='text-xs text-gray-500'>
          Categoría
        </Label>
        <Select
          value={categoryId ?? ALL}
          onValueChange={(v) => navigate({ categoria: v === ALL ? undefined : v })}
        >
          <SelectTrigger id='filter-category' className='h-9'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='space-y-1.5 sm:w-44'>
        <Label htmlFor='filter-account' className='text-xs text-gray-500'>
          Cuenta
        </Label>
        <Select
          value={accountId ?? ALL}
          onValueChange={(v) => navigate({ cuenta: v === ALL ? undefined : v })}
        >
          <SelectTrigger id='filter-account' className='h-9'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las cuentas</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant='ghost'
          size='sm'
          className='self-start sm:self-end'
          onClick={() => navigate({ tipo: undefined, categoria: undefined, cuenta: undefined })}
        >
          <X className='h-3.5 w-3.5' />
          Quitar filtros
        </Button>
      )}
    </div>
  );
}
