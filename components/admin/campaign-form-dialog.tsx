'use client';

/**
 * Armar (o editar) una campaña: el texto, el flyer, los canales y el grupo.
 *
 * Solo se edita un BORRADOR. Una campaña ENVIADA es el registro de lo que las
 * clientas recibieron y no se toca — las Server Actions lo impiden, y acá ni
 * siquiera se ofrece el botón. Lo que sí se puede es DUPLICARLA, que es la
 * forma correcta de "volver a mandar la de la vez pasada".
 */

import { useRef, useState, useTransition, type ReactNode } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Loader2, Mail, MessageCircle, Pencil, Plus, Upload, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import CampaignAudienceField, {
  type CampaignClientOption,
} from '@/components/admin/campaign-audience-field';
import {
  CampaignDeliveryWarnings,
  CampaignReachCard,
  useCampaignReach,
} from '@/components/admin/campaign-reach';
import {
  createCampaign,
  updateCampaign,
  uploadSiteMedia,
} from '@/app/admin/(dashboard)/actions';
import {
  CAMPAIGN_PREVIEW_VARS,
  CHANNEL_LABELS,
  EVENT_VARIABLES,
  renderCampaignMessage,
} from '@/lib/notifications/templates';
import { DEFAULT_CAMPAIGN_AUDIENCE, parseCampaignAudience } from '@/lib/notifications/audience';
import { cn } from '@/lib/utils';
import type {
  Campaign,
  CampaignAudience,
  NotificationChannel,
} from '@/lib/notifications/types';

/**
 * Lo que hace falta para que la vista previa muestre EXACTAMENTE lo que se
 * va a enviar: el mismo nombre, el mismo logo y el mismo contacto de baja que
 * usa `loadNotificationContext` al encolar.
 */
export interface CampaignPreviewContext {
  businessName: string;
  emailLogoUrl: string | null;
  /** Correo público del centro: a dónde escribe una clienta para darse de baja. */
  unsubscribeContact: string;
  publicPhone: string;
}

const CHANNEL_OPTIONS: Array<{
  channel: NotificationChannel;
  icon: typeof Mail;
  help: string;
}> = [
  {
    channel: 'email',
    icon: Mail,
    help: 'Sale solo, con el flyer adentro del correo.',
  },
  {
    channel: 'whatsapp',
    icon: MessageCircle,
    help: 'Queda en la bandeja para que lo mandes con un click.',
  },
];

export default function CampaignFormDialog({
  campaign,
  mode = campaign ? 'edit' : 'create',
  previewContext,
  knownClients = [],
  trigger,
}: {
  campaign?: Campaign;
  /** `duplicate` toma el contenido de una campaña enviada y crea una nueva. */
  mode?: 'create' | 'edit' | 'duplicate';
  previewContext: CampaignPreviewContext;
  knownClients?: CampaignClientOption[];
  trigger?: ReactNode;
}) {
  const isEditing = mode === 'edit' && !!campaign;

  const seed = () => ({
    title:
      mode === 'duplicate' && campaign ? `${campaign.title} (copia)` : campaign?.title ?? '',
    subject: campaign?.subject ?? '',
    body: campaign?.body ?? '',
    flyerUrl: campaign?.flyer_image_url ?? '',
    channels: (campaign?.channels?.length
      ? campaign.channels
      : (['email', 'whatsapp'] as NotificationChannel[])
    ).slice(),
    audience: parseCampaignAudience(campaign?.audience) ?? DEFAULT_CAMPAIGN_AUDIENCE,
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(() => seed().title);
  const [subject, setSubject] = useState(() => seed().subject);
  const [body, setBody] = useState(() => seed().body);
  const [flyerUrl, setFlyerUrl] = useState(() => seed().flyerUrl);
  const [channels, setChannels] = useState<NotificationChannel[]>(() => seed().channels);
  const [audience, setAudience] = useState<CampaignAudience>(() => seed().audience);
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Mismo criterio que `movement-form-dialog`: al abrir se re-siembra desde
  // las props, porque el Server Component las manda frescas después de cada
  // revalidatePath y un diálogo ya montado mostraría las de la primera carga.
  function handleOpenChange(next: boolean) {
    if (next) {
      const values = seed();
      setTitle(values.title);
      setSubject(values.subject);
      setBody(values.body);
      setFlyerUrl(values.flyerUrl);
      setChannels(values.channels);
      setAudience(values.audience);
    }
    setOpen(next);
  }

  const hasEmail = channels.includes('email');
  const reach = useCampaignReach(audience, open);

  function toggleChannel(channel: NotificationChannel) {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel],
    );
  }

  /** Inserta la variable donde está el cursor (igual que el editor de plantillas). */
  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((current) => current + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function handleSubmit() {
    // Las mismas reglas que valida el servidor, dichas antes de ir y volver.
    if (!title.trim()) {
      toast.error('Ponle un nombre a la campaña.');
      return;
    }
    if (!body.trim()) {
      toast.error('El mensaje no puede quedar vacío.');
      return;
    }
    if (channels.length === 0) {
      toast.error('Elige al menos un canal (correo o WhatsApp).');
      return;
    }
    if (hasEmail && !subject.trim()) {
      toast.error('El correo necesita un asunto.');
      return;
    }
    if (!parseCampaignAudience(audience)) {
      toast.error('Termina de armar el grupo de clientas.');
      return;
    }

    const input = {
      title,
      subject: hasEmail ? subject : null,
      body,
      flyerImageUrl: flyerUrl.trim() || null,
      channels,
      audience,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateCampaign(campaign.id, input)
        : await createCampaign(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Campaña guardada.' : 'Campaña creada como borrador.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'} className='h-11 sm:h-9'>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nueva campaña'}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? 'Editar campaña'
              : mode === 'duplicate'
                ? 'Duplicar campaña'
                : 'Nueva campaña'}
          </DialogTitle>
          <DialogDescription>
            Se guarda como borrador. Nada sale hasta que aprietes Enviar.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-5'>
          <div className='space-y-2'>
            <Label htmlFor='campaign-title'>Nombre de la campaña</Label>
            <Input
              id='campaign-title'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Ej. Promo de septiembre'
            />
            <p className='text-xs text-gray-500'>
              Es interno, para reconocerla en la lista. Las clientas no lo ven.
            </p>
          </div>

          <div className='space-y-2'>
            <Label>Canales</Label>
            {/* 2 columnas: son dos opciones cortas y a 360px entran bien. */}
            <div className='grid grid-cols-2 gap-2'>
              {CHANNEL_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = channels.includes(option.channel);
                return (
                  <button
                    key={option.channel}
                    type='button'
                    aria-pressed={isSelected}
                    onClick={() => toggleChannel(option.channel)}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal',
                      isSelected
                        ? 'border-brand-teal bg-brand-teal text-white'
                        : 'border-input text-brand-ink hover:bg-brand-teal/10',
                    )}
                  >
                    <Icon aria-hidden className='h-4 w-4 shrink-0' />
                    <span className='truncate'>{CHANNEL_LABELS[option.channel]}</span>
                  </button>
                );
              })}
            </div>
            <p className='text-xs leading-snug text-gray-500'>
              {channels.length === 0
                ? 'Elige al menos uno.'
                : CHANNEL_OPTIONS.filter((o) => channels.includes(o.channel))
                    .map((o) => `${CHANNEL_LABELS[o.channel]}: ${o.help}`)
                    .join(' ')}
            </p>
          </div>

          {hasEmail && (
            <div className='space-y-2'>
              <Label htmlFor='campaign-subject'>Asunto del correo</Label>
              <Input
                id='campaign-subject'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder='Ej. Tu promo de septiembre te está esperando'
              />
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='campaign-body'>Mensaje</Label>
            <Textarea
              id='campaign-body'
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
            />
            <div className='flex flex-wrap gap-2'>
              {EVENT_VARIABLES.campaign.map((variable) => (
                <button
                  key={variable.key}
                  type='button'
                  onClick={() => insertVariable(variable.key)}
                  title={`Insertar ${variable.label}`}
                  className='rounded-full border border-brand-teal/30 bg-brand-teal/5 px-3 py-1 text-xs text-brand-teal transition-colors hover:bg-brand-teal/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal'
                >
                  {`{{${variable.key}}}`} · {variable.label}
                </button>
              ))}
            </div>
            <p className='text-xs leading-snug text-gray-500'>
              Escribe normal: los saltos de línea se respetan. Toca una variable para insertarla
              donde tengas el cursor. La línea para darse de baja se agrega sola al final, en los
              dos canales — es obligatoria porque una promoción es marketing.
            </p>
          </div>

          <FlyerUpload value={flyerUrl} onChange={setFlyerUrl} />

          <CampaignAudienceField
            audience={audience}
            onChange={setAudience}
            knownClients={knownClients}
          />

          <CampaignReachCard state={reach} channels={channels} />
          <CampaignDeliveryWarnings state={reach} channels={channels} />

          <MessagePreview
            subject={subject}
            body={body}
            flyerUrl={flyerUrl}
            channels={channels}
            previewContext={previewContext}
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            {isEditing ? 'Guardar borrador' : 'Crear borrador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Subida del flyer. NO reusa `image-upload.tsx` a propósito: ese acepta
 * `image/*` y acá el archivo termina dentro de un correo, donde un SVG no se
 * ve (Gmail y Outlook bloquean el SVG dentro de un `<img>` — el mismo motivo
 * por el que el logo de los correos es un campo aparte del logo del sitio).
 *
 * El servidor rechaza el SVG igual, pero la regla se dice ACÁ, antes de
 * elegir el archivo: enterarse después de subir es enterarse tarde.
 */
function FlyerUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      toast.error('Los correos no muestran SVG. Sube el flyer en PNG o JPG.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('El flyer tiene que ser una imagen PNG o JPG.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const result = await uploadSiteMedia('campaigns', formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onChange(result.url);
      toast.success('Flyer subido.');
    });
  }

  return (
    <div className='space-y-2'>
      <Label>Flyer (opcional)</Label>
      <p className='text-xs leading-snug text-gray-500'>
        Solo PNG o JPG. <strong className='font-semibold'>Nada de SVG</strong>: Gmail y Outlook no
        lo muestran y el correo llegaría con un hueco. En el correo va adentro del mensaje; en
        WhatsApp va el link al final y WhatsApp arma la vista previa solo.
      </p>

      {value && (
        <div className='relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-gray-50'>
          <Image src={value} alt='Flyer de la campaña' fill className='object-contain' />
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='absolute right-2 top-2 h-11 bg-white/90 sm:h-9'
            onClick={() => onChange('')}
          >
            <X className='h-3.5 w-3.5' />
            Quitar
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type='file'
        accept='image/png,image/jpeg'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <Button
        type='button'
        size='sm'
        variant='outline'
        className='h-11 sm:h-9'
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? (
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
        ) : (
          <Upload className='h-3.5 w-3.5' />
        )}
        {value ? 'Cambiar flyer' : 'Subir flyer'}
      </Button>
    </div>
  );
}

/**
 * Vista previa por canal, con el MISMO renderizador que usa el envío real
 * (`renderCampaignMessage`) y valores de ejemplo: lo que se ve acá es lo que
 * va a llegar, incluida la línea de baja.
 */
function MessagePreview({
  subject,
  body,
  flyerUrl,
  channels,
  previewContext,
}: {
  subject: string;
  body: string;
  flyerUrl: string;
  channels: NotificationChannel[];
  previewContext: CampaignPreviewContext;
}) {
  const draft = { subject, body, flyer_image_url: flyerUrl.trim() || null };

  // Sin memo a propósito: renderizar es puro texto y el resultado es el mismo
  // string mientras no cambie nada, así que React no vuelve a tocar el iframe.
  const vars = {
    ...CAMPAIGN_PREVIEW_VARS,
    negocio: previewContext.businessName,
    telefono: previewContext.publicPhone || CAMPAIGN_PREVIEW_VARS.telefono,
  };
  const options = {
    businessName: previewContext.businessName,
    logoUrl: previewContext.emailLogoUrl,
    unsubscribeContact: previewContext.unsubscribeContact,
  };

  const emailPreview = channels.includes('email')
    ? renderCampaignMessage(draft, 'email', vars, options)
    : null;
  const whatsappPreview = channels.includes('whatsapp')
    ? renderCampaignMessage(draft, 'whatsapp', vars, options)
    : null;

  if (!emailPreview && !whatsappPreview) return null;

  return (
    <div className='space-y-3'>
      <Label>Vista previa</Label>

      {emailPreview && (
        <div className='space-y-1.5'>
          <p className='text-xs font-medium text-brand-ink'>Correo</p>
          <p className='break-words text-xs text-gray-500'>
            Asunto:{' '}
            <span className='text-brand-ink'>{emailPreview.subject || '(sin asunto)'}</span>
          </p>
          <iframe
            title='Vista previa del correo de la campaña'
            srcDoc={emailPreview.body}
            sandbox=''
            className='h-[420px] w-full rounded-md border bg-white'
          />
        </div>
      )}

      {whatsappPreview && (
        <div className='space-y-1.5'>
          <p className='text-xs font-medium text-brand-ink'>WhatsApp</p>
          <div className='rounded-md bg-[#ECE5DD] p-4'>
            <p className='max-w-md whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-gray-800 shadow-sm'>
              {whatsappPreview.text || '(mensaje vacío)'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
