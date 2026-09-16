'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FinancialAccount } from '@/lib/supabase/types';

/**
 * Selector de cuenta para los diálogos de cobro (completar cita / corregir
 * cita). Reemplaza al array local `PAYMENT_METHODS` que estaba hardcodeado en
 * los dos diálogos: el método de pago se capturaba como texto libre y no se
 * agregaba en ningún lado, así que no había forma de saber cuánta plata había
 * en efectivo y cuánta en el banco.
 *
 * Las cuentas llegan por props desde el Server Component que monta la agenda
 * (no se consultan acá): el diálogo se abre y cierra muchas veces y no tiene
 * sentido ir al servidor cada vez por una lista de tres filas.
 */
export default function ChargeAccountSelect({
  id = 'charge-account',
  value,
  accounts,
  onChange,
}: {
  id?: string;
  /** '' = sin cuenta asignada. */
  value: string;
  accounts: FinancialAccount[];
  onChange: (accountId: string) => void;
}) {
  const hasAccounts = accounts.length > 0;

  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>¿A qué cuenta entró?</Label>
      <Select value={value} onValueChange={onChange} disabled={!hasAccounts}>
        <SelectTrigger id={id}>
          <SelectValue
            placeholder={
              hasAccounts ? 'Selecciona una (opcional)' : 'No hay cuentas configuradas'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!hasAccounts && (
        <p className='text-sm text-gray-500'>
          Crea tus cuentas (Efectivo, Nequi, banco…) en Finanzas para saber de dónde entra la
          plata.
        </p>
      )}
    </div>
  );
}
