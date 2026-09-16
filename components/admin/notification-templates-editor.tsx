'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Mail, MessageCircle, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CHANNEL_LABELS,
  EVENT_DESCRIPTIONS,
  EVENT_LABELS,
  EVENT_VARIABLES,
  PREVIEW_VARS,
  RECIPIENT_LABELS,
  renderTemplate,
} from '@/lib/notifications/templates';
import type { NotificationEvent, NotificationTemplate } from '@/lib/notifications/types';
import {
  sendTestNotificationEmail,
  setNotificationTemplateEnabled,
  updateNotificationTemplate,
} from '@/app/admin/(dashboard)/actions';

const EVENT_ORDER: NotificationEvent[] = [
  'booking_requested',
  'appointment_reminder',
  'birthday',
];

export default function NotificationTemplatesEditor({
  templates,
  emailConfigured,
}: {
  templates: NotificationTemplate[];
  emailConfigured: boolean;
}) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? null);
  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const grouped = useMemo(() => {
    return EVENT_ORDER.map((event) => ({
      event,
      items: templates.filter((t) => t.event === event),
    })).filter((group) => group.items.length > 0);
  }, [templates]);

  if (templates.length === 0) {
    return (
      <p className='text-sm text-gray-500'>
        No hay plantillas cargadas. Revisa que la migración 0014 haya corrido completa.
      </p>
    );
  }

  return (
    <div className='grid gap-6 lg:grid-cols-[280px_1fr] items-start'>
      <nav className='space-y-5'>
        {grouped.map((group) => (
          <div key={group.event} className='space-y-2'>
            <div>
              <h3 className='text-sm font-semibold text-brand-ink'>
                {EVENT_LABELS[group.event]}
              </h3>
              <p className='text-xs text-gray-500 mt-0.5'>
                {EVENT_DESCRIPTIONS[group.event]}
              </p>
            </div>
            <div className='space-y-1'>
              {group.items.map((template) => (
                <button
                  key={template.id}
                  type='button'
                  onClick={() => setSelectedId(template.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    template.id === selectedId
                      ? 'bg-brand-teal/10 text-brand-teal font-medium'
                      : 'text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {template.channel === 'email' ? (
                    <Mail className='h-4 w-4 shrink-0' />
                  ) : (
                    <MessageCircle className='h-4 w-4 shrink-0' />
                  )}
                  <span className='flex-1'>
                    {CHANNEL_LABELS[template.channel]} ·{' '}
                    {RECIPIENT_LABELS[template.recipient_kind]}
                  </span>
                  {!template.enabled && (
                    <Badge variant='outline' className='text-[10px]'>
                      Apagada
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {selected && (
        <TemplateForm
          key={selected.id}
          template={selected}
          emailConfigured={emailConfigured}
        />
      )}
    </div>
  );
}

function TemplateForm({
  template,
  emailConfigured,
}: {
  template: NotificationTemplate;
  emailConfigured: boolean;
}) {
  const [subject, setSubject] = useState(template.subject ?? '');
  const [body, setBody] = useState(template.body);
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isEmail = template.channel === 'email';
  const variables = EVENT_VARIABLES[template.event];

  // La vista previa usa exactamente el mismo renderizador que el envío real,
  // con valores de ejemplo — lo que se ve acá es lo que va a llegar.
  const preview = useMemo(
    () =>
      renderTemplate(
        { event: template.event, channel: template.channel, subject, body },
        PREVIEW_VARS,
        { businessName: PREVIEW_VARS.negocio },
      ),
    [template.event, template.channel, subject, body],
  );

  /** Inserta la variable donde está el cursor (o al final si no hay foco). */
  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((current) => current + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateNotificationTemplate(template.id, {
        subject: isEmail ? subject : null,
        body,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Plantilla guardada.');
    });
  }

  function handleToggle() {
    startTransition(async () => {
      const result = await setNotificationTemplateEnabled(template.id, !template.enabled);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(template.enabled ? 'Plantilla apagada.' : 'Plantilla encendida.');
    });
  }

  function handleTest() {
    startTestTransition(async () => {
      const result = await sendTestNotificationEmail(template.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Correo de prueba enviado a ${result.sentTo}.`);
    });
  }

  return (
    <Card>
      <CardHeader className='flex-row items-start justify-between gap-4 space-y-0'>
        <div>
          <CardTitle className='text-lg'>
            {EVENT_LABELS[template.event]} · {CHANNEL_LABELS[template.channel]}
          </CardTitle>
          <p className='text-sm text-gray-500 mt-1'>
            {RECIPIENT_LABELS[template.recipient_kind]}
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={handleToggle} disabled={isPending}>
          {template.enabled ? (
            <>
              <EyeOff className='h-4 w-4' /> Apagar
            </>
          ) : (
            <>
              <Eye className='h-4 w-4' /> Encender
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className='space-y-5'>
        {!template.enabled && (
          <p className='rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-600'>
            Esta plantilla está apagada: no se encola ningún mensaje con ella.
          </p>
        )}

        {isEmail && (
          <div className='space-y-2'>
            <Label htmlFor='template-subject'>Asunto</Label>
            <Input
              id='template-subject'
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder='Asunto del correo'
            />
          </div>
        )}

        <div className='space-y-2'>
          <Label htmlFor='template-body'>Mensaje</Label>
          <Textarea
            id='template-body'
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={isEmail ? 14 : 6}
            className='font-mono text-sm'
          />
          <p className='text-xs text-gray-500'>
            Escribe normal, sin códigos raros: los saltos de línea se respetan y cada párrafo se
            arma solo.
          </p>
        </div>

        <div className='space-y-2'>
          <Label>Variables disponibles</Label>
          <div className='flex flex-wrap gap-2'>
            {variables.map((variable) => (
              <button
                key={variable.key}
                type='button'
                onClick={() => insertVariable(variable.key)}
                title={`Insertar ${variable.label}`}
                className='rounded-full border border-brand-teal/30 bg-brand-teal/5 px-3 py-1 text-xs text-brand-teal transition-colors hover:bg-brand-teal/15'
              >
                {`{{${variable.key}}}`} · {variable.label}
              </button>
            ))}
          </div>
          <p className='text-xs text-gray-500'>
            Haz click en una para insertarla donde tengas el cursor.
          </p>
        </div>

        <div className='space-y-2'>
          <Label>Vista previa</Label>
          {isEmail ? (
            <>
              <p className='text-xs text-gray-500'>
                Asunto: <span className='text-brand-ink'>{preview.subject || '(sin asunto)'}</span>
              </p>
              <iframe
                title='Vista previa del correo'
                srcDoc={preview.body}
                sandbox=''
                className='h-[420px] w-full rounded-md border bg-white'
              />
            </>
          ) : (
            <div className='rounded-md bg-[#ECE5DD] p-4'>
              <p className='max-w-md whitespace-pre-wrap rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-gray-800 shadow-sm'>
                {preview.text || '(mensaje vacío)'}
              </p>
            </div>
          )}
        </div>

        <div className='flex flex-wrap justify-end gap-2'>
          {isEmail && (
            <Button
              variant='outline'
              onClick={handleTest}
              disabled={isTesting || !emailConfigured}
              title={
                emailConfigured
                  ? 'Envía este correo con datos de ejemplo a tu dirección de avisos'
                  : 'Configura Resend en el servidor para poder enviar pruebas'
              }
            >
              {isTesting ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Send className='h-4 w-4' />
              )}
              Enviar correo de prueba
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Guardar plantilla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
