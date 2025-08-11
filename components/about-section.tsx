'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedButton from './ui/AnimatedButton';

const founder = {
  name: 'Manuela Jaramillo',
  roles: [
    'Fundadora',
    'Maquilladora profesional',
    'Especialista en maquillaje artístico',
    'Terapias y bienestar corporal',
    'Facial',
  ],
  image: [
    'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/fundadora_gkqr4q.jpg',
    'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/fundadora2_quuwz2.jpg',
  ],
  highlights: ['2+ años de experiencia', '100+ clientas atendidas'],
  bio: 'Soy una cosmetóloga y maquilladora apasionada, con experiencia y capacitación en tratamientos faciales y corporales, maquillaje social, de novias, quinceañeras, editorial y artístico. Mi enfoque está en realzar la belleza de cada cliente, brindándoles una experiencia satisfactoria y personalizada.',
};

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

export default function AboutSection() {
  const shouldReduce = useReducedMotion();

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
            className='text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent'
          >
            Sobre Nosotros
          </motion.h2>
          <motion.p
            variants={item}
            className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'
          >
            En nuestro centro estético realzamos la belleza única de cada
            persona a través de técnicas innovadoras de maquillaje y
            cosmetología, fusionando arte, ciencia y cuidado personalizado.
            Brindamos experiencias transformadoras que inspiran confianza,
            elevan la autoestima y promueven el bienestar integral. Nos
            destacamos por la excelencia profesional, el uso de productos de
            alta calidad y la pasión creativa que nos impulsa a ser tu primera
            elección en estética, fomentando una belleza saludable y
            responsable.
          </motion.p>
        </motion.div>

        <div>
          <motion.h2
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, amount: 0.3 }}
            variants={item}
            className='text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent text-center'
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
                {[founder.image[0], founder.image[1]].map((src, i) => (
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
                      alt={i === 0 ? founder.name : 'Trabajo de maquillaje'}
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
                    {founder.name}
                  </motion.h4>

                  {/* Roles con stagger más pausado */}
                  <motion.div
                    initial='hidden'
                    whileInView='show'
                    viewport={{ once: true }}
                    variants={stagger}
                    className='flex flex-wrap gap-2'
                  >
                    {founder.roles.map((r) => (
                      <motion.span
                        key={r}
                        variants={item}
                        className='inline-flex items-center rounded-full bg-amber-50 text-brand-brown border border-amber-200 px-3 py-1 text-xs font-semibold'
                        whileHover={shouldReduce ? {} : { y: -2 }}
                        transition={{ duration: 0.2 }}
                      >
                        {r}
                      </motion.span>
                    ))}
                  </motion.div>
                </div>

                {/* Highlights */}
                <motion.ul
                  initial='hidden'
                  whileInView='show'
                  viewport={{ once: true }}
                  variants={stagger}
                  className='flex flex-wrap gap-4 mb-4 text-sm text-gray-700'
                >
                  {founder.highlights.map((h) => (
                    <motion.li
                      key={h}
                      variants={item}
                      className='flex items-center gap-2'
                    >
                      <span className='w-1.5 h-1.5 rounded-full bg-brand-gold' />
                      {h}
                    </motion.li>
                  ))}
                </motion.ul>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.08 }} // antes 0.35
                  className='text-gray-600 leading-relaxed mb-6'
                >
                  {founder.bio}
                </motion.p>

                {/* CTAs con microinteracciones más suaves */}
                <div className='mt-auto grid grid-cols-1  gap-3'>
                  <AnimatedButton
                    label='Reservar cita'
                    href='#contacto'
                    phone='+573215487690'
                    message='¡Hola! Me gustaría reservar una cita para un tratamiento.'
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
