'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

// Estilos de YARL (lightbox) y plugin de thumbnails
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';

// Carga dinámica para evitar SSR en Next.js
const Lightbox = dynamic(() => import('yet-another-react-lightbox'), {
  ssr: false,
});
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

// Easing cubic-bezier (equivalente a easeOut, lo usamos para las animaciones de entrada)
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Variants sutiles para header + grid
const headerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

const gridStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const cardItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

export default function GallerySection() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('Todos');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Filtrado por categoría
  const filteredImages = useMemo(
    () =>
      selectedCategory === 'Todos'
        ? galleryImages
        : galleryImages.filter((img) => img.category === selectedCategory),
    [selectedCategory],
  );

  // Slides para YARL (incluimos title/description para captions)
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
      className='py-20 bg-gradient-to-br from-amber-50 to-white'
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.3 }}
          variants={headerVariants}
          className='text-center mb-16'
        >
          <h2 className='text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent'>
            Galería de Trabajos
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8'>
            Explora nuestra colección de trabajos realizados. Cada imagen
            representa nuestro compromiso con la excelencia y la belleza
            personalizada.
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
                    // Reinicia el índice del lightbox al cambiar de categoría
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

        {/* Grid con reveal + hover sutil */}
        <motion.div
          className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.15 }}
          variants={gridStagger}
        >
          {filteredImages.map((image) => (
            <motion.div
              key={image.id}
              variants={cardItem}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className='group relative aspect-square overflow-hidden rounded-2xl cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300'
              onClick={() => {
                const idx = filteredImages.findIndex((i) => i.id === image.id);
                setLightboxIndex(idx === -1 ? 0 : idx);
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
        </motion.div>
      </div>

      {/* Lightbox PRO (YARL) */}
      {lightboxIndex !== null && (
        <Lightbox
          open
          close={() => setLightboxIndex(null)}
          index={lightboxIndex}
          slides={slides}
          plugins={[Thumbnails, Zoom, Fullscreen]}
          animation={{ fade: 300, swipe: 300 }}
          carousel={{ finite: false, imageFit: 'contain' }} // 👈 clave
          controller={{ closeOnBackdropClick: true }}
          styles={{
            container: { backgroundColor: 'rgba(0,0,0,0.9)' },
            slide: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }, // 👈 centrado
          }}
          thumbnails={{ position: 'bottom' }} // evita empujes laterales en mobile
        />
      )}
    </section>
  );
}
