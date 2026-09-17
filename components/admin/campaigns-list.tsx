'use client';

/**
 * La lista de campañas: borradores arriba (son las que se pueden tocar) y
 * enviadas abajo como historial.
 *
 * Tarjetas apiladas en móvil y tabla desde `md`, igual que `movements-table`:
 * seis columnas en 360px no se leen aunque scrollen, y la columna de
 * contenido del panel recorta el desborde en silencio.
 */

import { Copy, Mail, Megaphone, MessageCircle, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import ConfirmActionDialog from '@/components/admin/confirm-action-dialog';
import CampaignFormDialog, {
  type CampaignPreviewContext,
} from '@/components/admin/campaign-form-dialog';
import CampaignSendDialog from '@/components/admin/campaign-send-dialog';
import type { CampaignClientOption } from '@/components/admin/campaign-audience-field';
import { deleteCampaign } from '@/app/admin/(dashboard)/actions';
import {
  describeCampaignAudience,
  parseCampaignAudience,
} from '@/lib/notifications/audience';
import { CHANNEL_LABELS } from '@/lib/notifications/templates';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import type { Campaign, NotificationChannel } from '@/lib/notifications/types';

export default function CampaignsList({
  campaigns,
  previewContext,
  knownClients,
}: {
  campaigns: Campaign[];
  previewContext: CampaignPreviewContext;
  /** Nombres de las clientas elegidas a mano en los borradores existentes. */
  knownClients: CampaignClientOption[];
}) {
  const newCampaignButton = (
    <CampaignFormDialog previewContext={previewContext} knownClients={knownClients} />
  );

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        message='Todavía no hay campañas.'
        hint='Una campaña es una promoción con flyer que le mandas a un grupo de clientas por correo o WhatsApp. Se guarda como borrador: nada sale hasta que aprietes Enviar.'
        action={newCampaignButton}
      />
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-gray-500'>
          {campaigns.length === 1 ? '1 campaña' : `${campaigns.length} campañas`}
        </p>
        {newCampaignButton}
      </div>

      {/* Tarjetas: móvil y tablet angosta. */}
      <ul className='space-y-2 md:hidden'>
        {campaigns.map((campaign) => (
          <li key={campaign.id} className='rounded-lg border bg-white p-3 shadow-sm'>
            <div className='flex flex-wrap items-center gap-1.5'>
              <StatusBadge campaign={campaign} />
              <ChannelBadges channels={campaign.channels ?? []} />
            </div>
            <p className='mt-1.5 break-words text-sm font-medium text-brand-ink'>
              {campaign.title}
            </p>
            <p className='text-xs text-gray-500'>{audienceText(campaign)}</p>
            <p className='mt-0.5 text-xs text-gray-500'>{sentText(campaign)}</p>

            <div className='mt-3 flex flex-wrap gap-2'>
              <RowActions
                campaign={campaign}
                previewContext={previewContext}
                knownClients={knownClients}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Tabla: de `md` en adelante. */}
      <div className='hidden overflow-x-auto md:block'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead>A quiénes</TableHead>
              <TableHead>Canales</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className='text-right'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className='max-w-[18rem]'>
                  <p className='truncate font-medium text-brand-ink'>{campaign.title}</p>
                  <p className='truncate text-xs text-gray-500'>{sentText(campaign)}</p>
                </TableCell>
                <TableCell className='text-gray-500'>{audienceText(campaign)}</TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-1.5'>
                    <ChannelBadges channels={campaign.channels ?? []} />
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge campaign={campaign} />
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap justify-end gap-2'>
                    <RowActions
                      campaign={campaign}
                      previewContext={previewContext}
                      knownClients={knownClients}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Un BORRADOR se edita, se borra y se envía. Una ENVIADA no ofrece ninguna de
 * las tres: es el registro de lo que las clientas recibieron. Lo único que se
 * puede hacer con ella es duplicarla, que es cómo se "vuelve a mandar".
 */
function RowActions({
  campaign,
  previewContext,
  knownClients,
}: {
  campaign: Campaign;
  previewContext: CampaignPreviewContext;
  knownClients: CampaignClientOption[];
}) {
  return (
    <>
      {/* Siempre primero, también en una campaña ya enviada (ahí no muestra
          botón). Es lo que mantiene vivo el diálogo con el resultado del
          envío cuando `revalidatePath` refresca la lista y la fila pasa de
          BORRADOR a ENVIADA debajo de los pies del usuario. */}
      <CampaignSendDialog campaign={campaign} />

      {campaign.status === 'BORRADOR' ? (
        <>
          <CampaignFormDialog
            campaign={campaign}
            previewContext={previewContext}
            knownClients={knownClients}
          />
          <ConfirmActionDialog
            trigger={
              <Button size='sm' variant='outline' className='h-11 sm:h-9'>
                <Trash2 className='h-3.5 w-3.5' />
                Eliminar
              </Button>
            }
            title='Eliminar campaña'
            description={`Se borra el borrador "${campaign.title}". No se le envió nada a nadie, así que no hay nada que deshacer.`}
            successMessage='Campaña eliminada.'
            onConfirm={() => deleteCampaign(campaign.id)}
          />
        </>
      ) : (
        <CampaignFormDialog
          campaign={campaign}
          mode='duplicate'
          previewContext={previewContext}
          knownClients={knownClients}
          trigger={
            <Button size='sm' variant='outline' className='h-11 sm:h-9'>
              <Copy className='h-3.5 w-3.5' />
              Duplicar
            </Button>
          }
        />
      )}
    </>
  );
}

function audienceText(campaign: Campaign): string {
  const audience = parseCampaignAudience(campaign.audience);
  return audience ? describeCampaignAudience(audience) : 'Grupo no válido';
}

/**
 * En una enviada dice cuándo y a cuántas. Ojo con el número: `recipient_count`
 * es el alcance REAL (las que quedaron con al menos un mensaje encolable), no
 * el tamaño del grupo — por eso la palabra es "le llegó a", no "el grupo era".
 */
function sentText(campaign: Campaign): string {
  if (campaign.status !== 'ENVIADA') return 'Borrador: no se ha enviado';
  const when = campaign.sent_at ? formatBogotaHuman(campaign.sent_at) : 'fecha desconocida';
  if (campaign.recipient_count === null) return `Enviada el ${when}`;
  return `Enviada el ${when} · le llegó a ${campaign.recipient_count} ${
    campaign.recipient_count === 1 ? 'clienta' : 'clientas'
  }`;
}

function StatusBadge({ campaign }: { campaign: Campaign }) {
  return campaign.status === 'ENVIADA' ? (
    <Badge variant='success'>Enviada</Badge>
  ) : (
    <Badge variant='warning'>Borrador</Badge>
  );
}

function ChannelBadges({ channels }: { channels: NotificationChannel[] }) {
  if (channels.length === 0) {
    return (
      <Badge variant='outline' className='text-gray-500'>
        Sin canal
      </Badge>
    );
  }
  return (
    <>
      {channels.map((channel) => (
        <Badge key={channel} variant='outline' className='gap-1'>
          {channel === 'email' ? (
            <Mail aria-hidden className='h-3 w-3' />
          ) : (
            <MessageCircle aria-hidden className='h-3 w-3' />
          )}
          {CHANNEL_LABELS[channel]}
        </Badge>
      ))}
    </>
  );
}
