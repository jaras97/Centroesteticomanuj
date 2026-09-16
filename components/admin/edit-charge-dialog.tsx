'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import PerformedServiceSelect from '@/components/admin/performed-service-select';
import ChargeAccountSelect from '@/components/admin/charge-account-select';
import { formatCOP } from '@/lib/format';
import { updateAppointmentCharge } from '@/app/admin/(dashboard)/actions';
import type { FinancialAccount } from '@/lib/supabase/types';

/**
 * Corrige una cita ya completada: servicio realizado, valor cobrado y cuenta a
 * la que entró la plata. Antes esto solo se podía escribir al marcarla como
 * completada, así que un monto mal digitado — o un cambio de servicio que solo
 * se notó al cerrar la cita — quedaba fijo para siempre en Finanzas.
 *
 * Desde la migración 0016 el selector es de **cuenta** (`financial_accounts`),
 * no de método de pago en texto libre: `payment_method` se sigue escribiendo
 * con el nombre de la cuenta para no romper el historial anterior.
 */
export default function EditChargeDialog({
  appointmentId,
  bookedServiceId,
  bookedServiceName,
  currentAmount,
  currentAccountId,
  depositReceivedAmount,
  accounts,
  onDone,
}: {
  appointmentId: string;
  bookedServiceId: string;
  bookedServiceName: string;
  currentAmount: number | null;
  /** Cuenta ya registrada en la cita, si la tiene (citas previas a 0016 no). */
  currentAccountId: string | null;
  depositReceivedAmount: number | null;
  /** Cuentas activas (`financial_accounts`), desde el Server Component. */
  accounts: FinancialAccount[];
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(bookedServiceId);
  const [amount, setAmount] = useState(currentAmount != null ? String(currentAmount) : '');
  const [accountId, setAccountId] = useState(currentAccountId ?? '');
  const [isPending, startTransition] = useTransition();

  // Al reabrir se vuelve a partir de lo que tiene guardado la cita.
  useEffect(() => {
    if (open) return;
    setServiceId(bookedServiceId);
    setAmount(currentAmount != null ? String(currentAmount) : '');
    setAccountId(currentAccountId ?? '');
  }, [open, bookedServiceId, currentAmount, currentAccountId]);

  const baseAmount = Number(amount) || 0;

  function handleSave() {
    startTransition(async () => {
      const result = await updateAppointmentCharge(appointmentId, {
        chargedAmount: baseAmount,
        accountId: accountId || undefined,
        serviceId: serviceId !== bookedServiceId ? serviceId : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Cita actualizada.');
      setOpen(false);
      onDone?.();
    });
  }

  return (
    <>
      <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
        <Pencil className='h-3.5 w-3.5' />
        {currentAmount == null ? 'Registrar cobro' : 'Corregir cita'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentAmount == null ? 'Registrar cobro' : 'Corregir cita completada'}
            </DialogTitle>
            <DialogDescription>
              Esta cita ya está completada. Puedes corregir el servicio que se realizó y el cobro;
              el cambio se refleja de inmediato en Finanzas.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <PerformedServiceSelect
              open={open}
              value={serviceId}
              bookedServiceId={bookedServiceId}
              bookedServiceName={bookedServiceName}
              bookedServicePrice={currentAmount}
              onChange={(nextId) => setServiceId(nextId)}
            />

            <div className='space-y-2'>
              <Label htmlFor='edit-charged-amount'>Valor cobrado</Label>
              <Input
                id='edit-charged-amount'
                type='number'
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {!!depositReceivedAmount && (
                <p className='text-sm text-gray-500'>
                  Incluye el anticipo de {formatCOP(depositReceivedAmount)} → saldo cobrado ese
                  día:{' '}
                  <span className='font-medium text-brand-ink'>
                    {formatCOP(Math.max(baseAmount - depositReceivedAmount, 0))}
                  </span>
                </p>
              )}
            </div>

            <ChargeAccountSelect
              id='edit-charge-account'
              value={accountId}
              accounts={accounts}
              onChange={setAccountId}
            />
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isPending || !amount}>
              {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
