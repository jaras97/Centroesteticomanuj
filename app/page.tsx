import Header from "@/components/header"
import HeroCarousel from "@/components/hero-carousel"
import ServicesSection from "@/components/services-section"
import GallerySection from "@/components/gallery-section"
import AboutSection from "@/components/about-section"
import Footer from "@/components/footer"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-white">
      <Header />
      <main>
        <HeroCarousel />
        <ServicesSection />
        <GallerySection />
        <AboutSection />
      </main>
      <Footer />
    </div>
  )
}
