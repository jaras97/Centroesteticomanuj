import Header from "@/components/header"
import HeroCarousel from "@/components/hero-carousel"
import ServicesSection from "@/components/services-section"
import { EditorialSection } from "@/components/site-sections"
import AboutSection from "@/components/about-section"
import MissionVisionSection from "@/components/mission-vision-section"
import GalleryPreviewSection from "@/components/gallery-preview-section"
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
    { data: sections },
    { data: galleryImages },
    { data: promotion },
    settings,
  ] = await Promise.all([
    supabase.from('hero_slides').select('*').order('display_order'),
    supabase.from('service_categories').select('*').order('display_order'),
    // Todos los bloques del home entre el Hero y el Footer viven en una
    // sola lista ordenable — 'editorial' trae su propio contenido, las
    // demás (services/about/mission_vision/gallery) son marcadores que
    // solo definen posición/visibilidad; su contenido sigue viniendo de
    // service_categories/site_settings/gallery_images más abajo.
    supabase.from('site_sections').select('*').order('display_order'),
    supabase.from('gallery_images').select('*').order('display_order'),
    // RLS ya filtra a la promo activa y vigente en su ventana de fechas;
    // el índice único parcial garantiza que hay 0 o 1 fila visible.
    supabase.from('promotions').select('*').limit(1).maybeSingle(),
    getSiteSettings(),
  ])

  const activeSections = (sections ?? []).filter((s) => s.active)

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
        {activeSections.map((section) => {
          switch (section.kind) {
            case 'services':
              return <ServicesSection key={section.id} categories={serviceCategories ?? []} />
            case 'about':
              return (
                <AboutSection
                  key={section.id}
                  intro={settings.about_intro ?? ''}
                  founderName={settings.founder_name ?? ''}
                  founderBio={settings.founder_bio ?? ''}
                  founderRoles={settings.founder_roles}
                  founderImageUrl1={settings.founder_image_url_1}
                  founderImageUrl2={settings.founder_image_url_2}
                />
              )
            case 'mission_vision':
              return (
                <MissionVisionSection
                  key={section.id}
                  missionText={settings.mission_text ?? ''}
                  visionText={settings.vision_text ?? ''}
                />
              )
            case 'gallery':
              return <GalleryPreviewSection key={section.id} images={galleryImages ?? []} />
            case 'editorial':
            default:
              return <EditorialSection key={section.id} section={section} />
          }
        })}
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
