'use client';

import { motion } from 'framer-motion';
import { EASE_OUT } from '@/lib/constants'; // Asegúrate de tener esta constante definida
import { gaEvent } from '@/lib/gtag';

interface AnimatedButtonProps {
  label: string;
  href?: string; // Puede ser #contacto o un link absoluto
  phone?: string; // Si se pasa, genera un link de WhatsApp
  message?: string; // Mensaje inicial para WhatsApp
  /**
   * Desde qué parte del sitio se pulsó (hero, header, header_mobile,
   * sobre_nosotros…). Viaja como parámetro del evento de GA para poder
   * comparar qué sección convierte mejor. Es solo analítica: si no se
   * pasa, el botón funciona igual.
   */
  location?: string;
}

export default function AnimatedButton({
  label,
  href,
  phone,
  message = '¡Hola! Me gustaría reservar una cita.',
  location,
}: AnimatedButtonProps) {
  const shouldReduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Si hay phone, generamos link de WhatsApp
  const link = phone
    ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(
        message,
      )}`
    : href || '#';

  // Este es el único CTA del sitio público, así que centralizar acá el
  // tracking cubre a la vez los dos caminos de conversión: WhatsApp
  // (phone) y el wizard de /reservar (href). gaEvent es no-op si GA no
  // está cargado, así que no hace falta proteger la llamada.
  const handleClick = () => {
    gaEvent(phone ? 'click_whatsapp' : 'click_reservar', {
      location: location ?? 'desconocido',
      label,
      destino: phone ? 'whatsapp' : href,
    });
  };

  return (
    <motion.a
      href={link}
      onClick={handleClick}
      target={phone ? '_blank' : undefined}
      rel={phone ? 'noopener noreferrer' : undefined}
      className='inline-flex items-center justify-center rounded-md px-4 py-2 font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark transition-colors'
      whileHover={shouldReduce ? {} : { y: -1, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      {label}
    </motion.a>
  );
}
