'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { GalleryImage } from '@/lib/supabase/types';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const headerVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

const cardItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT, delay: i * 0.12 },
  }),
};

const PREVIEW_COUNT = 3;

export default function GalleryPreviewSection({ images }: { images: GalleryImage[] }) {
  if (images.length === 0) return null;
  const preview = images.slice(0, PREVIEW_COUNT);

  return (
    <section id='galeria' className='py-20 bg-brand-ink'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.3 }}
          variants={headerVariants}
          className='text-center mb-14'
        >
          <h2 className='font-display italic text-4xl md:text-5xl font-bold mb-4 text-white'>
            Galería de trabajos
          </h2>
          <p className='text-lg text-gray-300 max-w-2xl mx-auto'>
            Una muestra de lo que hacemos. Explora la colección completa cuando quieras.
          </p>
        </motion.div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {preview.map((image, idx) => (
            <motion.div
              key={image.id}
              variants={cardItem}
              custom={idx}
              initial='hidden'
              whileInView='show'
              viewport={{ once: true, amount: 0.3 }}
              className='relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xl'
            >
              <Image
                src={image.image_url}
                alt={image.alt_text}
                fill
                className='object-cover'
                sizes='(max-width: 640px) 100vw, 33vw'
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className='text-center mt-12'
        >
          <Link
            href='/galeria'
            className='inline-flex items-center gap-2 text-white font-medium border-b border-white/40 pb-1 hover:border-white transition-colors'
          >
            Ver galería completa
            <ArrowRight className='h-4 w-4' />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
