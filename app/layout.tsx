import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import Script from 'next/script';
import GAListener from './ga-listener';
import { Suspense } from 'react';

const montserrat = localFont({
  src: [
    { path: './fonts/Montserrat-Thin.ttf', weight: '100', style: 'normal' },
    {
      path: './fonts/Montserrat-ThinItalic.ttf',
      weight: '100',
      style: 'italic',
    },
    {
      path: './fonts/Montserrat-ExtraLightItalic.ttf',
      weight: '200',
      style: 'italic',
    },
    { path: './fonts/Montserrat-Light.ttf', weight: '300', style: 'normal' },
    {
      path: './fonts/Montserrat-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    { path: './fonts/Montserrat-Italic.ttf', weight: '400', style: 'italic' },
    {
      path: './fonts/Montserrat-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/Montserrat-SemiBoldItalic.ttf',
      weight: '600',
      style: 'italic',
    },
    { path: './fonts/Montserrat-Bold.ttf', weight: '700', style: 'normal' },
    {
      path: './fonts/Montserrat-BoldItalic.ttf',
      weight: '700',
      style: 'italic',
    },
    {
      path: './fonts/Montserrat-ExtraBold.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: './fonts/Montserrat-ExtraBoldItalic.ttf',
      weight: '800',
      style: 'italic',
    },
    { path: './fonts/Montserrat-Black.ttf', weight: '900', style: 'normal' },
    {
      path: './fonts/Montserrat-BlackItalic.ttf',
      weight: '900',
      style: 'italic',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
});

const copperplate = localFont({
  src: [
    { path: './fonts/Copperplate-Light.ttf', weight: '300', style: 'normal' },
    {
      path: './fonts/Copperplate-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    { path: './fonts/Copperplate-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
});

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

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
  const isProd = process.env.NODE_ENV === 'production';
  return (
    <html
      lang='en'
      translate='no'
      className={`scroll-smooth ${montserrat.variable} ${copperplate.variable}`}
    >
      <head>
        {isProd && GA_ID && (
          <>
            {/* Tag de Google (equivale al <script async src=...> que te sugiere Google) */}
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy='afterInteractive'
            />
            {/* Inicialización */}
            <Script id='ga-init' strategy='afterInteractive'>
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                // Importante: desactivamos el page_view automático para manejarlo con el router
                gtag('config', '${GA_ID}', { send_page_view: false });
              `}
            </Script>
          </>
        )}
        <meta name='google' content='notranslate' />
      </head>
      <body className='font-sans'>
        <Suspense fallback={null}>
          <GAListener />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
