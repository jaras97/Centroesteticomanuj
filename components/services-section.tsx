import Image from 'next/image';
import { Sparkles, Heart, Camera, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const services = [
  {
    id: 1,
    title: 'Maquillaje de Novia',
    description:
      'Maquillaje especializado para el día más importante de tu vida. Técnicas de larga duración y pruebas previas incluidas.',
    image: '/pestana.jpeg',
    icon: Heart,
    price: 'Desde $150',
    features: [
      'Prueba previa',
      'Maquillaje de larga duración',
      'Retoques incluidos',
    ],
  },
  {
    id: 2,
    title: 'Maquillaje Social',
    description:
      'Perfecto para eventos, fiestas y ocasiones especiales. Adaptamos el look a tu estilo y personalidad.',
    image: '/pestana2.jpeg',
    icon: Sparkles,
    price: 'Desde $80',
    features: [
      'Consulta de estilo',
      'Maquillaje personalizado',
      'Productos premium',
    ],
  },
  {
    id: 3,
    title: 'Sesiones Fotográficas',
    description:
      'Maquillaje especializado para fotografía y video. Técnicas profesionales que lucen perfectas en cámara.',
    image: '/labios.jpeg',
    icon: Camera,
    price: 'Desde $120',
    features: [
      'Maquillaje HD',
      'Resistente a luces',
      'Retoques durante sesión',
    ],
  },
  {
    id: 4,
    title: 'Maquillaje Grupal',
    description:
      'Servicios para grupos, despedidas de soltera, y eventos corporativos. Descuentos especiales disponibles.',
    image: '/maquillaje.jpeg',
    icon: Users,
    price: 'Consultar',
    features: [
      'Descuentos grupales',
      'Servicio a domicilio',
      'Coordinación de horarios',
    ],
  },
  {
    id: 4,
    title: 'Maquillaje Grupal',
    description:
      'Servicios para grupos, despedidas de soltera, y eventos corporativos. Descuentos especiales disponibles.',
    image: '/maquillaje.jpeg',
    icon: Users,
    price: 'Consultar',
    features: [
      'Descuentos grupales',
      'Servicio a domicilio',
      'Coordinación de horarios',
    ],
  },
];

export default function ServicesSection() {
  return (
    <section id='servicios' className='py-20 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='text-center mb-16'>
          <h2 className='text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent'>
            Nuestros Servicios
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'>
            Ofrecemos una amplia gama de servicios de maquillaje profesional
            adaptados a cada ocasión especial. Cada servicio incluye consulta
            personalizada y productos de alta calidad.
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
          {services.map((service) => {
            const IconComponent = service.icon;
            return (
              <Card
                key={service.id}
                className='group hover:shadow-2xl transition-all duration-300 border-0 bg-gradient-to-br from-amber-50 to-white overflow-hidden'
              >
                <div className='relative h-48 overflow-hidden'>
                  <Image
                    src={service.image || '/placeholder.svg'}
                    alt={service.title}
                    fill
                    className='object-cover group-hover:scale-110 transition-transform duration-300'
                  />
                  <div className='absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full p-2'>
                    <IconComponent className='h-5 w-5 text-brand-gold' />
                  </div>
                  <div className='absolute top-4 right-4 bg-gradient-to-r from-brand-gold to-brand-brown text-white px-3 py-1 rounded-full text-sm font-semibold'>
                    {service.price}
                  </div>
                </div>

                <CardContent className='p-6'>
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

                  <Button className='w-full bg-gradient-to-r from-brand-gold to-brand-brown hover:from-brand-gold-dark hover:to-brand-brown-dark'>
                    Reservar Ahora
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
