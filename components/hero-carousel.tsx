'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnimatedButton from './ui/AnimatedButton';

type Slide = {
  id: number;
  image: string;
  title: string;
  subtitle?: string;
  description: string;
  cta: string;
};

const slides: Slide[] = [
  {
    id: 1,
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769880/artistico_rqsquf.jpg',
    title: 'Maquillaje Profesional',
    description:
      'Servicio de maquillaje profesional para eventos especiales, bodas, grados, cumpleaños, sesiones fotográficas, etc.',
    cta: 'Reservar Cita',
  },
  {
    id: 2,
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769880/labios_nilxgu.jpg',
    title: 'HIDRALIPS',
    description: 'Regenera, repara y revitaliza tus labios con Hidralips.',
    cta: 'Reservar Cita',
  },
  {
    id: 3,
    image:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754770398/cosme_v48p1n.jpg',
    title: 'Tratamientos faciales',
    description:
      'Cuidan y mejoran la piel del rostro, limpiando, hidratando y rejuveneciendo su apariencia.',
    cta: 'Reservar Cita',
  },
];

// easing bezier (equiv. easeOut)
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function HeroCarousel() {
  const shouldReduce = useReducedMotion();
  const autoplay = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true, stopOnMouseEnter: true }),
  );

  // Desactiva autoplay si el usuario prefiere menos animación
  const plugins = shouldReduce ? [] : [autoplay.current];

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start' },
    plugins,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  interface OnSelectEmbla {
    selectedScrollSnap(): number;
    canScrollPrev(): boolean;
    canScrollNext(): boolean;
  }

  const onSelect = useCallback((embla: OnSelectEmbla) => {
    setSelectedIndex(embla.selectedScrollSnap());
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect(emblaApi);
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  const scrollTo = (i: number) => emblaApi?.scrollTo(i);
  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  return (
    <section
      id='inicio'
      className='relative h-[70vh] md:h-[80vh] overflow-hidden'
    >
      {/* Viewport */}
      <div ref={emblaRef} className='h-full'>
        {/* Container */}
        <div className='flex h-full'>
          {slides.map((slide, i) => (
            <div key={slide.id} className='relative min-w-full h-full'>
              {/* Imagen */}
              <Image
                src={slide.image || '/placeholder.svg'}
                alt={slide.title}
                fill
                priority={i === 0}
                className='object-cover'
                sizes='100vw'
              />
              {/* Overlay */}
              <div className='absolute inset-0 bg-gradient-to-r from-black/50 to-transparent' />

              {/* Texto animado */}
              <div className='absolute inset-0 flex items-center'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full'>
                  <motion.div
                    key={slide.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                    className='max-w-2xl text-white'
                  >
                    <h1 className='text-4xl md:text-6xl font-bold mb-4 leading-tight'>
                      {slide.title}
                    </h1>
                    {slide.subtitle ? (
                      <p className='text-xl md:text-2xl mb-4 text-amber-200'>
                        {slide.subtitle}
                      </p>
                    ) : null}
                    <p className='text-lg mb-8 text-gray-200 leading-relaxed'>
                      {slide.description}
                    </p>
                    <AnimatedButton
                      label='Reservar cita'
                      href='#contacto'
                      phone='+573132146938'
                      message='¡Hola! Me gustaría reservar una cita para un tratamiento.'
                    />
                  </motion.div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flechas */}
      <button
        type='button'
        onClick={scrollPrev}
        disabled={!canPrev && slides.length <= 1}
        aria-label='Anterior'
        className='absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
      >
        <ChevronLeft className='h-6 w-6 text-white' />
      </button>
      <button
        type='button'
        onClick={scrollNext}
        disabled={!canNext && slides.length <= 1}
        aria-label='Siguiente'
        className='absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
      >
        <ChevronRight className='h-6 w-6 text-white' />
      </button>

      {/* Dots */}
      <div className='absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2'>
        {slides.map((_, i) => {
          const active = i === selectedIndex;
          return (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Ir al slide ${i + 1}`}
              className={`w-3 h-3 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                active ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/70'
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
