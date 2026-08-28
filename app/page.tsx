import Header from "@/components/header"
import HeroCarousel from "@/components/hero-carousel"
import ServicesSection from "@/components/services-section"
import GallerySection from "@/components/gallery-section"
import AboutSection from "@/components/about-section"
import MissionVisionSection from "@/components/mission-vision-section"
import Footer from "@/components/footer"
import WhatsAppFloatButton from "@/components/whatsapp-float-button"
import PromoModal from "@/components/promo-modal"
import { createPublicClient } from "@/lib/supabase/public"
import { getSiteSettings } from "@/lib/content/site-settings"

// ISR: el contenido se administra desde /admin/contenido y cambia poco.
// Las Server Actions de guardado llaman revalidatePath('/') para reflejo
// instantáneo; esto es la red de seguridad si algo se escapa.
export const revalidate = 60

export default async function HomePage() {
  const supabase = createPublicClient()

  const [
    { data: heroSlides },
    { data: serviceCategories },
    { data: galleryImages },
    { data: promotion },
    settings,
  ] = await Promise.all([
    supabase.from('hero_slides').select('*').order('display_order'),
    supabase.from('service_categories').select('*').order('display_order'),
    supabase.from('gallery_images').select('*').order('display_order'),
    // RLS ya filtra a la promo activa y vigente en su ventana de fechas;
    // el índice único parcial garantiza que hay 0 o 1 fila visible.
    supabase.from('promotions').select('*').limit(1).maybeSingle(),
    getSiteSettings(),
  ])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-sand/10 to-white">
      <Header
        logoUrl={settings.logo_url || '/placeholder.svg'}
        phoneDisplay={settings.phone_display ?? ''}
        instagramUrl={settings.instagram_url ?? '#'}
        facebookUrl={settings.facebook_url ?? '#'}
      />
      <main>
        <HeroCarousel slides={heroSlides ?? []} />
        <ServicesSection categories={serviceCategories ?? []} />
        <GallerySection images={galleryImages ?? []} />
        <AboutSection
          intro={settings.about_intro ?? ''}
          founderName={settings.founder_name ?? ''}
          founderBio={settings.founder_bio ?? ''}
          founderRoles={settings.founder_roles}
          founderImageUrl1={settings.founder_image_url_1}
          founderImageUrl2={settings.founder_image_url_2}
        />
        <MissionVisionSection
          missionText={settings.mission_text ?? ''}
          visionText={settings.vision_text ?? ''}
        />
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
      <PromoModal promotion={promotion ?? null} />
    </div>
  )
}
