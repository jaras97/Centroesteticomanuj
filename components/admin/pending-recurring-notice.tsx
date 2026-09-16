'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { registerRecurringExpense } from '@/app/admin/(dashboard)/actions';
import { formatCOP } from '@/lib/format';
import { formatDateStrHuman } from '@/lib/booking/timezone';
import { monthLabel } from '@/lib/finance/month';
import type { MonthStr, PendingRecurringExpense } from '@/lib/finance/types';

/**
 * Aviso de gastos fijos que todavía no se registraron en el mes que se está
 * viendo. No se registran solos a propósito (ver la pestaña "Gastos fijos"):
 * acá se confirman de a uno, con la fecha y el monto a la vista.
 */
export default function PendingRecurringNotice({
  month,
  pending,
}: {
  month: MonthStr;
  pending: PendingRecurringExpense[];
}) {
  if (pending.length === 0) return null;

  const total = pending.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className='rounded-lg border border-amber-200 bg-amber-50 p-4'>
      <div className='flex items-start gap-2'>
        <CalendarClock className='mt-0.5 h-4 w-4 shrink-0 text-amber-600' aria-hidden />
        <div className='min-w-0'>
          <p className='text-sm font-semibold text-amber-900'>
            {pending.length === 1
              ? 'Tienes 1 gasto fijo sin registrar'
              : `Tienes ${pending.length} gastos fijos sin registrar`}{' '}
            en {monthLabel(month)}
          </p>
          <p className='text-xs text-amber-800'>
            Suman {formatCOP(total)}. Mientras no los registres no descuentan de la utilidad ni de
            la caja de este mes.
          </p>
        </div>
      </div>

      <ul className='mt-3 space-y-2'>
        {pending.map((item) => (
          <PendingRow key={item.id} month={month} item={item} />
        ))}
      </ul>
    </div>
  );
}

function PendingRow({ month, item }: { month: MonthStr; item: PendingRecurringExpense }) {
  const [isPending, startTransition] = useTransition();

  function handleRegister() {
    startTransition(async () => {
      const result = await registerRecurringExpense(item.id, month);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${item.name}" registrado.`);
    });
  }

  return (
    <li className='flex flex-col gap-2 rounded-md border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between'>
      <div className='min-w-0'>
        <p className='text-sm font-medium text-brand-ink'>
          {item.name} <span className='tabular-nums text-gray-500'>· {formatCOP(item.amount)}</span>
        </p>
        <p className='text-xs text-gray-500'>
          Se registrará el {formatDateStrHuman(item.suggestedDate)}
          {item.categoryName && ` · ${item.categoryName}`}
          {item.accountName ? ` · ${item.accountName}` : ' · sin cuenta asignada'}
        </p>
      </div>
      <Button size='sm' onClick={handleRegister} disabled={isPending} className='sm:shrink-0'>
        {isPending ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Check className='h-3.5 w-3.5' />}
        Registrar
      </Button>
    </li>
  );
}
