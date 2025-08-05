import Image from "next/image"
import { Award, Users, Clock, Heart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const stats = [
  {
    icon: Users,
    number: "500+",
    label: "Clientas Satisfechas",
  },
  {
    icon: Award,
    number: "5+",
    label: "Años de Experiencia",
  },
  {
    icon: Clock,
    number: "1000+",
    label: "Horas de Trabajo",
  },
  {
    icon: Heart,
    number: "100%",
    label: "Dedicación",
  },
]

const team = [
  {
    name: "María González",
    role: "Maquilladora Principal & Fundadora",
    image: "/placeholder.svg?height=300&width=300",
    description:
      "Especialista en maquillaje nupcial y social con más de 5 años de experiencia. Certificada en técnicas internacionales de maquillaje.",
  },
  {
    name: "Ana Rodríguez",
    role: "Especialista en Maquillaje Artístico",
    image: "/placeholder.svg?height=300&width=300",
    description:
      "Experta en maquillaje editorial y artístico. Formada en las mejores academias de belleza con enfoque en tendencias vanguardistas.",
  },
]

export default function AboutSection() {
  return (
    <section id="nosotros" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-gold to-brand-brown bg-clip-text text-transparent">
            Sobre Nosotros
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Somos un equipo apasionado de profesionales dedicados a realzar la belleza natural de cada persona. Nuestra
            misión es hacer que te sientas radiante y segura en cada ocasión especial.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon
            return (
              <div key={index} className="text-center">
                <div className="bg-gradient-to-br from-amber-100 to-amber-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <IconComponent className="h-8 w-8 text-brand-gold" />
                </div>
                <div className="text-3xl font-bold text-gray-800 mb-2">{stat.number}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            )
          })}
        </div>

        {/* Mission Statement */}
        <div className="bg-gradient-to-br from-amber-50 to-white rounded-3xl p-8 md:p-12 mb-20">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Nuestra Filosofía</h3>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              Creemos que cada persona tiene una belleza única que merece ser celebrada. Nuestro enfoque personalizado
              nos permite crear looks que no solo realzan tus características naturales, sino que también reflejan tu
              personalidad y estilo individual.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed">
              Utilizamos únicamente productos de alta calidad y técnicas profesionales para garantizar resultados
              duraderos y espectaculares. Tu satisfacción y confianza son nuestra mayor recompensa.
            </p>
          </div>
        </div>

        {/* Team */}
        <div>
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-800">Nuestro Equipo</h3>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {team.map((member, index) => (
              <Card
                key={index}
                className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-shadow duration-300"
              >
                <div className="relative h-64">
                  <Image src={member.image || "/placeholder.svg"} alt={member.name} fill className="object-cover" />
                </div>
                <CardContent className="p-6">
                  <h4 className="text-xl font-bold mb-2 text-gray-800">{member.name}</h4>
                  <p className="text-brand-gold font-semibold mb-4">{member.role}</p>
                  <p className="text-gray-600 leading-relaxed">{member.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
