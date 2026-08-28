'use client';

import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedButton from './ui/AnimatedButton';
import type { ServiceCategory } from '@/lib/supabase/types';

// easing cubic-bezier (equivalente a easeOut) — tipado como tupla literal
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Variants
const headerContainer: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

// Cada card controla su entrada con delay por índice (custom)
const cardItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT, delay: i * 0.08 },
  }),
};

export default function ServicesSection({ categories }: { categories: ServiceCategory[] }) {
  const reduce = useReducedMotion();

  if (categories.length === 0) return null;

  return (
    <section id='servicios' className='py-20 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header animado */}
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.35 }}
          variants={headerContainer}
          className='text-center mb-16'
        >
          <h2 className='text-4xl md:text-5xl font-bold mb-6 text-brand-ink'>
            Nuestros Servicios
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'>
            Ofrecemos una amplia gama de servicios en maquillaje profesional y
            cosmetología, adaptados a tus necesidades y ocasiones especiales.
            Todos nuestros servicios incluyen consulta personalizada y el uso de
            productos de alta calidad.
          </p>
        </motion.div>

        {/* Grid — sin orquestación global; cada card se anima al entrar */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
          {categories.map((category, idx) => (
            <motion.div
              key={category.id}
              variants={cardItem}
              custom={idx} // delay incremental por índice
              initial='hidden'
              whileInView='show'
              viewport={{ once: true, amount: 0.3 }}
              whileHover={reduce ? {} : { y: -4 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className='h-full'
            >
              <Card className='group hover:shadow-2xl transition-all duration-300 border-0 bg-gradient-to-br from-brand-sand/10 to-white overflow-hidden h-full flex flex-col'>
                <div className='relative aspect-[4/5] overflow-hidden'>
                  <Image
                    src={category.image_url || '/placeholder.svg'}
                    alt={category.name}
                    fill
                    className='object-cover transition-transform duration-500 group-hover:scale-110'
                    sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
                    priority={idx === 0}
                  />
                  <div className='absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full p-2'>
                    <Sparkles className='h-5 w-5 text-brand-teal' />
                  </div>
                </div>

                <CardContent className='p-6 flex-1 flex flex-col'>
                  <h3 className='text-xl font-bold mb-3 text-gray-800'>{category.name}</h3>
                  <p className='text-gray-600 mb-4 leading-relaxed'>{category.description}</p>

                  <ul className='space-y-2 mb-6'>
                    {category.features.map((feature, index) => (
                      <li key={index} className='flex items-center text-sm text-gray-600'>
                        <div className='w-1.5 h-1.5 bg-brand-teal rounded-full mr-2' />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA al fondo */}
                  <div className='mt-auto'>
                    <AnimatedButton label='Reservar Ahora' href='/reservar' />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
