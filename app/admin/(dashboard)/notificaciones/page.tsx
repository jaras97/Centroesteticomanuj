import { History, Megaphone, MessageCircle, Mails } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isEmailConfigured } from '@/lib/notifications/channels/email';
import NotificationSettingsCard from '@/components/admin/notification-settings-card';
import NotificationTemplatesEditor from '@/components/admin/notification-templates-editor';
import NotificationWhatsappInbox from '@/components/admin/notification-whatsapp-inbox';
import NotificationHistory from '@/components/admin/notification-history';
import CampaignsList from '@/components/admin/campaigns-list';
import type { CampaignClientOption } from '@/components/admin/campaign-audience-field';
import { parseCampaignAudience } from '@/lib/notifications/audience';
import type {
  Campaign,
  Notification,
  NotificationSettings,
  NotificationTemplate,
} from '@/lib/notifications/types';

// Historial visible. El outbox se conserva completo en la base; acá se
// muestran los últimos movimientos, que es lo que se consulta en la práctica.
const HISTORY_LIMIT = 150;

/**
 * Los nombres de las clientas se piden por tandas: `in.(...)` viaja dentro de
 * la URL y 250 uuids de un saque la dejan rozando el límite del gateway (que
 * responde 414, no una lista vacía). Con tandas eso no puede pasar nunca.
 */
const CLIENT_LOOKUP_CHUNK = 80;

async function loadClientsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<CampaignClientOption[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CLIENT_LOOKUP_CHUNK) {
    chunks.push(ids.slice(i, i + CLIENT_LOOKUP_CHUNK));
  }

  const results = await Promise.all(
    chunks.map((chunk) => supabase.from('clients').select('id, name, phone').in('id', chunk)),
  );
  return results.flatMap((result) => (result.data ?? []) as CampaignClientOption[]);
}

export default async function NotificacionesPage() {
  const supabase = await createClient();

  const [
    { data: templates, error: templatesError },
    { data: settings },
    { data: pendingWhatsapp },
    { data: history },
    { data: campaignRows, error: campaignsError },
    { data: site },
  ] = await Promise.all([
    supabase
      .from('notification_templates')
      .select('*')
      .order('event')
      .order('recipient_kind')
      .order('channel'),
    supabase.from('notification_settings').select('*').eq('id', true).maybeSingle(),
    supabase
      .from('notifications')
      .select('*')
      .eq('channel', 'whatsapp')
      .eq('status', 'PENDIENTE')
      .order('scheduled_for', { ascending: true })
      .limit(100),
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    // 'BORRADOR' < 'ENVIADA' alfabéticamente, así que ordenar por `status`
    // deja arriba lo que todavía se puede tocar. Es el orden del índice
    // `campaigns_status_created_idx` de la 0017.
    supabase
      .from('campaigns')
      .select('*')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('site_settings')
      .select('email, phone_display, whatsapp_number')
      .eq('id', true)
      .maybeSingle(),
  ]);

  // La página es lo primero que se abre tras desplegar: si la migración
  // todavía no corrió, decirlo claro en vez de mostrar tablas vacías.
  if (templatesError || !settings) {
    return (
      <div>
        <h1 className='text-2xl font-bold text-brand-ink mb-6'>Notificaciones</h1>
        <p className='text-sm text-destructive'>
          Falta correr la migración <code>0014_notificaciones.sql</code> en Supabase Studio. Una
          vez corrida, esta pantalla queda lista.
        </p>
      </div>
    );
  }

  const pending = (pendingWhatsapp ?? []) as Notification[];
  const historyRows = (history ?? []) as Notification[];
  const campaigns = (campaignRows ?? []) as Campaign[];
  const drafts = campaigns.filter((c) => c.status === 'BORRADOR');

  // El historial y la bandeja etiquetan las filas que salieron de una
  // campaña; solo necesitan el nombre, no la campaña entera.
  const campaignOptions = campaigns.map((c) => ({ id: c.id, title: c.title }));

  // Nombres de las clientas elegidas a mano en los borradores. Sin esto, al
  // reabrir un borrador con selección manual se verían ids sueltos. Se piden
  // solo las que hacen falta, no toda la tabla de clientas.
  const manualClientIds = Array.from(
    new Set(
      campaigns.flatMap((campaign) => {
        const audience = parseCampaignAudience(campaign.audience);
        return audience?.kind === 'manual' ? audience.clientIds : [];
      }),
    ),
  );
  // El outbox guarda a quién se le escribió (correo y teléfono) pero NO cómo
  // se llama: `notifications` solo tiene `client_id`. Sin resolverlo acá,
  // buscar "María" en el historial no encuentra nada — que es justo lo primero
  // que uno intenta — y la bandeja de WhatsApp muestra números pelados. Se
  // piden los ids que aparecen en pantalla y nada más.
  const clientIds = Array.from(
    new Set([
      ...manualClientIds,
      ...[...pending, ...historyRows]
        .map((notification) => notification.client_id)
        .filter((id): id is string => !!id),
    ]),
  );
  const clients = await loadClientsByIds(supabase, clientIds);

  const manualClientIdSet = new Set(manualClientIds);
  const manualClients = clients.filter((client) => manualClientIdSet.has(client.id));
  const clientNames = clients.map(({ id, name }) => ({ id, name }));

  const previewContext = {
    businessName: (settings as NotificationSettings).business_name || 'Centro Estético Manuj',
    emailLogoUrl: (settings as NotificationSettings).email_logo_url ?? null,
    // El mismo contacto de baja que usa `loadNotificationContext` al encolar,
    // para que la vista previa no prometa algo distinto de lo que se manda.
    unsubscribeContact: site?.email ?? '',
    publicPhone: site?.phone_display || site?.whatsapp_number || '',
  };

  return (
    <div>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-brand-ink'>Notificaciones</h1>
        <p className='text-sm text-gray-500 mt-1'>
          Los correos salen solos. Los mensajes de WhatsApp los redacta el sistema y quedan en la
          bandeja de abajo para que los mandes con un click.
        </p>
      </div>

      <Tabs defaultValue='plantillas'>
        {/* 2×2 en móvil (mismo criterio que Finanzas): cuatro pestañas en una
            fila a 360px no caben, y una lista que scrollea de costado esconde
            las dos últimas sin que se note que están ahí. */}
        <TabsList className='grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:h-10 sm:w-auto sm:gap-0'>
          <TabsTrigger value='plantillas' className='min-h-11 gap-1.5 sm:min-h-0'>
            <Mails aria-hidden className='h-4 w-4 shrink-0' />
            Plantillas
          </TabsTrigger>
          <TabsTrigger value='campanas' className='min-h-11 gap-1.5 sm:min-h-0'>
            <Megaphone aria-hidden className='h-4 w-4 shrink-0' />
            Campañas
            {drafts.length > 0 && (
              <span className='ml-1 rounded-full bg-brand-teal px-1.5 text-[11px] font-semibold text-white'>
                {drafts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value='whatsapp' className='min-h-11 gap-1.5 sm:min-h-0'>
            <MessageCircle aria-hidden className='h-4 w-4 shrink-0' />
            {/* El rótulo largo no cabe en media pantalla de 360px. */}
            <span className='sm:hidden'>WhatsApp</span>
            <span className='hidden sm:inline'>Pendientes de WhatsApp</span>
            {pending.length > 0 && (
              <span className='ml-1 rounded-full bg-brand-teal px-1.5 text-[11px] font-semibold text-white'>
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value='historial' className='min-h-11 gap-1.5 sm:min-h-0'>
            <History aria-hidden className='h-4 w-4 shrink-0' />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value='plantillas' className='space-y-6'>
          <NotificationSettingsCard
            settings={settings as NotificationSettings}
            emailConfigured={isEmailConfigured()}
          />
          <NotificationTemplatesEditor
            templates={(templates ?? []) as NotificationTemplate[]}
            emailConfigured={isEmailConfigured()}
            emailLogoUrl={settings?.email_logo_url ?? null}
          />
        </TabsContent>

        <TabsContent value='campanas' className='space-y-4'>
          {campaignsError ? (
            // Mismo criterio que el aviso de la 0014 de más arriba: si la
            // tabla todavía no existe, decirlo en vez de mostrar una lista
            // vacía que parece "no hay campañas".
            <p className='text-sm text-destructive'>
              Falta correr la migración <code>0017_campanas.sql</code> en Supabase Studio (en los
              dos proyectos: desarrollo y producción). Una vez corrida, las campañas quedan
              listas.
            </p>
          ) : (
            <CampaignsList
              campaigns={campaigns}
              previewContext={previewContext}
              knownClients={manualClients}
            />
          )}
        </TabsContent>

        <TabsContent value='whatsapp' className='space-y-4'>
          <NotificationWhatsappInbox
            notifications={pending}
            campaigns={campaignOptions}
            clients={clientNames}
          />
        </TabsContent>

        <TabsContent value='historial' className='space-y-4'>
          <NotificationHistory
            notifications={historyRows}
            campaigns={campaignOptions}
            clients={clientNames}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
