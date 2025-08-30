import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

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
    <html lang='en' translate='no' className='scroll-smooth'>
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
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <Suspense fallback={null}>
          <GAListener />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

import Script from 'next/script';
import GAListener from './ga-listener';
import { Suspense } from 'react';
