import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Playfair_Display } from 'next/font/google';
import './globals.css';
import Script from 'next/script';
import GAListener from './ga-listener';
import { Suspense } from 'react';
import { Toaster } from 'sonner';
import { getSiteSettings } from '@/lib/content/site-settings';
import { buildThemeOverrideCss } from '@/lib/theme/colors';
import { Analytics } from '@vercel/analytics/next';

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

// Serif itálica para titulares "editoriales" (carrusel, secciones nuevas de
// foto+texto, Sobre nosotros) — el registro visual de la referencia que
// pidió el usuario. Reemplaza a Copperplate (quedaba cargada pero sin usar
// en ningún componente; era una caps serif geométrica, un registro
// distinto al serif-itálico fluido buscado). Mismo nombre de variable
// (--font-display) y clase Tailwind (font-display) ya definidos.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// generateMetadata (no `export const metadata` estático) porque el favicon
// ahora sale de site_settings.logo_url — se puede cambiar desde
// /admin/contenido sin deploy, igual que el logo del header/footer.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: 'centro estetico manuj',
    description: 'Maquilladora y cosmetóloga profesional',
    icons: {
      icon: settings.logo_url || undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isProd = process.env.NODE_ENV === 'production';
  // Se lee acá (no solo en app/page.tsx) porque el layout raíz envuelve
  // también /admin y /reservar — los colores de marca aplican en todo el
  // sitio, no solo en la home. Ver docs del plan de rediseño de esta sesión.
  const settings = await getSiteSettings();
  const themeOverrideCss = buildThemeOverrideCss({
    ink: settings.theme_ink,
    sand: settings.theme_sand,
    teal: settings.theme_teal,
  });

  return (
    <html
      lang='en'
      translate='no'
      className={`scroll-smooth ${montserrat.variable} ${playfair.variable}`}
    >
      <head>
        {themeOverrideCss && <style dangerouslySetInnerHTML={{ __html: themeOverrideCss }} />}
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
        <Toaster richColors position='top-center' />
        <Analytics />
      </body>
    </html>
  );
}
