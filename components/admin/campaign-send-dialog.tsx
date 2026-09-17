'use client';

/**
 * Confirmar el envío de una campaña, y mostrar cómo le fue.
 *
 * NO usa `confirm-action-dialog.tsx` (el "¿seguro?" genérico del panel) por
 * dos motivos que son justamente lo que hace delicada esta pantalla:
 *
 *  1. ANTES hay que ver el alcance real y las advertencias. Un "¿seguro que
 *     quieres enviar?" a secas esconde que de 59 clientas el correo le llega
 *     a 19.
 *  2. DESPUÉS hay que ver el desglose (a cuántas llegó, cuántos correos,
 *     cuántos WhatsApp pendientes, cuántos no se pudieron encolar). Eso no
 *     entra en un toast, y es lo primero que se pregunta al terminar.
 *
 * Enviar es irreversible: encolar es mandar. Por eso el botón dice qué va a
 * pasar, no solo "Confirmar".
 */

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react';
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
import {
  CampaignDeliveryWarnings,
  CampaignReachCard,
  useCampaignReach,
} from '@/components/admin/campaign-reach';
import { sendCampaign } from '@/app/admin/(dashboard)/actions';
import { describeCampaignAudience, parseCampaignAudience } from '@/lib/notifications/audience';
import { CHANNEL_LABELS } from '@/lib/notifications/templates';
import type { Campaign } from '@/lib/notifications/types';

interface SendResult {
  recipientCount: number;
  queuedEmail: number;
  queuedWhatsapp: number;
  skipped: number;
}

export default function CampaignSendDialog({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const audience = parseCampaignAudience(campaign.audience);
  const channels = campaign.channels ?? [];
  // Mientras se muestra el resultado ya no hace falta recalcular el alcance.
  // Si el segmento guardado no se entiende, se pasa uno vacío a propósito
  // (queda "incompleto"): mostrar el alcance de "todas" sería mentir.
  const reach = useCampaignReach(
    audience ?? { kind: 'manual', clientIds: [] },
    open && !result,
  );

  function handleOpenChange(next: boolean) {
    if (next) setResult(null);
    setOpen(next);
  }

  function handleSend() {
    startTransition(async () => {
      const response = await sendCampaign(campaign.id);
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      setResult({
        recipientCount: response.recipientCount,
        queuedEmail: response.queuedEmail,
        queuedWhatsapp: response.queuedWhatsapp,
        skipped: response.skipped,
      });
      toast.success('Campaña enviada.');
    });
  }

  const channelNames = channels.map((c) => CHANNEL_LABELS[c]).join(' y ');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Al enviar, la campaña pasa a ENVIADA y el botón deja de tener
          sentido — pero el diálogo sigue montado mostrando el resultado. Por
          eso lo que desaparece es el disparador, no el componente entero:
          `revalidatePath` refresca la lista apenas termina el envío y
          desmontar acá se llevaría por delante el desglose recién llegado. */}
      {campaign.status === 'BORRADOR' && (
        <DialogTrigger asChild>
          <Button size='sm' className='h-11 sm:h-9'>
            <Send className='h-3.5 w-3.5' />
            Enviar
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <CheckCircle2 aria-hidden className='h-5 w-5 shrink-0 text-emerald-600' />
                Campaña enviada
              </DialogTitle>
              <DialogDescription>
                Esto fue lo que quedó encolado. El detalle de cada mensaje está en el Historial.
              </DialogDescription>
            </DialogHeader>

            <ul className='space-y-2 text-sm'>
              <ResultRow
                value={result.recipientCount}
                label='clientas con al menos un mensaje en camino'
              />
              {result.queuedEmail > 0 && (
                <ResultRow
                  value={result.queuedEmail}
                  label='correos encolados: salen por tandas, no todos de una'
                />
              )}
              {result.queuedWhatsapp > 0 && (
                <ResultRow
                  value={result.queuedWhatsapp}
                  label='mensajes esperándote en Pendientes de WhatsApp — se mandan de a uno'
                />
              )}
              {result.skipped > 0 && (
                <ResultRow
                  value={result.skipped}
                  label='mensajes que no se pudieron encolar (sin correo o sin teléfono registrado). Quedaron en el Historial como omitidos, con el motivo'
                  muted
                />
              )}
            </ul>

            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Entendido</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enviar &ldquo;{campaign.title}&rdquo;</DialogTitle>
              <DialogDescription>
                Va por {channelNames || 'ningún canal'} a:{' '}
                {audience ? describeCampaignAudience(audience) : 'grupo no válido'}.
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4'>
              <CampaignReachCard state={reach} channels={channels} />

              <p className='flex gap-2 rounded-md bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-900'>
                <AlertTriangle aria-hidden className='mt-0.5 h-3.5 w-3.5 shrink-0' />
                <span className='min-w-0'>
                  <strong className='font-semibold'>Esto no se puede deshacer.</strong> Una vez
                  encolados, los mensajes salen: no hay forma de cancelarlos desde el panel. La
                  campaña queda como enviada y ya no se puede editar ni borrar.
                </span>
              </p>

              <CampaignDeliveryWarnings state={reach} channels={channels} />
            </div>

            <DialogFooter>
              <Button variant='outline' onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={isPending || channels.length === 0}>
                {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
                Enviar ahora
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({
  value,
  label,
  muted = false,
}: {
  value: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <li className='flex gap-3 rounded-md border bg-white px-3 py-2'>
      <span
        className={
          muted
            ? 'shrink-0 text-lg font-semibold tabular-nums text-gray-500'
            : 'shrink-0 text-lg font-semibold tabular-nums text-brand-ink'
        }
      >
        {value}
      </span>
      <span className='min-w-0 text-xs leading-relaxed text-gray-600'>{label}</span>
    </li>
  );
}
