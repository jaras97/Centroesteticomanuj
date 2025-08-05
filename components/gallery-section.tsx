"use client"

import { useState } from "react"
import Image from "next/image"
import { X } from "lucide-react"

const galleryImages = [
  {
    id: 1,
    src: "/glowing-natural-makeup.png",
    alt: "Maquillaje natural con piel radiante",
    category: "Natural",
  },
  {
    id: 2,
    src: "/dramatic-smoky-eyes.png",
    alt: "Maquillaje dramático para la noche",
    category: "Nocturno",
  },
  {
    id: 3,
    src: "/elegant-bridal-makeup.png",
    alt: "Maquillaje de novia elegante",
    category: "Novia",
  },
  {
    id: 4,
    src: "/colorful-artistic-makeup.png",
    alt: "Maquillaje artístico colorido",
    category: "Artístico",
  },
  {
    id: 5,
    src: "/placeholder.svg?height=400&width=400",
    alt: "Maquillaje profesional para fotografía",
    category: "Profesional",
  },
  {
    id: 6,
    src: "/placeholder.svg?height=400&width=400",
    alt: "Maquillaje glamoroso para fiestas",
    category: "Social",
  },
  {
    id: 7,
    src: "/placeholder.svg?height=400&width=400",
    alt: "Maquillaje vintage estilo retro",
    category: "Vintage",
  },
  {
    id: 8,
    src: "/placeholder.svg?height=400&width=400",
    alt: "Maquillaje editorial para moda",
    category: "Editorial",
  },
]

const categories = [
  "Todos",
  "Natural",
  "Nocturno",
  "Novia",
  "Artístico",
  "Profesional",
  "Social",
  "Vintage",
  "Editorial",
]

export default function GallerySection() {
  const [selectedCategory, setSelectedCategory] = useState("Todos")
  const [selectedImage, setSelectedImage] = useState<(typeof galleryImages)[0] | null>(null)

  const filteredImages =
    selectedCategory === "Todos" ? galleryImages : galleryImages.filter((img) => img.category === selectedCategory)

  return (
    <section id="galeria" className="py-20 bg-gradient-to-br from-amber-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent">
            Galería de Trabajos
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8">
            Explora nuestra colección de trabajos realizados. Cada imagen representa nuestro compromiso con la
            excelencia y la belleza personalizada.
          </p>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? "bg-gradient-to-r from-brand-gold to-brand-brown text-white shadow-lg"
                    : "bg-white text-gray-600 hover:bg-amber-100 hover:text-brand-brown"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-2xl cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300"
              onClick={() => setSelectedImage(image)}
            >
              <Image
                src={image.src || "/placeholder.svg"}
                alt={image.alt}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-4 left-4 right-4 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 opacity-0 group-hover:opacity-100">
                <p className="font-semibold text-sm">{image.category}</p>
                <p className="text-xs text-gray-200">{image.alt}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-[90vh] w-full">
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-rose-300 transition-colors"
              >
                <X className="h-8 w-8" />
              </button>
              <div className="relative aspect-square w-full max-w-2xl mx-auto">
                <Image
                  src={selectedImage.src || "/placeholder.svg"}
                  alt={selectedImage.alt}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              <div className="text-center mt-4 text-white">
                <h3 className="text-xl font-semibold">{selectedImage.category}</h3>
                <p className="text-gray-300">{selectedImage.alt}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
