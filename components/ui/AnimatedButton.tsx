'use client';

import { motion } from 'framer-motion';
import { EASE_OUT } from '@/lib/constants'; // Asegúrate de tener esta constante definida

interface AnimatedButtonProps {
  label: string;
  href?: string; // Puede ser #contacto o un link absoluto
  phone?: string; // Si se pasa, genera un link de WhatsApp
  message?: string; // Mensaje inicial para WhatsApp
}

export default function AnimatedButton({
  label,
  href,
  phone,
  message = '¡Hola! Me gustaría reservar una cita.',
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

  return (
    <motion.a
      href={link}
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
