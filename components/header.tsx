"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X, Phone, Instagram, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navigation = [
    { name: "Inicio", href: "/" },
    { name: "Servicios", href: "#servicios" },
    { name: "Galería", href: "#galeria" },
    { name: "Nosotros", href: "#nosotros" },
    { name: "Contacto", href: "#contacto" },
  ]

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="text-2xl font-bold bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent"
            >
              Bella Makeup
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-gray-700 hover:text-brand-gold transition-colors duration-200 font-medium"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Contact Info & Social */}
          <div className="hidden lg:flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-600">
              <Phone className="h-4 w-4" />
              <span className="text-sm">+1 (555) 123-4567</span>
            </div>
            <div className="flex space-x-2">
              <Link href="#" className="text-brand-gold hover:text-brand-brown">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-brand-gold hover:text-brand-brown">
                <Facebook className="h-5 w-5" />
              </Link>
            </div>
            <Button className="bg-gradient-to-r from-brand-gold to-brand-brown hover:from-brand-gold-dark hover:to-brand-brown-dark">
              Reservar Cita
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-700 hover:text-brand-gold transition-colors duration-200 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2 text-gray-600 mb-3">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">+1 (555) 123-4567</span>
                </div>
                <Button className="w-full bg-gradient-to-r from-brand-gold to-brand-brown hover:from-brand-gold-dark hover:to-brand-brown-dark">
                  Reservar Cita
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
