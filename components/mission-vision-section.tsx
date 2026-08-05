'use client';

import { Compass, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

const pillars = [
  {
    id: 1,
    title: 'Misión',
    icon: Target,
    text: 'Crear experiencias de belleza y bienestar que permitan a cada persona redescubrir la mejor versión de sí misma, a través de tratamientos estéticos y maquillaje profesional realizados con conocimiento, dedicación y altos estándares de calidad. Nuestro propósito es que cada cliente no solo vea un cambio en el espejo, sino que también se sienta más segura, cuidada y confiada al salir de nuestro espacio.',
  },
  {
    id: 2,
    title: 'Visión',
    icon: Compass,
    text: 'Ser un centro estético reconocido por transformar la belleza en una experiencia de confianza, innovación y bienestar, destacándonos por la calidad humana, la actualización constante y la excelencia en cada servicio. Aspiramos a convertirnos en un referente en la región, donde cada persona encuentre un lugar que inspire cuidado, autoestima y resultados que superen sus expectativas.',
  },
];

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const headerContainer: Variants = {
  hidden: { opacity: 0, y: 16 },
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

export default function MissionVisionSection() {
  return (
    <section id='mision-vision' className='py-20 bg-brand-sand/10'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.35 }}
          variants={headerContainer}
          className='text-center mb-16'
        >
          <h2 className='text-4xl md:text-5xl font-bold mb-6 text-brand-ink'>
            Misión y Visión
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'>
            Lo que nos mueve y hacia dónde vamos.
          </p>
        </motion.div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
          {pillars.map((pillar, idx) => {
            const IconComponent = pillar.icon;
            return (
              <motion.div
                key={pillar.id}
                variants={cardItem}
                custom={idx}
                initial='hidden'
                whileInView='show'
                viewport={{ once: true, amount: 0.3 }}
                className='h-full'
              >
                <Card className='h-full border-0 shadow-lg hover:shadow-2xl transition-shadow duration-300 bg-white'>
                  <CardContent className='p-8'>
                    <div className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-teal/10 mb-5'>
                      <IconComponent className='h-6 w-6 text-brand-teal' />
                    </div>
                    <h3 className='text-2xl font-bold mb-4 text-brand-ink'>
                      {pillar.title}
                    </h3>
                    <p className='text-gray-600 leading-relaxed'>
                      {pillar.text}
                    </p>
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
