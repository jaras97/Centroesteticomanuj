import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'centro estetico manuj',
  description: 'Maquilladora y cosmetóloga profesional',
  icons: {
    icon: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769881/isologo_dhkiyh.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' translate='no' className='scroll-smooth'>
      <head>
        <meta name='google' content='notranslate' />
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
