import Header from "@/components/header"
import HeroCarousel from "@/components/hero-carousel"
import ServicesSection from "@/components/services-section"
import GallerySection from "@/components/gallery-section"
import AboutSection from "@/components/about-section"
import MissionVisionSection from "@/components/mission-vision-section"
import Footer from "@/components/footer"
import WhatsAppFloatButton from "@/components/whatsapp-float-button"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-sand/10 to-white">
      <Header />
      <main>
        <HeroCarousel />
        <ServicesSection />
        <GallerySection />
        <AboutSection />
        <MissionVisionSection />
      </main>
      <Footer />
      <WhatsAppFloatButton />
    </div>
  )
}
