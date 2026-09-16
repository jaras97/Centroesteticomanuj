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
import PerformedServiceSelect from '@/components/admin/performed-service-select';
import ChargeAccountSelect from '@/components/admin/charge-account-select';
import { completeAppointment, getAvailableRewards } from '@/app/admin/(dashboard)/actions';
import { formatCOP } from '@/lib/format';
import type { FinancialAccount, LoyaltyReward } from '@/lib/supabase/types';

export default function CompleteAppointmentDialog({
  appointmentId,
  clientId,
  bookedServiceId,
  bookedServiceName,
  defaultAmount,
  depositReceivedAmount,
  accounts,
  onDone,
}: {
  appointmentId: string;
  clientId: string;
  bookedServiceId: string;
  bookedServiceName: string;
  defaultAmount: number;
  depositReceivedAmount?: number | null;
  /** Cuentas activas (`financial_accounts`), desde el Server Component. */
  accounts: FinancialAccount[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(bookedServiceId);
  const [amount, setAmount] = useState(String(defaultAmount || ''));
  const [accountId, setAccountId] = useState<string>('');
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [applyReward, setApplyReward] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    getAvailableRewards(clientId).then(setRewards);
  }, [open, clientId]);

  // Al reabrir se vuelve a partir de lo agendado (mismo criterio que el
  // diálogo de editar cita).
  useEffect(() => {
    if (open) return;
    setServiceId(bookedServiceId);
    setAmount(String(defaultAmount || ''));
    setAccountId('');
  }, [open, bookedServiceId, defaultAmount]);

  /** Si cambió el servicio, el valor cobrado parte del precio del nuevo. */
  function handleServiceChange(nextId: string, service?: { price: number | null }) {
    setServiceId(nextId);
    if (service?.price != null) setAmount(String(service.price));
  }

  const reward = rewards[0];
  const baseAmount = Number(amount) || 0;
  const finalAmount =
    applyReward && reward ? Math.round((baseAmount * (100 - reward.discount_percent)) / 100) : baseAmount;

  function handleComplete() {
    startTransition(async () => {
      const result = await completeAppointment(appointmentId, {
        chargedAmount: finalAmount,
        accountId: accountId || undefined,
        appliedRewardId: applyReward ? reward?.id : undefined,
        serviceId: serviceId !== bookedServiceId ? serviceId : undefined,
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
              Registra qué servicio se hizo y cuánto se cobró, para llevar la contabilidad del
              centro.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <PerformedServiceSelect
              open={open}
              value={serviceId}
              bookedServiceId={bookedServiceId}
              bookedServiceName={bookedServiceName}
              bookedServicePrice={defaultAmount || null}
              onChange={handleServiceChange}
            />

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

            <ChargeAccountSelect
              id='complete-charge-account'
              value={accountId}
              accounts={accounts}
              onChange={setAccountId}
            />

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
