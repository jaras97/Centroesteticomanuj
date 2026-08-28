'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { ServiceCategory } from '@/lib/supabase/types';

// easing cubic-bezier (equivalente a easeOut) — tipado como tupla literal
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const headerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const headerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

// Cada card controla su entrada con delay por índice (custom)
const cardItem: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT, delay: i * 0.1 },
  }),
};

export default function ServicesSection({ categories }: { categories: ServiceCategory[] }) {
  const reduce = useReducedMotion();

  if (categories.length === 0) return null;

  return (
    <section id='servicios' className='py-20 md:py-28 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header animado */}
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.35 }}
          variants={headerContainer}
          className='text-center mb-16 md:mb-20 max-w-3xl mx-auto'
        >
          <motion.p
            variants={headerItem}
            className='text-sm font-semibold tracking-[0.3em] uppercase text-brand-teal mb-4'
          >
            Lo que ofrecemos
          </motion.p>
          <motion.h2
            variants={headerItem}
            className='font-display italic font-bold text-4xl md:text-5xl mb-6 text-brand-ink'
          >
            Nuestros Servicios
          </motion.h2>
          <motion.p variants={headerItem} className='text-lg text-gray-600 leading-relaxed'>
            Ofrecemos una amplia gama de servicios en maquillaje profesional y cosmetología,
            adaptados a tus necesidades y ocasiones especiales. Todos nuestros servicios incluyen
            consulta personalizada y el uso de productos de alta calidad.
          </motion.p>
        </motion.div>

        {/* Grid — sin orquestación global; cada card se anima al entrar */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10'>
          {categories.map((category, idx) => (
            <motion.div
              key={category.id}
              variants={cardItem}
              custom={idx} // delay incremental por índice
              initial='hidden'
              whileInView='show'
              viewport={{ once: true, amount: 0.25 }}
              whileHover={reduce ? {} : { y: -6 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className='group h-full'
            >
              <div className='h-full flex flex-col overflow-hidden rounded-2xl bg-white shadow-md hover:shadow-2xl transition-shadow duration-500'>
                <div className='relative aspect-[4/5] overflow-hidden'>
                  <Image
                    src={category.image_url || '/placeholder.svg'}
                    alt={category.name}
                    fill
                    className='object-cover transition-transform duration-700 ease-out group-hover:scale-105'
                    sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
                    priority={idx === 0}
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/5' />
                  <span className='absolute top-5 left-5 font-display italic text-white/85 text-base tracking-[0.15em]'>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className='flex-1 flex flex-col p-7 md:p-8'>
                  <h3 className='font-display italic text-2xl text-brand-ink mb-3'>
                    {category.name}
                  </h3>
                  <p className='text-gray-600 leading-relaxed mb-5'>{category.description}</p>

                  {category.features.length > 0 && (
                    <>
                      <div className='h-px bg-brand-sand/40 mb-5' />
                      <ul className='space-y-2.5 mb-7'>
                        {category.features.map((feature, index) => (
                          <li key={index} className='flex items-start gap-2.5 text-sm text-gray-600'>
                            <Check className='h-4 w-4 text-brand-teal mt-0.5 shrink-0' />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {/* CTA al fondo */}
                  <div className='mt-auto'>
                    <Link
                      href='/reservar'
                      className='group/link inline-flex items-center gap-2 font-semibold text-brand-ink hover:text-brand-teal transition-colors'
                    >
                      Reservar ahora
                      <ArrowRight className='h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-1' />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
