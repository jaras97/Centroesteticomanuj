'use client';

import { useState, useTransition } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCOP } from '@/lib/format';
import { updateAppointmentCharge } from '@/app/admin/(dashboard)/actions';

const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'];

/**
 * Corrige el valor cobrado / método de pago de una cita ya completada.
 * Antes esto solo se podía escribir al marcar la cita como completada, así
 * que un monto mal digitado quedaba fijo para siempre en Finanzas.
 */
export default function EditChargeDialog({
  appointmentId,
  currentAmount,
  currentPaymentMethod,
  depositReceivedAmount,
  onDone,
}: {
  appointmentId: string;
  currentAmount: number | null;
  currentPaymentMethod: string | null;
  depositReceivedAmount: number | null;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(currentAmount != null ? String(currentAmount) : '');
  const [paymentMethod, setPaymentMethod] = useState(currentPaymentMethod ?? '');
  const [isPending, startTransition] = useTransition();

  const baseAmount = Number(amount) || 0;

  function handleSave() {
    startTransition(async () => {
      const result = await updateAppointmentCharge(appointmentId, {
        chargedAmount: baseAmount,
        paymentMethod: paymentMethod || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Cobro actualizado.');
      setOpen(false);
      onDone?.();
    });
  }

  return (
    <>
      <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
        <Pencil className='h-3.5 w-3.5' />
        {currentAmount == null ? 'Registrar cobro' : 'Corregir cobro'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentAmount == null ? 'Registrar cobro' : 'Corregir cobro'}
            </DialogTitle>
            <DialogDescription>
              Esta cita ya está completada. El cambio se refleja de inmediato en Finanzas.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
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

            <div className='space-y-2'>
              <Label>Método de pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder='Selecciona uno (opcional)' />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
