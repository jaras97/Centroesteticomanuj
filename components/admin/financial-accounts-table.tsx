'use client';

import { useTransition } from 'react';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, TriangleAlert, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import ReorderHandle, {
  ReorderAnnouncer,
  reorderItemMotion,
} from '@/components/admin/reorder-handle';
import {
  useKeyboardReorder,
  type ReorderHandleProps,
} from '@/lib/admin/use-keyboard-reorder';
import FinancialAccountFormDialog, {
  ACCOUNT_KIND_LABEL,
} from '@/components/admin/financial-account-form-dialog';
import {
  reorderFinancialAccounts,
  setFinancialAccountActive,
} from '@/app/admin/(dashboard)/actions';
import { formatCOP } from '@/lib/format';
import type { CashPosition, FinancialAccount } from '@/lib/finance/types';

/**
 * Cuentas con su saldo actual, arrastrables para ordenarlas (el mismo patrón
 * de `hero-slides-table.tsx`: `Reorder` de framer-motion con un handle propio,
 * no la fila entera, para que en móvil se pueda scrollear la lista).
 *
 * Sin borrado duro: `financial_movements.account_id` es `on delete restrict` y
 * una cuenta vieja sigue explicando de dónde salió la plata del histórico. Solo
 * se desactiva.
 */
export default function FinancialAccountsTable({
  accounts: accountsProp,
  cash,
}: {
  accounts: FinancialAccount[];
  cash: CashPosition;
}) {
  // Orden optimista + teclado + anuncio, compartido con las otras listas
  // ordenables (ver `lib/admin/use-keyboard-reorder.ts`).
  const { items: accounts, setItems: setAccounts, getHandleProps, onDragEnd, announcer } =
    useKeyboardReorder({
      items: accountsProp,
      getLabel: (account) => account.name,
      itemNoun: 'la cuenta',
      persist: reorderFinancialAccounts,
    });

  // `cash.byAccount` solo trae las cuentas activas: es la definición de
  // `getCashPosition`. Lo que quedó pegado a una cuenta desactivada cae en
  // `unassignedBalance`, y por eso una cuenta inactiva no muestra saldo.
  const balances = new Map(cash.byAccount.map((row) => [row.account.id, row.balance]));

  return (
    <div className='space-y-3'>
      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          message='Todavía no hay cuentas.'
          hint='Crea al menos "Efectivo" y la billetera que uses, para saber dónde está cada peso.'
        />
      ) : (
        <>
          <ReorderAnnouncer {...announcer} />
          <Reorder.Group
            as='ul'
            axis='y'
            values={accounts}
            onReorder={setAccounts}
            className='space-y-2'
          >
            {accounts.map((account, index) => (
              <AccountRow
                key={account.id}
                account={account}
                balance={balances.get(account.id)}
                handle={getHandleProps(account, index)}
                onDragEnd={onDragEnd}
              />
            ))}
          </Reorder.Group>
        </>
      )}

      {cash.unassignedBalance !== 0 && (
        <div className='rounded-lg border border-amber-200 bg-amber-50 p-3'>
          <div className='flex items-start justify-between gap-3'>
            <div className='flex min-w-0 items-start gap-2'>
              <TriangleAlert className='mt-0.5 h-4 w-4 shrink-0 text-amber-600' aria-hidden />
              <div className='min-w-0'>
                <p className='text-sm font-medium text-amber-900'>Sin asignar</p>
                <p className='text-xs text-amber-800'>
                  Plata que sí cuenta en la caja total pero no en el saldo de ninguna cuenta: citas
                  o movimientos guardados sin cuenta, más lo que quedó pegado a una cuenta
                  desactivada. Edítalos desde Movimientos para repartirlos.
                </p>
              </div>
            </div>
            <span className='shrink-0 text-sm font-semibold tabular-nums text-amber-900'>
              {formatCOP(cash.unassignedBalance)}
            </span>
          </div>
        </div>
      )}

      <div className='flex items-center justify-between gap-3 rounded-lg border bg-white p-3'>
        <span className='text-sm font-semibold text-brand-ink'>Caja disponible</span>
        <span className='text-sm font-semibold tabular-nums text-brand-ink'>
          {formatCOP(cash.totalCash)}
        </span>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  balance,
  handle,
  onDragEnd,
}: {
  account: FinancialAccount;
  balance: number | undefined;
  handle: ReorderHandleProps;
  onDragEnd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

  function toggleActive() {
    startTransition(async () => {
      const result = await setFinancialAccountActive(account.id, !account.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Reorder.Item
      as='li'
      value={account}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className='flex flex-col gap-3 rounded-lg border bg-white p-3 shadow-sm sm:flex-row sm:items-center'
      {...reorderItemMotion(reduceMotion)}
    >
      <div className='flex min-w-0 flex-1 items-start gap-3'>
        <ReorderHandle dragControls={dragControls} {...handle} />

        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='font-medium text-brand-ink'>{account.name}</span>
            <Badge variant='outline'>{ACCOUNT_KIND_LABEL[account.kind]}</Badge>
            {!account.active && <Badge variant='secondary'>Inactiva</Badge>}
          </div>
          <p className='mt-0.5 text-xs text-gray-500'>
            Saldo inicial {formatCOP(account.opening_balance)}
          </p>
        </div>

        <div className='shrink-0 text-right'>
          <p className='text-xs text-gray-500'>Saldo actual</p>
          <p className='text-sm font-semibold tabular-nums text-brand-ink'>
            {balance === undefined ? '—' : formatCOP(balance)}
          </p>
        </div>
      </div>

      <div className='flex flex-wrap gap-2 sm:shrink-0'>
        <FinancialAccountFormDialog account={account} />
        <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          {account.active ? 'Desactivar' : 'Activar'}
        </Button>
      </div>
    </Reorder.Item>
  );
}
