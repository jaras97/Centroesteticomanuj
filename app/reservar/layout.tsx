import type { ReactNode } from 'react';
import ReservarHeader from '@/components/reservar/reservar-header';
import Footer from '@/components/footer';
import { getSiteSettings } from '@/lib/content/site-settings';

export default async function ReservarLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <div className='min-h-screen bg-gradient-to-br from-brand-sand/10 to-white flex flex-col'>
      <ReservarHeader logoUrl={settings.logo_url || '/placeholder.svg'} />
      <main className='flex-1'>{children}</main>
      <Footer
        logoUrl={settings.logo_url || '/placeholder.svg'}
        tagline={settings.footer_tagline ?? ''}
        phoneDisplay={settings.phone_display ?? ''}
        whatsappNumber={settings.whatsapp_number ?? ''}
        email={settings.email ?? ''}
        address={settings.address ?? ''}
        instagramUrl={settings.instagram_url ?? '#'}
        facebookUrl={settings.facebook_url ?? '#'}
      />
    </div>
  );
}
