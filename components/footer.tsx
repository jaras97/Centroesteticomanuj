import Link from 'next/link';
import Image from 'next/image';
import {
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Twitter,
} from 'lucide-react';

export default function Footer() {
  return (
    <footer id='contacto' className='bg-black text-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
          {/* Company Info */}
          <div className='lg:col-span-2'>
            <div className='mb-6'>
              <h3 className='text-2xl font-bold bg-gradient-to-r from-brand-gold to-amber-300 bg-clip-text text-transparent mb-4'>
                <Image
                  src='/isologo.svg'
                  alt='Logo'
                  width={150}
                  height={50}
                  className='h-10 w-auto'
                />
              </h3>
              <p className='text-gray-300 leading-relaxed mb-6'>
                “Más que un servicio, te brindo una experiencia”
              </p>
            </div>

            {/* Contact Info */}
            <div className='space-y-4'>
              <div className='flex items-center space-x-3'>
                <Phone className='h-5 w-5 text-brand-gold' />
                <span>+57 (313) 214-6938</span>
              </div>
              <div className='flex items-center space-x-3'>
                <Mail className='h-5 w-5 text-brand-gold' />
                <span>centroesteticomanuj@gmail.com</span>
              </div>
              <div className='flex items-center space-x-3'>
                <MapPin className='h-5 w-5 text-brand-gold' />
                <span>Chigorodo, Ant</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className='text-lg font-semibold mb-6'>Enlaces Rápidos</h4>
            <ul className='space-y-3'>
              <li>
                <Link
                  href='/'
                  className='text-gray-300 hover:text-brand-gold transition-colors'
                >
                  Inicio
                </Link>
              </li>
              <li>
                <Link
                  href='#servicios'
                  className='text-gray-300 hover:text-brand-gold transition-colors'
                >
                  Servicios
                </Link>
              </li>
              <li>
                <Link
                  href='#galeria'
                  className='text-gray-300 hover:text-brand-gold transition-colors'
                >
                  Galería
                </Link>
              </li>
              <li>
                <Link
                  href='#nosotros'
                  className='text-gray-300 hover:text-brand-gold transition-colors'
                >
                  Nosotros
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Social Media & Copyright */}
        <div className='border-t border-gray-800 mt-12 pt-8'>
          <div className='flex flex-col md:flex-row justify-between items-center'>
            <div className='flex space-x-6 mb-4 md:mb-0'>
              <Link
                href='#'
                className='text-gray-400 hover:text-brand-gold transition-colors'
              >
                <Instagram className='h-6 w-6' />
              </Link>
              <Link
                href='#'
                className='text-gray-400 hover:text-brand-gold transition-colors'
              >
                <Facebook className='h-6 w-6' />
              </Link>
              <Link
                href='#'
                className='text-gray-400 hover:text-brand-gold transition-colors'
              >
                <Twitter className='h-6 w-6' />
              </Link>
            </div>
            <div className='text-gray-400 text-sm'>
              © 2025 Centro Estetico ManuJ. Todos los derechos reservados.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
