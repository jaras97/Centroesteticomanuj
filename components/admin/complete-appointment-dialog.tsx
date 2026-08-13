'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { completeAppointment, getAvailableRewards } from '@/app/admin/(dashboard)/actions';
import { formatCOP } from '@/lib/format';
import type { LoyaltyReward } from '@/lib/supabase/types';

const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'];

export default function CompleteAppointmentDialog({
  appointmentId,
  clientId,
  defaultAmount,
  depositReceivedAmount,
  onDone,
}: {
  appointmentId: string;
  clientId: string;
  defaultAmount: number;
  depositReceivedAmount?: number | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount || ''));
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [applyReward, setApplyReward] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    getAvailableRewards(clientId).then(setRewards);
  }, [open, clientId]);

  const reward = rewards[0];
  const baseAmount = Number(amount) || 0;
  const finalAmount =
    applyReward && reward ? Math.round((baseAmount * (100 - reward.discount_percent)) / 100) : baseAmount;

  function handleComplete() {
    startTransition(async () => {
      const result = await completeAppointment(appointmentId, {
        chargedAmount: finalAmount,
        paymentMethod: paymentMethod || undefined,
        appliedRewardId: applyReward ? reward?.id : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Cita completada.');
      if (result.loyaltyGranted) {
        toast.success('🎉 Este cliente ganó un cupón de fidelización para su próxima cita.');
      }
      setOpen(false);
      onDone();
    });
  }

  return (
    <>
      <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
        Completada
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar cita</DialogTitle>
            <DialogDescription>
              Registra el valor cobrado para llevar la contabilidad del centro.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='charged-amount'>Valor cobrado</Label>
              <Input
                id='charged-amount'
                type='number'
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {!!depositReceivedAmount && (
                <p className='text-sm text-gray-500'>
                  Ya recibió un anticipo de {formatCOP(depositReceivedAmount)} → saldo pendiente
                  hoy: <span className='font-medium text-brand-ink'>{formatCOP(Math.max(baseAmount - depositReceivedAmount, 0))}</span>
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

            {reward && (
              <label className='flex items-start gap-2 text-sm bg-brand-gold/10 border border-brand-gold/30 rounded-md p-3'>
                <input
                  type='checkbox'
                  className='mt-0.5'
                  checked={applyReward}
                  onChange={(e) => setApplyReward(e.target.checked)}
                />
                <span>
                  Aplicar cupón de fidelización ({reward.discount_percent}% de descuento). Total con
                  descuento: <strong>{formatCOP(finalAmount)}</strong>
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleComplete} disabled={isPending || !amount}>
              {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
              Completar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
