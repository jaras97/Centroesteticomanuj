'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { updateNotificationSettings } from '@/app/admin/(dashboard)/actions';
import type { NotificationSettings } from '@/lib/notifications/types';

export default function NotificationSettingsCard({
  settings,
  emailConfigured,
}: {
  settings: NotificationSettings;
  emailConfigured: boolean;
}) {
  const [adminEmail, setAdminEmail] = useState(settings.admin_email ?? '');
  const [adminWhatsapp, setAdminWhatsapp] = useState(settings.admin_whatsapp ?? '');
  const [businessName, setBusinessName] = useState(settings.business_name ?? '');
  const [emailLogoUrl, setEmailLogoUrl] = useState(settings.email_logo_url ?? '');
  const [reminderHours, setReminderHours] = useState(String(settings.reminder_hours_before));
  const [birthdayDay, setBirthdayDay] = useState(String(settings.birthday_send_day));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateNotificationSettings({
        adminEmail,
        adminWhatsapp,
        businessName,
        emailLogoUrl,
        reminderHoursBefore: Number(reminderHours),
        birthdaySendDay: Number(birthdayDay),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Configuración guardada.');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Configuración</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!emailConfigured && (
          <div className='flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
            <AlertTriangle className='h-4 w-4 shrink-0 mt-0.5' />
            <p>
              El envío de correos todavía no está configurado en el servidor (faltan las variables
              de Resend). Todo lo demás funciona: los correos quedarán marcados como{' '}
              <strong>OMITIDO</strong> en el historial hasta que se configure.
            </p>
          </div>
        )}

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='notif-business'>Nombre del centro</Label>
            <Input
              id='notif-business'
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder='Centro Estético Manuj'
            />
            <p className='text-xs text-gray-500'>
              Es lo que reemplaza a <code>{'{{negocio}}'}</code> y firma los correos.
            </p>
          </div>

          <div className='space-y-2 sm:col-span-2'>
            <Label htmlFor='notif-logo'>Logo de los correos</Label>
            <div className='flex items-center gap-3'>
              {emailLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={emailLogoUrl}
                  alt='Vista previa del logo'
                  className='h-12 w-12 shrink-0 rounded-md bg-brand-ink object-contain p-1'
                />
              ) : (
                <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed text-gray-300'>
                  <ImageIcon className='h-5 w-5' />
                </div>
              )}
              <Input
                id='notif-logo'
                value={emailLogoUrl}
                onChange={(e) => setEmailLogoUrl(e.target.value)}
                placeholder='https://.../logo-email.png'
              />
            </div>
            <p className='text-xs text-gray-500'>
              Tiene que ser <strong>PNG o JPG</strong>, no SVG: Gmail y Outlook no
              muestran SVG dentro de un correo. Por eso es un archivo distinto al
              logo del sitio. Si lo dejas vacío, la cabecera muestra el nombre del
              centro en texto.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notif-admin-email'>Correo para los avisos internos</Label>
            <Input
              id='notif-admin-email'
              type='email'
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder='tucorreo@ejemplo.com'
            />
            <p className='text-xs text-gray-500'>
              Acá llegan las nuevas solicitudes de cita. Si lo dejas vacío se usa el correo de
              contacto del sitio.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notif-admin-wa'>WhatsApp para los avisos internos</Label>
            <Input
              id='notif-admin-wa'
              value={adminWhatsapp}
              onChange={(e) => setAdminWhatsapp(e.target.value)}
              placeholder='+573001234567'
            />
            <p className='text-xs text-gray-500'>
              Si lo dejas vacío se usa el WhatsApp del sitio.
            </p>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='notif-reminder'>Antelación del recordatorio (horas)</Label>
              <Input
                id='notif-reminder'
                type='number'
                min={1}
                max={168}
                value={reminderHours}
                onChange={(e) => setReminderHours(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='notif-birthday'>Día de envío de cumpleaños</Label>
              <Input
                id='notif-birthday'
                type='number'
                min={1}
                max={28}
                value={birthdayDay}
                onChange={(e) => setBirthdayDay(e.target.value)}
              />
            </div>
          </div>
        </div>

        <p className='text-xs text-gray-500'>
          El proceso automático corre una vez al día. La antelación define cuántos días antes se
          avisa (24 horas = el día anterior); el día de envío de cumpleaños es el día del mes en
          que se saluda a todas las clientas que cumplen años ese mes.
        </p>

        <div className='flex justify-end'>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
