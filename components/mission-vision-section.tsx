'use client';

import { Compass, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const headerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const headerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

const panelItem: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: EASE_OUT, delay: i * 0.15 },
  }),
};

export default function MissionVisionSection({
  missionText,
  visionText,
}: {
  missionText: string;
  visionText: string;
}) {
  const pillars = [
    { id: 1, title: 'Misión', icon: Target, text: missionText },
    { id: 2, title: 'Visión', icon: Compass, text: visionText },
  ];

  return (
    <section id='mision-vision' className='py-20 md:py-28 bg-brand-sand/10'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.35 }}
          variants={headerContainer}
          className='text-center mb-16 md:mb-20 max-w-2xl mx-auto'
        >
          <motion.p
            variants={headerItem}
            className='text-sm font-semibold tracking-[0.3em] uppercase text-brand-teal mb-4'
          >
            Lo que nos mueve
          </motion.p>
          <motion.h2
            variants={headerItem}
            className='font-display italic font-bold text-4xl md:text-5xl text-brand-ink'
          >
            Misión y Visión
          </motion.h2>
        </motion.div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-px bg-brand-sand/30 rounded-2xl overflow-hidden shadow-sm'>
          {pillars.map((pillar, idx) => {
            const IconComponent = pillar.icon;
            return (
              <motion.div
                key={pillar.id}
                variants={panelItem}
                custom={idx}
                initial='hidden'
                whileInView='show'
                viewport={{ once: true, amount: 0.3 }}
                className='relative bg-white p-10 md:p-14 overflow-hidden'
              >
                {/* Numeral grande en filigrana — mismo lenguaje que las
                    cards numeradas de Servicios, sin repetir el ícono en
                    círculo genérico de antes. */}
                <span
                  aria-hidden='true'
                  className='absolute -top-4 right-6 font-display italic font-bold text-8xl md:text-9xl text-brand-sand/25 select-none leading-none'
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <div className='relative'>
                  <div className='inline-flex items-center gap-2.5 mb-4'>
                    <IconComponent className='h-5 w-5 text-brand-teal' />
                    <h3 className='font-display italic text-3xl text-brand-ink'>{pillar.title}</h3>
                  </div>
                  <p className='text-gray-600 leading-relaxed max-w-md'>{pillar.text}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
