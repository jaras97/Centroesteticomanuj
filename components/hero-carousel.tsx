'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AnimatedButton from './ui/AnimatedButton';
import type { HeroSlide } from '@/lib/supabase/types';

// easing bezier (equiv. easeOut)
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// El texto entra en cascada (título -> subtítulo -> descripción -> botón),
// alternando la dirección de entrada por índice de diapositiva (abajo en
// las pares, desde el costado en las impares) para que no se sienta
// siempre igual. Se re-dispara cada vez que la diapositiva vuelve a estar
// activa (animate='show'/'hidden' atado a isActive, no solo al montar).
const textContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

function textItemVariants(direction: 'up' | 'side'): Variants {
  return {
    hidden: direction === 'up' ? { opacity: 0, y: 32 } : { opacity: 0, x: -32 },
    show: { opacity: 1, y: 0, x: 0, transition: { duration: 0.7, ease: EASE_OUT } },
  };
}

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const shouldReduce = useReducedMotion();
  const autoplay = useRef(
    Autoplay({ delay: 4500, stopOnInteraction: true, stopOnMouseEnter: true }),
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

  if (slides.length === 0) return null;

  return (
    <section
      id='inicio'
      className='relative h-[70vh] md:h-[80vh] overflow-hidden'
    >
      {/* Viewport */}
      <div ref={emblaRef} className='h-full'>
        {/* Container */}
        <div className='flex h-full'>
          {slides.map((slide, i) => {
            const isActive = i === selectedIndex;
            // Ken Burns alternado: pares hacen zoom in, impares zoom out —
            // así dos diapositivas seguidas nunca se sienten idénticas.
            const zoomFrom = i % 2 === 0 ? 1 : 1.08;
            const zoomTo = i % 2 === 0 ? 1.08 : 1;
            const textDirection = i % 2 === 0 ? 'up' : 'side';

            return (
              <div key={slide.id} className='relative min-w-full h-full overflow-hidden'>
                {/* Imagen o video, con zoom continuo mientras está activa */}
                <motion.div
                  className='absolute inset-0'
                  initial={{ scale: zoomFrom }}
                  animate={{ scale: shouldReduce ? zoomFrom : isActive ? zoomTo : zoomFrom }}
                  transition={{ duration: 6, ease: 'linear' }}
                >
                  {slide.media_type === 'video' && slide.video_url ? (
                    <video
                      src={slide.video_url}
                      poster={slide.image_url || undefined}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className='absolute inset-0 w-full h-full object-cover'
                    />
                  ) : (
                    <Image
                      src={slide.image_url || '/placeholder.svg'}
                      alt={slide.title}
                      fill
                      priority={i === 0}
                      className='object-cover'
                      sizes='100vw'
                    />
                  )}
                </motion.div>
                {/* Overlay */}
                <div className='absolute inset-0 bg-gradient-to-r from-black/50 to-transparent' />

                {/* Texto animado */}
                <div className='absolute inset-0 flex items-center'>
                  <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full'>
                    <motion.div
                      initial='hidden'
                      animate={isActive ? 'show' : 'hidden'}
                      variants={textContainer}
                      className='max-w-2xl text-white sm:pl-12 lg:pl-6'
                    >
                      <motion.h1
                        variants={textItemVariants(textDirection)}
                        className='font-display italic font-bold text-4xl md:text-6xl mb-4 leading-tight'
                      >
                        {slide.title}
                      </motion.h1>
                      {slide.subtitle ? (
                        <motion.p
                          variants={textItemVariants(textDirection)}
                          className='text-xl md:text-2xl mb-4 text-brand-sand'
                        >
                          {slide.subtitle}
                        </motion.p>
                      ) : null}
                      <motion.p
                        variants={textItemVariants(textDirection)}
                        className='text-lg mb-8 text-gray-200 leading-relaxed'
                      >
                        {slide.description}
                      </motion.p>
                      <motion.div variants={textItemVariants(textDirection)}>
                        <AnimatedButton
                          label={slide.cta_label}
                          href={slide.cta_href}
                          location='hero'
                        />
                      </motion.div>
                    </motion.div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flechas */}
      <button
        type='button'
        onClick={scrollPrev}
        disabled={!canPrev && slides.length <= 1}
        aria-label='Anterior'
        className='hidden sm:flex absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
      >
        <ChevronLeft className='h-6 w-6 text-white' />
      </button>
      <button
        type='button'
        onClick={scrollNext}
        disabled={!canNext && slides.length <= 1}
        aria-label='Siguiente'
        className='hidden sm:flex absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
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
