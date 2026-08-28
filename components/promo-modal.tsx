'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitPromoLead } from '@/app/promo-actions';
import { PROMO_DISMISS_COOKIE_DAYS } from '@/lib/promotions/config';
import { cn } from '@/lib/utils';
import type { Promotion } from '@/lib/supabase/types';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

function dismissCookieName(promotionId: string) {
  return `promo_dismissed_${promotionId}`;
}

function hasDismissCookie(promotionId: string) {
  const name = dismissCookieName(promotionId);
  return document.cookie.split('; ').some((c) => c.startsWith(`${name}=`));
}

function setDismissCookie(promotionId: string) {
  const maxAgeSeconds = PROMO_DISMISS_COOKIE_DAYS * 24 * 60 * 60;
  document.cookie = `${dismissCookieName(promotionId)}=1; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

// Cookie de primera parte (no sessionStorage): persiste entre sesiones del
// navegador durante PROMO_DISMISS_COOKIE_DAYS, atada al id de ESTA promo —
// si Manu publica una distinta, la cookie vieja no aplica y vuelve a
// aparecer. Ver docs/PRD-cms-contenido-y-promociones.md, "UX de reaparición".
export default function PromoModal({ promotion }: { promotion: Promotion | null }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!promotion) return;
    if (hasDismissCookie(promotion.id)) return;
    setOpen(true);
  }, [promotion]);

  if (!promotion) return null;

  // Copia local: dentro de closures (handleSubmit -> startTransition),
  // TS no conserva el narrowing de `promotion` hecho arriba.
  const activePromotion = promotion;

  // Con imagen sola y sin CTA ni formulario de cumpleaños no hay nada que
  // mostrar debajo — el pie se omite del todo (no solo se oculta) para que
  // el modal se ajuste exactamente al tamaño de la imagen, sin espacio de
  // sobra. La X ya alcanza para cerrarlo, no hace falta "Entendido".
  const hasCta = !!(activePromotion.cta_label && activePromotion.cta_href);
  const hasFooter = activePromotion.requires_birthday || !activePromotion.image_only || hasCta;

  function close() {
    setDismissCookie(activePromotion.id);
    setOpen(false);
  }

  function handleSubmit() {
    setError(null);
    if (!name.trim() || !phone.trim() || !birthday) {
      setError('Completa tu nombre, teléfono y fecha de nacimiento.');
      return;
    }

    startTransition(async () => {
      const result = await submitPromoLead({ name, phone, birthday, website });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
      setDismissCookie(activePromotion.id);
      setTimeout(() => setOpen(false), 1800);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className='sm:max-w-md overflow-hidden rounded-2xl p-0 gap-0'>
        {promotion.image_url &&
          (promotion.image_only ? (
            // El texto ya está diseñado en la imagen: se muestra completa,
            // sin recortar (object-contain) — un object-cover fijo cortaría
            // texto que esté cerca de los bordes del flyer. Sin pie
            // (hasFooter false) el modal queda del tamaño exacto de la imagen.
            <div className='overflow-hidden bg-gray-100'>
              {/* eslint-disable-next-line @next/next/no-img-element -- dimensión desconocida (sube Manu), no aplica next/image sin fill/width/height fijos */}
              <img
                src={promotion.image_url}
                alt={promotion.title}
                className='w-full max-h-[70vh] object-contain'
              />
            </div>
          ) : (
            <div className='relative h-48 sm:h-56 overflow-hidden'>
              <Image src={promotion.image_url} alt='' fill className='object-cover' />
              <div className='absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent' />
            </div>
          ))}

        <motion.div
          initial='hidden'
          animate='show'
          variants={container}
          className={cn('flex flex-col gap-5', !promotion.image_only && 'p-6 sm:p-8')}
        >
          {/* image_only: el header sale del flujo (sr-only = position:absolute)
              para que no deje un hueco vacío entre la imagen y lo que sigue. */}
          <DialogHeader className={promotion.image_only ? 'sr-only' : undefined}>
            <motion.div variants={item}>
              <DialogTitle className='font-display italic text-3xl leading-tight text-brand-ink'>
                {promotion.title}
              </DialogTitle>
            </motion.div>
          </DialogHeader>

          {submitted ? (
            <motion.p variants={item} className='text-gray-600'>
              ¡Gracias! Ya registramos tus datos.
            </motion.p>
          ) : (
            <>
              {!promotion.image_only && promotion.body && (
                <motion.p
                  variants={item}
                  className='text-base text-gray-600 leading-relaxed whitespace-pre-line'
                >
                  {promotion.body}
                </motion.p>
              )}

              {promotion.requires_birthday && (
                <motion.div variants={item} className='space-y-4'>
                  <div className='space-y-1.5'>
                    <Label htmlFor='promo-lead-name'>Nombre</Label>
                    <Input
                      id='promo-lead-name'
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label htmlFor='promo-lead-phone'>Teléfono</Label>
                    <Input
                      id='promo-lead-phone'
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label htmlFor='promo-lead-birthday'>Fecha de nacimiento</Label>
                    <Input
                      id='promo-lead-birthday'
                      type='date'
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                    />
                  </div>

                  {/* Honeypot — invisible para personas, los bots suelen llenarlo. */}
                  <div className='hidden' aria-hidden='true'>
                    <label htmlFor='promo-lead-website'>No llenar este campo</label>
                    <input
                      id='promo-lead-website'
                      tabIndex={-1}
                      autoComplete='off'
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>

                  {error && <p className='text-sm font-medium text-destructive'>{error}</p>}
                </motion.div>
              )}

              {hasFooter && (
                <motion.div variants={item}>
                  <DialogFooter>
                    {promotion.requires_birthday ? (
                      <Button onClick={handleSubmit} disabled={isPending} className='w-full sm:w-auto'>
                        {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
                        Enviar
                      </Button>
                    ) : hasCta ? (
                      // Con CTA no hace falta un segundo botón "Entendido" — la
                      // X ya cierra el modal, y dos botones lado a lado se
                      // sentían redundantes.
                      <a
                        href={promotion.cta_href!}
                        onClick={close}
                        className='inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-2.5 font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark transition-colors'
                      >
                        {promotion.cta_label}
                      </a>
                    ) : (
                      <Button variant='outline' onClick={close} className='w-full sm:w-auto'>
                        Entendido
                      </Button>
                    )}
                  </DialogFooter>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
