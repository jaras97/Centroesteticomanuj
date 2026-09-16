import { History, MessageCircle, Mails } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isEmailConfigured } from '@/lib/notifications/channels/email';
import NotificationSettingsCard from '@/components/admin/notification-settings-card';
import NotificationTemplatesEditor from '@/components/admin/notification-templates-editor';
import NotificationWhatsappInbox from '@/components/admin/notification-whatsapp-inbox';
import NotificationHistory from '@/components/admin/notification-history';
import type {
  Notification,
  NotificationSettings,
  NotificationTemplate,
} from '@/lib/notifications/types';

// Historial visible. El outbox se conserva completo en la base; acá se
// muestran los últimos movimientos, que es lo que se consulta en la práctica.
const HISTORY_LIMIT = 150;

export default async function NotificacionesPage() {
  const supabase = await createClient();

  const [
    { data: templates, error: templatesError },
    { data: settings },
    { data: pendingWhatsapp },
    { data: history },
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
        <TabsList>
          <TabsTrigger value='plantillas' className='gap-1.5'>
            <Mails className='h-4 w-4' />
            Plantillas
          </TabsTrigger>
          <TabsTrigger value='whatsapp' className='gap-1.5'>
            <MessageCircle className='h-4 w-4' />
            Pendientes de WhatsApp
            {pending.length > 0 && (
              <span className='ml-1 rounded-full bg-brand-teal px-1.5 text-[11px] font-semibold text-white'>
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value='historial' className='gap-1.5'>
            <History className='h-4 w-4' />
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
          />
        </TabsContent>

        <TabsContent value='whatsapp' className='space-y-4'>
          <NotificationWhatsappInbox notifications={pending} />
        </TabsContent>

        <TabsContent value='historial' className='space-y-4'>
          <NotificationHistory notifications={(history ?? []) as Notification[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
