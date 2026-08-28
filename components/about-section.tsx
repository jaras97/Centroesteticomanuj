'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import AnimatedButton from './ui/AnimatedButton';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const badgeItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
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

  return (
    <section id='nosotros' className='bg-brand-ink py-20 md:py-28'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.3 }}
          variants={item}
          className='text-center mb-16 max-w-3xl mx-auto'
        >
          <h2 className='font-display italic text-4xl md:text-5xl font-bold mb-6 text-white'>
            Sobre nosotros
          </h2>
          <p className='text-lg text-gray-300 leading-relaxed'>{intro}</p>
        </motion.div>

        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.2 }}
          variants={container}
          className='grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center'
        >
          {/* Fotos: principal grande + secundaria superpuesta */}
          <motion.div variants={item} className='relative aspect-[4/5] max-w-md mx-auto md:mx-0'>
            <div className='relative w-full h-full rounded-2xl overflow-hidden shadow-2xl'>
              <Image
                src={founderImageUrl1 || '/placeholder.svg'}
                alt={founderName}
                fill
                className='object-cover'
                priority
              />
            </div>
            {founderImageUrl2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3, ease: EASE_OUT }}
                whileHover={shouldReduce ? {} : { scale: 1.03 }}
                className='absolute -bottom-8 -right-6 w-2/5 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border-4 border-brand-ink'
              >
                <Image
                  src={founderImageUrl2}
                  alt='Trabajo de maquillaje'
                  fill
                  className='object-cover'
                />
              </motion.div>
            )}
          </motion.div>

          {/* Texto */}
          <div>
            <motion.p variants={item} className='font-display italic text-brand-sand text-lg mb-2'>
              Conoce a la fundadora
            </motion.p>
            <motion.h3 variants={item} className='text-3xl md:text-4xl font-bold text-white mb-4'>
              {founderName}
            </motion.h3>

            <motion.div variants={stagger} className='flex flex-wrap gap-2 mb-6'>
              {founderRoles.map((r) => (
                <motion.span
                  key={r}
                  variants={badgeItem}
                  className='inline-flex items-center rounded-full bg-white/10 text-white border border-white/20 px-3 py-1 text-xs font-semibold'
                >
                  {r}
                </motion.span>
              ))}
            </motion.div>

            <motion.p variants={item} className='text-gray-300 leading-relaxed mb-8'>
              {founderBio}
            </motion.p>

            <motion.div variants={item}>
              <AnimatedButton label='Reservar cita' href='/reservar' />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
