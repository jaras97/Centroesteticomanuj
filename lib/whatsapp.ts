// El número de WhatsApp del negocio ya no vive acá — es
// site_settings.whatsapp_number (editable en /admin/contenido → Sitio).
// Este helper sigue siendo la utilidad genérica para construir el link,
// usada tanto para el número del negocio como para el de un cliente
// puntual (ver components/admin/solicitud-card.tsx).
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
