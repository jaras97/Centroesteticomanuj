import Header from '@/components/header';
import GallerySection from '@/components/gallery-section';
import Footer from '@/components/footer';
import WhatsAppFloatButton from '@/components/whatsapp-float-button';
import { createPublicClient } from '@/lib/supabase/public';
import { getSiteSettings } from '@/lib/content/site-settings';

export const revalidate = 60;

export default async function GaleriaPage() {
  const supabase = createPublicClient();

  const [{ data: galleryImages }, settings] = await Promise.all([
    supabase.from('gallery_images').select('*').order('display_order'),
    getSiteSettings(),
  ]);

  return (
    <div className='min-h-screen bg-gradient-to-br from-brand-sand/10 to-white'>
      <Header
        logoUrl={settings.logo_url || '/placeholder.svg'}
        phoneDisplay={settings.phone_display ?? ''}
        instagramUrl={settings.instagram_url ?? '#'}
        facebookUrl={settings.facebook_url ?? '#'}
      />
      <main>
        <div className='pt-8'>
          <GallerySection images={galleryImages ?? []} />
        </div>
      </main>
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
      <WhatsAppFloatButton whatsappNumber={settings.whatsapp_number ?? ''} />
    </div>
  );
}
