'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
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
  createFinancialMovement,
  updateFinancialMovement,
} from '@/app/admin/(dashboard)/actions';
import { currentMonth } from '@/lib/finance/month';
import { todayInBogota } from '@/lib/booking/timezone';
import { cn } from '@/lib/utils';
import type {
  ExpenseCategory,
  FinancialAccount,
  MonthStr,
  MovementKind,
  MovementListRow,
} from '@/lib/finance/types';

/** Radix Select no admite un item con value=''; se usa un centinela. */
const NO_ACCOUNT = '__sin_cuenta__';
const NO_CATEGORY = '__sin_categoria__';

/**
 * Qué le hace cada tipo a los números. Es el texto que explica la distinción
 * que Manuela no tenía: un retiro no es un gasto.
 */
const KIND_OPTIONS: Array<{
  kind: MovementKind;
  label: string;
  icon: typeof TrendingUp;
  help: string;
}> = [
  {
    kind: 'INGRESO_OTRO',
    label: 'Ingreso extra',
    icon: TrendingUp,
    help: 'Plata que entró y no viene de una cita (venta de producto, un curso…). Suma a la utilidad del negocio.',
  },
  {
    kind: 'GASTO',
    label: 'Gasto',
    icon: Receipt,
    help: 'Un costo del negocio (insumos, arriendo, publicidad). Resta de la utilidad del negocio.',
  },
  {
    kind: 'RETIRO',
    label: 'Retiro',
    icon: ArrowUpRight,
    help: 'Plata que sacas para ti. NO resta de la utilidad —es utilidad ya ganada cambiando de bolsillo—, solo baja la caja disponible.',
  },
  {
    kind: 'APORTE',
    label: 'Aporte',
    icon: ArrowDownLeft,
    help: 'Plata tuya que metes al negocio. NO suma a la utilidad: solo sube la caja disponible.',
  },
];

export default function MovementFormDialog({
  movement,
  month,
  accounts,
  categories,
  defaultKind = 'GASTO',
  trigger,
}: {
  movement?: MovementListRow;
  /** Mes que se está viendo: define la fecha sugerida de un movimiento nuevo. */
  month: MonthStr;
  accounts: FinancialAccount[];
  categories: ExpenseCategory[];
  defaultKind?: MovementKind;
  trigger?: ReactNode;
}) {
  const isEditing = !!movement;

  // Si se está mirando el mes en curso, la fecha por defecto es hoy; si se
  // está mirando otro mes, el día 1 de ese mes (poner "hoy" ahí crearía un
  // movimiento fuera del mes que se está viendo y parecería que se perdió).
  const defaultDate = () =>
    month === currentMonth() ? todayInBogota() : `${month}-01`;

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MovementKind>(movement?.kind ?? defaultKind);
  const [movementDate, setMovementDate] = useState(movement?.movement_date ?? defaultDate());
  const [amount, setAmount] = useState(movement ? String(movement.amount) : '');
  const [accountId, setAccountId] = useState(movement?.account_id ?? NO_ACCOUNT);
  const [categoryId, setCategoryId] = useState(movement?.category_id ?? NO_CATEGORY);
  const [description, setDescription] = useState(movement?.description ?? '');
  const [isPending, startTransition] = useTransition();

  // Al abrir se re-siembra el formulario desde las props: el Server Component
  // vuelve a mandarlas frescas después de cada revalidatePath y, sin esto, un
  // diálogo ya montado seguiría mostrando los valores de la primera carga.
  function handleOpenChange(next: boolean) {
    if (next) {
      setKind(movement?.kind ?? defaultKind);
      setMovementDate(movement?.movement_date ?? defaultDate());
      setAmount(movement ? String(movement.amount) : '');
      setAccountId(movement?.account_id ?? NO_ACCOUNT);
      setCategoryId(movement?.category_id ?? NO_CATEGORY);
      setDescription(movement?.description ?? '');
    }
    setOpen(next);
  }

  const activeCategories = categories.filter(
    (c) => c.active || c.id === movement?.category_id,
  );
  const activeAccounts = accounts.filter((a) => a.active || a.id === movement?.account_id);
  const selected = KIND_OPTIONS.find((o) => o.kind === kind)!;

  function handleSubmit() {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('El monto debe ser mayor a cero.');
      return;
    }

    const input = {
      movementDate,
      kind,
      amount: parsedAmount,
      accountId: accountId === NO_ACCOUNT ? null : accountId,
      // La categoría solo tiene sentido en un gasto; la Server Action también
      // la limpia, pero no se manda de más para que el diálogo diga la verdad.
      categoryId: kind === 'GASTO' && categoryId !== NO_CATEGORY ? categoryId : null,
      description: description.trim() || null,
      // Editar un movimiento generado por un gasto fijo no debe desvincularlo
      // de su plantilla: si se perdiera, volvería a aparecer como pendiente.
      recurringTemplateId: movement?.recurring_template_id ?? null,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateFinancialMovement(movement.id, input)
        : await createFinancialMovement(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Movimiento actualizado.' : 'Movimiento registrado.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nuevo movimiento'}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className='max-h-[85vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar movimiento' : 'Nuevo movimiento'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>Tipo</Label>
            {/* 2×2 en vez de una fila de cuatro: a 360px una fila no cabe y
                el tipo es el campo que manda sobre el resto del formulario,
                así que tiene que verse entero de un vistazo. */}
            <div className='grid grid-cols-2 gap-2'>
              {KIND_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = option.kind === kind;
                return (
                  <button
                    key={option.kind}
                    type='button'
                    aria-pressed={isSelected}
                    onClick={() => setKind(option.kind)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      isSelected
                        ? 'border-brand-teal bg-brand-teal text-white'
                        : 'border-input text-brand-ink hover:bg-brand-teal/10',
                    )}
                  >
                    <Icon className='h-4 w-4 shrink-0' />
                    <span className='truncate'>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <p className='text-xs leading-snug text-gray-500'>{selected.help}</p>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='movement-date'>Fecha</Label>
              <Input
                id='movement-date'
                type='date'
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='movement-amount'>Monto (COP)</Label>
              <Input
                id='movement-amount'
                type='number'
                min={0}
                step={1000}
                inputMode='numeric'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {kind === 'GASTO' && (
            <div className='space-y-2'>
              <Label htmlFor='movement-category'>Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id='movement-category'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                  {activeCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeCategories.length === 0 && (
                <p className='text-xs text-gray-500'>
                  Todavía no hay categorías. Créalas en la pestaña Cuentas para poder ver en qué se
                  va la plata.
                </p>
              )}
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='movement-account'>
              {kind === 'GASTO' || kind === 'RETIRO' ? '¿De qué cuenta salió?' : '¿A qué cuenta entró?'}
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id='movement-account'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ACCOUNT}>Sin asignar</SelectItem>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-gray-500'>
              Sin cuenta el movimiento igual cuenta en la caja total, pero no en el saldo de
              ninguna cuenta.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='movement-description'>Descripción (opcional)</Label>
            <Input
              id='movement-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Ej. Pinceles nuevos'
            />
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
