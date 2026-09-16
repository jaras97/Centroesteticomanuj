'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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

/**
 * Confirmación genérica para acciones destructivas del panel.
 *
 * Ojo: `confirm-dialog.tsx` NO es esto — ese es el diálogo de "confirmar una
 * cita", con su duración y su anticipo. Este es el "¿seguro?" reusable.
 *
 * La acción se recibe como función (no como Server Action pasada por props
 * crudas) y se ejecuta dentro de un `useTransition`, que es el patrón del
 * resto del panel para que el botón se deshabilite mientras el servidor
 * revalida.
 */
export default function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Eliminar',
  successMessage,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  successMessage: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (!result.ok) {
        toast.error(result.error ?? 'No se pudo completar la acción.');
        return;
      }
      toast.success(successMessage);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant='destructive' onClick={handleConfirm} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
