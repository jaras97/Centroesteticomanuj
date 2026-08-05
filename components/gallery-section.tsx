'use client';

import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import type { Variants } from 'framer-motion';

// Estilos YARL
// import 'yet-another-react-lightbox/styles.css';
// import 'yet-another-react-lightbox/plugins/thumbnails.css';

// Lightbox sin SSR
const Lightbox = dynamic(() => import('yet-another-react-lightbox'), {
  ssr: false,
});
// Plugins
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';

const galleryImages = [
  {
    id: 1,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/galeria3_vagqj1.jpg',
    alt: 'Maquillaje de novia elegante',
    category: 'Social',
  },
  {
    id: 2,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/galeria4_qiqko7.jpg',
    alt: 'Maquillaje artístico colorido',
    category: 'Artístico',
  },
  {
    id: 3,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/galeria5_aggvgv.jpg',
    alt: 'Maquillaje profesional para fotografía',
    category: 'Profesional',
  },
  {
    id: 4,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/galeria6_vacudn.jpg',
    alt: 'Maquillaje glamoroso para fiestas',
    category: 'Artístico',
  },
  {
    id: 5,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/galeria7_ae0i6p.jpg',
    alt: 'Maquillaje vintage estilo retro',
    category: 'Artístico',
  },
  {
    id: 6,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/galeria8_h64mbo.jpg',
    alt: 'Maquillaje editorial para moda',
    category: 'Artístico',
  },
  {
    id: 7,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/galeria10_e7brvm.jpg',
    alt: 'Maquillaje editorial para moda',
    category: 'Editorial',
  },
  {
    id: 8,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/galeria12_i7kf0i.jpg',
    alt: 'Maquillaje social con brillo',
    category: 'Social',
  },
  {
    id: 9,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1756580828/social1_vndugm.jpg',
    alt: 'Maquillaje social para evento',
    category: 'Social',
  },
  {
    id: 10,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888013/editorial3_gxlk5n.jpg',
    alt: 'Maquillaje social con brillo',
    category: 'Editorial',
  },
  {
    id: 11,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888012/artistico11_t1mtdu.jpg',
    alt: 'Maquillaje Artístico',
    category: 'Artístico',
  },
  {
    id: 12,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888013/artistico10_wryxnq.jpg',
    alt: 'Maquillaje Artístico',
    category: 'Artístico',
  },
  {
    id: 13,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888014/social20_wkfluv.jpg',
    alt: 'Maquillaje social para evento',
    category: 'Social',
  },
  {
    id: 14,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888013/social10_g51u5k.jpg',
    alt: 'Maquillaje social para evento',
    category: 'Social',
  },
  {
    id: 15,
    src: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888046/social11_s8n04p.jpg',
    alt: 'Maquillaje social para evento',
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
      className='py-20 bg-gradient-to-br from-brand-sand/10 to-white'
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
          <h2 className='text-4xl md:text-5xl font-bold mb-6 text-brand-ink'>
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
                      ? 'bg-brand-teal text-white shadow-lg'
                      : 'bg-white text-gray-600 hover:bg-brand-sand/20 hover:text-brand-ink'
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
      {lightboxIndex !== null && slides?.length > 0 && (
        <Lightbox
          open
          close={() => setLightboxIndex(null)}
          index={lightboxIndex}
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
