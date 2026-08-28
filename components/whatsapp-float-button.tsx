'use client';

import { MessageCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export default function WhatsAppFloatButton({ whatsappNumber }: { whatsappNumber: string }) {
  const shouldReduce = useReducedMotion();
  const whatsappLink = buildWhatsAppLink(whatsappNumber, 'Hola, quiero más información.');

  return (
    <motion.a
      href={whatsappLink}
      target='_blank'
      rel='noopener noreferrer'
      aria-label='Escríbenos por WhatsApp'
      className='fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-colors hover:bg-[#1ebe57] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2'
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      whileHover={shouldReduce ? undefined : { scale: 1.08 }}
      whileTap={shouldReduce ? undefined : { scale: 0.95 }}
    >
      <MessageCircle className='h-7 w-7' fill='currentColor' strokeWidth={0} />
    </motion.a>
  );
}
