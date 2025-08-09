'use client';

import Image from 'next/image';
import { Sparkles, Heart, Camera, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AnimatedButton from './ui/AnimatedButton';

const services = [
  {
    id: 1,
    title: 'Maquillaje social',
    description:
      'Perfecto para eventos, fiestas y ocasiones especiales. Adaptamos el look a tu estilo y personalidad',
    image: '/maquillaje.jpeg',
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
    image: '/maquillaje2.jpeg',
    icon: Sparkles,
    features: ['Productos de alta calidad', 'Asesoramiento'],
  },
  {
    id: 3,
    title: 'Masajes relajantes',
    description:
      'Alivian el estrés y la tensión muscular, promoviendo bienestar físico y mental.',
    image: '/masaje.jpeg',
    icon: Camera,
    features: [
      'Duración de 60min',
      'Cuerpo completo',
      'Enfoque donde la persona lo requiera',
    ],
  },
  {
    id: 4,
    title: 'Masajes descontracturantes',
    description:
      'Eliminan tensiones profundas y alivian dolores musculares causados por el estrés o esfuerzo físico.',
    image: '/masaje2.jpeg',
    icon: Users,
    features: ['enfoque en espalda', 'duración de 60min '],
  },
  {
    id: 5,
    title: 'Levantamiento en glúteos e iluminación',
    description:
      'El levantamiento de glúteos realza y tonifica la zona, mejorando su forma y firmeza.',
    image: '/Gluteos.jpeg',
    icon: Users,
    features: [
      'Uso de aparatologia',
      'Duración de 90min ',
      'Mascarillas según necesidades ',
    ],
  },
  {
    id: 6,
    title: 'Lifting de pestañas',
    description:
      'Tratamiento que eleva y curva las pestañas desde la raíz, creando efecto de mayor longitud y volumen sin rímel.',
    image: '/lifting.jpeg',
    icon: Users,
    features: ['Duración hasta 8 semanas ', 'Productos de alta calidad'],
  },
  {
    id: 7,
    title: 'Laminado de cejas',
    description:
      'Peina, alinea y fija el vello en una misma dirección para cejas más definidas y simétricas.',
    image: '/laminado.jpeg',
    icon: Users,
    features: [
      'Duración de 4-6 semanas',
      'Productos de alta calidad ',
      'Depilación y henna',
    ],
  },
  {
    id: 8,
    title: 'Hidralips',
    description:
      'Hidrata y nutre profundamente los labios, mejorando suavidad, volumen y color natural.',
    image: '/labios.jpeg',
    icon: Users,
    features: [
      'duración de 1 mes ',
      'uso de dr-pen',
      'aplicación de color (opcional)',
    ],
  },
];

// easing cubic-bezier (equivalente a easeOut)
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Variants
const headerContainer: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 2, ease: EASE_OUT } },
};

const gridStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.2 } },
};

const cardItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
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
          viewport={{ once: true, amount: 0.9 }}
          variants={headerContainer}
          className='text-center mb-16'
        >
          <h2 className='text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent'>
            Nuestros Servicios
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'>
            Ofrecemos una amplia gama de servicios en maquillaje profesional y
            cosmetología, adaptados a tus necesidades y ocasiones especiales.
            Todos nuestros servicios incluyen consulta personalizada y el uso de
            productos de alta calidad.
          </p>
        </motion.div>

        {/* Grid con stagger */}
        <motion.div
          className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.15 }}
          variants={gridStagger}
        >
          {services.map((service) => {
            const IconComponent = service.icon;
            return (
              <motion.div
                key={service.id}
                variants={cardItem}
                whileHover={reduce ? {} : { y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className='h-full'
              >
                <Card className='group hover:shadow-2xl transition-all duration-300 border-0 bg-gradient-to-br from-amber-50 to-white overflow-hidden h-full flex flex-col'>
                  <div className='relative h-48 overflow-hidden'>
                    <Image
                      src={service.image || '/placeholder.svg'}
                      alt={service.title}
                      fill
                      className='object-cover transition-transform duration-500 group-hover:scale-110'
                      priority={service.id === 1}
                    />
                    <div className='absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full p-2'>
                      <IconComponent className='h-5 w-5 text-brand-gold' />
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
                          <div className='w-1.5 h-1.5 bg-brand-gold rounded-full mr-2' />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* CTA al fondo */}
                    <div className='mt-auto'>
                      <AnimatedButton
                        label='Reservar Ahora'
                        href='#contacto'
                        phone='+573132146938'
                        message='¡Hola! Me gustaría reservar una cita para un tratamiento.'
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
