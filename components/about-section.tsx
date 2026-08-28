'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedButton from './ui/AnimatedButton';

// Easing cubic-bezier (equivalente a easeOut)
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Variants (duraciones aumentadas)
const container: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.2, ease: EASE_OUT }, // antes 0.9
  },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.75 } }, // antes 0.6
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE_OUT }, // antes 0.6
  },
};

interface AboutSectionProps {
  intro: string;
  founderName: string;
  founderBio: string;
  founderRoles: string[];
  founderImageUrl1: string | null;
  founderImageUrl2: string | null;
}

export default function AboutSection({
  intro,
  founderName,
  founderBio,
  founderRoles,
  founderImageUrl1,
  founderImageUrl2,
}: AboutSectionProps) {
  const shouldReduce = useReducedMotion();
  const founderImages = [founderImageUrl1, founderImageUrl2];

  return (
    <section id='nosotros' className='py-20 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.3 }}
          variants={container}
          className='text-center mb-16'
        >
          <motion.h2
            variants={item}
            className='text-4xl md:text-5xl font-bold mb-6 text-brand-ink'
          >
            Sobre Nosotros
          </motion.h2>
          <motion.p
            variants={item}
            className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'
          >
            {intro}
          </motion.p>
        </motion.div>

        <div>
          <motion.h2
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, amount: 0.3 }}
            variants={item}
            className='text-4xl md:text-5xl font-bold mb-6 text-brand-ink text-center'
          >
            Conoce a la fundadora
          </motion.h2>

          <motion.div
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, amount: 0.3 }}
            variants={container}
            className='max-w-3xl mx-auto'
          >
            <Card className='overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-shadow duration-500'>
              {/* Collage de imágenes (1 en mobile / 2 en desktop) */}
              <div className='grid grid-cols-1 md:grid-cols-2 h-80'>
                {founderImages.map((src, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.97, y: 8 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{
                      duration: 0.8, // antes 0.45
                      ease: EASE_OUT,
                      delay: i * 0.15, // antes 0.08
                    }}
                    className={
                      i === 1 ? 'relative hidden md:block' : 'relative'
                    }
                    whileHover={shouldReduce ? {} : { scale: 1.015, y: -3 }}
                  >
                    <Image
                      src={src || '/placeholder.svg'}
                      alt={i === 0 ? founderName : 'Trabajo de maquillaje'}
                      fill
                      className='object-cover'
                      priority={i === 0}
                    />
                    {/* Overlay sutil al hover */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileHover={shouldReduce ? {} : { opacity: 0.08 }}
                      transition={{ duration: 0.25 }}
                      className='absolute inset-0 bg-black'
                    />
                  </motion.div>
                ))}
              </div>

              <CardContent className='p-6 flex flex-col'>
                <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3'>
                  <motion.h4
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: EASE_OUT }} // antes 0.35
                    className='text-2xl font-bold text-gray-800'
                  >
                    {founderName}
                  </motion.h4>

                  {/* Roles con stagger más pausado */}
                  <motion.div
                    initial='hidden'
                    whileInView='show'
                    viewport={{ once: true }}
                    variants={stagger}
                    className='flex flex-wrap gap-2'
                  >
                    {founderRoles.map((r) => (
                      <motion.span
                        key={r}
                        variants={item}
                        className='inline-flex items-center rounded-full bg-brand-sand/20 text-brand-ink border border-brand-sand px-3 py-1 text-xs font-semibold'
                        whileHover={shouldReduce ? {} : { y: -2 }}
                        transition={{ duration: 0.2 }}
                      >
                        {r}
                      </motion.span>
                    ))}
                  </motion.div>
                </div>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.08 }} // antes 0.35
                  className='text-gray-600 leading-relaxed mb-6'
                >
                  {founderBio}
                </motion.p>

                {/* CTAs con microinteracciones más suaves */}
                <div className='mt-auto grid grid-cols-1  gap-3'>
                  <AnimatedButton label='Reservar cita' href='/reservar' />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
