'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  createFinancialAccount,
  updateFinancialAccount,
} from '@/app/admin/(dashboard)/actions';
import type { FinancialAccount, FinancialAccountKind } from '@/lib/finance/types';

/** Etiqueta en español de cada tipo de cuenta. */
export const ACCOUNT_KIND_LABEL: Record<FinancialAccountKind, string> = {
  EFECTIVO: 'Efectivo',
  DIGITAL: 'Billetera digital',
  BANCO: 'Banco',
  OTRO: 'Otro',
};

const ACCOUNT_KINDS: FinancialAccountKind[] = ['EFECTIVO', 'DIGITAL', 'BANCO', 'OTRO'];

export default function FinancialAccountFormDialog({
  account,
  trigger,
}: {
  account?: FinancialAccount;
  trigger?: ReactNode;
}) {
  const isEditing = !!account;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<FinancialAccountKind>(account?.kind ?? 'EFECTIVO');
  const [openingBalance, setOpeningBalance] = useState(
    account ? String(account.opening_balance) : '0',
  );
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(account?.name ?? '');
      setKind(account?.kind ?? 'EFECTIVO');
      setOpeningBalance(account ? String(account.opening_balance) : '0');
    }
    setOpen(next);
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }

    const parsedOpening = Number(openingBalance || 0);
    if (!Number.isFinite(parsedOpening)) {
      toast.error('El saldo inicial no es válido.');
      return;
    }

    const input = { name: name.trim(), kind, openingBalance: parsedOpening };

    startTransition(async () => {
      const result = isEditing
        ? await updateFinancialAccount(account.id, input)
        : await createFinancialAccount(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Cuenta actualizada.' : 'Cuenta creada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nueva cuenta'}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
          <DialogDescription>
            Una cuenta es un lugar donde vive la plata: el efectivo del bolso, Nequi, la cuenta del
            banco.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='account-name'>Nombre</Label>
            <Input
              id='account-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ej. Nequi'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='account-kind'>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as FinancialAccountKind)}>
              <SelectTrigger id='account-kind'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {ACCOUNT_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='account-opening'>Saldo inicial (COP)</Label>
            <Input
              id='account-opening'
              type='number'
              step={1000}
              inputMode='numeric'
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
            <p className='text-xs text-gray-500'>
              Cuánta plata había en esta cuenta el día que empezaste a usar el sistema. Sin esto la
              caja disponible arrancaría en cero e ignoraría lo que ya tenías.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
