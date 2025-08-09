'use client';

import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import type { Variants } from 'framer-motion';

// Estilos YARL
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';

// Lightbox sin SSR
const Lightbox = dynamic(() => import('yet-another-react-lightbox'), {
  ssr: false,
});
// Plugins
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';

const galleryImages = [
  {
    id: 1,
    src: '/galeria.jpeg',
    alt: 'Maquillaje natural con piel radiante',
    category: 'Social',
  },
  {
    id: 2,
    src: '/galeria2.jpeg',
    alt: 'Maquillaje dramático para la noche',
    category: 'Social',
  },
  {
    id: 3,
    src: '/galeria3.jpeg',
    alt: 'Maquillaje de novia elegante',
    category: 'Social',
  },
  {
    id: 4,
    src: '/galeria4.jpeg',
    alt: 'Maquillaje artístico colorido',
    category: 'Artístico',
  },
  {
    id: 5,
    src: '/galeria5.jpeg',
    alt: 'Maquillaje profesional para fotografía',
    category: 'Profesional',
  },
  {
    id: 6,
    src: '/galeria6.jpeg',
    alt: 'Maquillaje glamoroso para fiestas',
    category: 'Artístico',
  },
  {
    id: 7,
    src: '/galeria7.jpeg',
    alt: 'Maquillaje vintage estilo retro',
    category: 'Artístico',
  },
  {
    id: 8,
    src: '/galeria8.jpeg',
    alt: 'Maquillaje editorial para moda',
    category: 'Artístico',
  },
  {
    id: 9,
    src: '/galeria10.jpeg',
    alt: 'Maquillaje editorial para moda',
    category: 'Editorial',
  },
  {
    id: 10,
    src: '/galeria11.jpeg',
    alt: 'Maquillaje social para evento',
    category: 'Social',
  },
  {
    id: 11,
    src: '/galeria12.jpeg',
    alt: 'Maquillaje social con brillo',
    category: 'Social',
  },
];

const categories = ['Todos', 'Artístico', 'Social', 'Editorial'] as const;
type Category = (typeof categories)[number];

// Easing tipado
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Variants header
const headerVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

// Variants por card con delay basado en el índice (custom)
const cardItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT, delay: i * 0.08 },
  }),
};

export default function GallerySection() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('Todos');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // InView del bloque completo (para animar el header)
  const sectionRef = useRef<HTMLElement | null>(null);
  const inView = useInView(sectionRef, {
    margin: '0px 0px -15% 0px',
    amount: 0.25,
    once: true,
  });

  const filteredImages = useMemo(
    () =>
      selectedCategory === 'Todos'
        ? galleryImages
        : galleryImages.filter((img) => img.category === selectedCategory),
    [selectedCategory],
  );

  const slides = useMemo(
    () =>
      filteredImages.map((img) => ({
        src: img.src,
        alt: img.alt,
        title: img.category,
        description: img.alt,
      })),
    [filteredImages],
  );

  return (
    <section
      id='galeria'
      ref={sectionRef}
      className='py-20 bg-gradient-to-br from-amber-50 to-white'
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <motion.div
          variants={headerVariants}
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.12, margin: '0px 0px 0px 0px' }} // trigger más permisivo en mobile
          className='text-center mb-16'
        >
          <h2 className='text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent'>
            Galería de Trabajos
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8'>
            Explora nuestra colección de trabajos realizados.
          </p>

          {/* Filtros */}
          <div className='flex flex-wrap justify-center gap-2'>
            {categories.map((c) => {
              const active = selectedCategory === c;
              return (
                <button
                  key={c}
                  onClick={() => {
                    setSelectedCategory(c);
                    setLightboxIndex(null);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-brand-gold to-brand-brown text-white shadow-lg'
                      : 'bg-white text-gray-600 hover:bg-amber-100 hover:text-brand-brown'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Grid */}
        <div
          key={selectedCategory} // reinicia delays al cambiar filtro
          className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
        >
          <AnimatePresence mode='popLayout'>
            {filteredImages.map((image, idx) => (
              <motion.div
                key={image.id}
                // cada card controla su entrada cuando entra en viewport
                variants={cardItem}
                custom={idx} // delay por índice
                initial='hidden'
                whileInView='show'
                viewport={{ once: true, amount: 0.3 }} // anima cuando la card es visible
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className='group relative aspect-square overflow-hidden rounded-2xl cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300'
                onClick={() => {
                  const found = filteredImages.findIndex(
                    (i) => i.id === image.id,
                  );
                  setLightboxIndex(found === -1 ? 0 : found);
                }}
              >
                <Image
                  src={image.src || '/placeholder.svg'}
                  alt={image.alt}
                  fill
                  className='object-cover group-hover:scale-110 transition-transform duration-500'
                  sizes='(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw'
                  priority={image.id === 1}
                />
                <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
                <div className='absolute bottom-4 left-4 right-4 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 opacity-0 group-hover:opacity-100'>
                  <p className='font-semibold text-sm'>{image.category}</p>
                  <p className='text-xs text-gray-200'>{image.alt}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && slides.length > 0 && (
        <Lightbox
          open
          close={() => setLightboxIndex(null)}
          index={Math.min(lightboxIndex, slides.length - 1)}
          slides={slides}
          plugins={[Thumbnails, Zoom, Fullscreen]}
          animation={{ fade: 300, swipe: 300 }}
          carousel={{ finite: false, imageFit: 'contain' }}
          controller={{ closeOnBackdropClick: true }}
          styles={{
            container: { backgroundColor: 'rgba(0,0,0,0.9)' },
            slide: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          }}
          thumbnails={{ position: 'bottom' }}
        />
      )}
    </section>
  );
}
