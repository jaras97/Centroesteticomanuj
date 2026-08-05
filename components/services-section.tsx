'use client';

import Image from 'next/image';
import { Sparkles, Heart, Camera, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedButton from './ui/AnimatedButton';

const services = [
  {
    id: 1,
    title: 'Maquillaje social',
    description:
      'Perfecto para eventos, fiestas y ocasiones especiales. Adaptamos el look a tu estilo y personalidad',
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769880/maquillaje_kv4dw8.jpg',
    icon: Heart,
    features: [
      'Maquillaje personalizado',
      'Productos de alta calidad',
      'Maquillaje de alta duración',
    ],
  },
  {
    id: 2,
    title: 'Maquillaje artístico',
    description:
      'Ideal para crear personajes, expresar emociones o destacar en eventos especiales.',
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769848/maquillaje2_ivxmhw.jpg',
    icon: Sparkles,
    features: ['Productos de alta calidad', 'Asesoramiento'],
  },
  {
    id: 3,
    title: 'Tratamientos faciales personalizados',
    description:
      'Se adaptan a las necesidades específicas de cada piel para mejorar su salud y apariencia.',
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1785881648/cosme_v48p1n.jpg',
    icon: Camera,
    features: [
      'Valoración ',
      'Productos de alta calidad',
      'Uso de aparatología',
    ],
  },
  {
    id: 4,
    title: 'Lifting de pestañas',
    description:
      'Tratamiento que eleva y curva las pestañas desde la raíz, creando efecto de mayor longitud y volumen sin rímel.',
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1785888013/lifting_xmoouf.jpg',
    icon: Users,
    features: ['Duración hasta 8 semanas ', 'Productos de alta calidad'],
  },
  {
    id: 5,
    title: 'Laminado de cejas',
    description:
      'Peina, alinea y fija el vello en una misma dirección para cejas más definidas y simétricas.',
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/laminado_i3ainq.jpg',
    icon: Users,
    features: [
      'Duración de 4-6 semanas',
      'Productos de alta calidad ',
      'Depilación y henna',
    ],
  },
  {
    id: 6,
    title: 'Hidralips',
    description:
      'Hidrata y nutre profundamente los labios, mejorando suavidad, volumen y color natural.',
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769880/labios_nilxgu.jpg',
    icon: Users,
    features: [
      'duración de 1 mes ',
      'uso de dr-pen',
      'aplicación de color (opcional)',
    ],
  },
];

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

export default function ServicesSection() {
  const reduce = useReducedMotion();

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
          {services.map((service, idx) => {
            const IconComponent = service.icon;
            return (
              <motion.div
                key={service.id}
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
                  <div className='relative h-48 overflow-hidden'>
                    <Image
                      src={service.image || '/placeholder.svg'}
                      alt={service.title}
                      fill
                      className='object-cover transition-transform duration-500 group-hover:scale-110'
                      priority={service.id === 1}
                    />
                    <div className='absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full p-2'>
                      <IconComponent className='h-5 w-5 text-brand-teal' />
                    </div>
                  </div>

                  <CardContent className='p-6 flex-1 flex flex-col'>
                    <h3 className='text-xl font-bold mb-3 text-gray-800'>
                      {service.title}
                    </h3>
                    <p className='text-gray-600 mb-4 leading-relaxed'>
                      {service.description}
                    </p>

                    <ul className='space-y-2 mb-6'>
                      {service.features.map((feature, index) => (
                        <li
                          key={index}
                          className='flex items-center text-sm text-gray-600'
                        >
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
