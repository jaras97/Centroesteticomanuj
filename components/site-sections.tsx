'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { SiteSection } from '@/lib/supabase/types';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT } },
};

const ALIGN_CLASSES = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const;

const OVERLAY_CLASSES = {
  left: 'bg-gradient-to-r from-black/70 via-black/35 to-transparent',
  center: 'bg-black/45',
  right: 'bg-gradient-to-l from-black/70 via-black/35 to-transparent',
} as const;

export default function SiteSections({ sections }: { sections: SiteSection[] }) {
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <EditorialSection key={section.id} section={section} />
      ))}
    </>
  );
}

function EditorialSection({ section }: { section: SiteSection }) {
  return (
    <section className='relative h-[70vh] md:h-[85vh] overflow-hidden'>
      {section.media_type === 'video' && section.video_url ? (
        <video
          src={section.video_url}
          poster={section.image_url || undefined}
          autoPlay
          muted
          loop
          playsInline
          className='absolute inset-0 w-full h-full object-cover'
        />
      ) : (
        <Image
          src={section.image_url || '/placeholder.svg'}
          alt=''
          fill
          className='object-cover'
          sizes='100vw'
        />
      )}

      <div className={`absolute inset-0 ${OVERLAY_CLASSES[section.text_align]}`} />

      <div className='relative h-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12'>
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, amount: 0.4 }}
          variants={container}
          className={`flex h-full flex-col justify-center max-w-xl gap-5 ${ALIGN_CLASSES[section.text_align]}`}
        >
          <motion.h2
            variants={item}
            className='font-display italic font-bold text-4xl md:text-5xl text-white leading-tight'
          >
            {section.title}
          </motion.h2>
          <motion.p variants={item} className='text-lg text-gray-100/90 leading-relaxed'>
            {section.body}
          </motion.p>
          {section.cta_label && section.cta_href && (
            <motion.div variants={item}>
              <a
                href={section.cta_href}
                className='inline-flex items-center justify-center rounded-md px-6 py-3 font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark transition-colors'
              >
                {section.cta_label}
              </a>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
