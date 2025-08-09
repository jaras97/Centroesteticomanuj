'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Phone } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants, Transition } from 'framer-motion';
import AnimatedButton from './ui/AnimatedButton';

// Tupla cubic-bezier (equiv. easeOut) ✅
// ✅ Tupla bezier literal (no "number[]")
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// ✅ Transitions tipados
const PANEL_IN: Transition = { duration: 0.35, ease: EASE_OUT };
const PANEL_OUT: Transition = { duration: 0.25, ease: EASE_OUT };

// ✅ Variants tipados
const mobilePanel: Variants = {
  hidden: { opacity: 0, y: -8, height: 0 },
  show: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: PANEL_IN,
  },
  exit: {
    opacity: 0,
    y: -8,
    height: 0,
    transition: PANEL_OUT,
  },
};

// Opcional: tipar el transition para que TS quede feliz
const HEADER_TRANSITION: Transition = { duration: 0.8, ease: EASE_OUT };
const ITEM_TRANSITION: Transition = { duration: 0.4, ease: EASE_OUT };

const headerVariant: Variants = {
  hidden: { y: -80, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: HEADER_TRANSITION,
  },
};

const navItemVariant: Variants = {
  hidden: { opacity: 0, y: -10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { ...ITEM_TRANSITION, delay: 0.2 + i * 0.1 },
  }),
};

const mobileItem = {
  hidden: { opacity: 0, y: -6 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, delay: 0.05 + i * 0.05 },
  }),
};

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigation = [
    { name: 'Inicio', href: '/#inicio' },
    { name: 'Servicios', href: '#servicios' },
    { name: 'Galería', href: '#galeria' },
    { name: 'Nosotros', href: '#nosotros' },
  ];

  return (
    <motion.header
      className='bg-white/95 backdrop-blur-sm shadow-lg sticky top-0 z-50'
      variants={headerVariant}
      initial='hidden'
      animate='show'
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center py-4'>
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ITEM_TRANSITION, delay: 0.1 }}
            className='flex items-center'
          >
            <Link
              href='/'
              className='text-2xl font-bold bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent'
            >
              <Image
                src='https://res.cloudinary.com/dcuethtco/image/upload/v1754769881/isologo_dhkiyh.svg'
                alt='Logo'
                width={150}
                height={50}
                className='h-10 w-auto'
              />
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className='hidden md:flex space-x-8'>
            {navigation.map((item, i) => (
              <motion.div
                key={item.name}
                variants={navItemVariant}
                custom={i}
                initial='hidden'
                animate='show'
              >
                <Link
                  href={item.href}
                  className='text-gray-700 hover:text-brand-gold transition-colors duration-200 font-medium'
                >
                  {item.name}
                </Link>
              </motion.div>
            ))}
          </nav>

          {/* Contact Info & Social */}
          <motion.div
            className='hidden lg:flex items-center space-x-4'
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ITEM_TRANSITION, delay: 0.5 }}
          >
            <div className='flex items-center space-x-2 text-gray-600'>
              <Phone className='h-4 w-4' />
              <span className='text-sm'>+57 (313) 214-6938</span>
            </div>
            <div className='flex space-x-2'>
              <Link
                href='https://www.instagram.com/centroestetico_manuj?igsh=cmRoaWd3aXljYjE%3D&utm_source=qr'
                target='_blank'
                rel='noopener noreferrer'
                className='text-brand-gold hover:text-brand-brown'
              >
                <DynamicIcon name='instagram' size={24} />
              </Link>
            </div>
            <AnimatedButton
              label='Reservar cita'
              phone='+573132146938'
              message='¡Hola! Me gustaría reservar una cita para un tratamiento.'
            />
          </motion.div>

          {/* Mobile menu button */}
          <div className='md:hidden'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className='h-6 w-6' />
              ) : (
                <Menu className='h-6 w-6' />
              )}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isMenuOpen && (
            <motion.div
              key='mobile-nav'
              className='md:hidden overflow-hidden border-t border-gray-200'
              variants={mobilePanel}
              initial='hidden'
              animate='show'
              exit='exit'
            >
              <nav className='flex flex-col space-y-4 py-4'>
                {navigation.map((item, i) => (
                  <motion.div key={item.name} variants={mobileItem} custom={i}>
                    <Link
                      href={item.href}
                      className='text-gray-700 hover:text-brand-gold transition-colors duration-200 font-medium'
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                ))}
                <div className='pt-4 border-t border-gray-200'>
                  <div className='flex items-center space-x-2 text-gray-600 mb-3'>
                    <Phone className='h-4 w-4' />
                    <span className='text-sm'>+57 (313) 214-6938</span>
                  </div>
                  <motion.div variants={mobileItem} custom={navigation.length}>
                    <AnimatedButton
                      label='Reservar cita'
                      phone='+573132146938'
                      message='¡Hola! Me gustaría reservar una cita para un tratamiento.'
                    />
                  </motion.div>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
