"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const slides = [
  {
    id: 1,
    image: "/makeup-artist-client.png",
    title: "Maquillaje Profesional",
    subtitle: "Realza tu belleza natural",
    description: "Servicios de maquillaje profesional para eventos especiales, bodas y sesiones fotográficas.",
    cta: "Reservar Cita",
  },
  {
    id: 2,
    image: "/elegant-bridal-makeup.png",
    title: "Maquillaje de Novia",
    subtitle: "Tu día perfecto merece un look perfecto",
    description: "Especialistas en maquillaje nupcial con técnicas de larga duración para tu día especial.",
    cta: "Ver Paquetes",
  },
  {
    id: 3,
    image: "/makeup-consultation.png",
    title: "Consultoría en Belleza",
    subtitle: "Descubre tu estilo único",
    description: "Asesoramiento personalizado en maquillaje y cuidado de la piel adaptado a ti.",
    cta: "Consultar",
  },
]

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  return (
    <section className="relative h-[70vh] md:h-[80vh] overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="relative h-full">
            <Image
              src={slide.image || "/placeholder.svg"}
              alt={slide.title}
              fill
              className="object-cover"
              priority={index === 0}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />

            <div className="absolute inset-0 flex items-center">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-2xl text-white">
                  <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">{slide.title}</h1>
                  <p className="text-xl md:text-2xl mb-4 text-amber-200">{slide.subtitle}</p>
                  <p className="text-lg mb-8 text-gray-200 leading-relaxed">{slide.description}</p>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-brand-gold to-brand-brown hover:from-brand-gold-dark hover:to-brand-brown-dark text-white px-8 py-3 text-lg"
                  >
                    {slide.cta}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-all duration-200"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-all duration-200"
      >
        <ChevronRight className="h-6 w-6 text-white" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              index === currentSlide ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </section>
  )
}
