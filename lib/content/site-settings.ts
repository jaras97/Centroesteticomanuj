import { createPublicClient } from '@/lib/supabase/public';
import type { SiteSettings } from '@/lib/supabase/types';

// Fallback defensivo: solo se usa si site_settings todavía no existe (antes
// de correr 0009_site_settings.sql) — sin esto, el sitio entero se rompe
// (Header/Footer necesitan un logo_url no vacío para <Image>) mientras esa
// migración puntual está pendiente. No es un caso hipotético, es la
// secuencia real de despliegue.
const FALLBACK_SETTINGS: SiteSettings = {
  id: true,
  logo_url: '/placeholder.svg',
  phone_display: '',
  whatsapp_number: '',
  email: '',
  address: '',
  instagram_url: '#',
  facebook_url: '#',
  footer_tagline: '',
  about_intro: '',
  founder_name: '',
  founder_bio: '',
  founder_roles: [],
  founder_image_url_1: null,
  founder_image_url_2: null,
  mission_text: '',
  vision_text: '',
  theme_ink: null,
  theme_sand: null,
  theme_teal: null,
  updated_at: new Date(0).toISOString(),
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = createPublicClient();
  const { data } = await supabase.from('site_settings').select('*').eq('id', true).maybeSingle();
  return data ?? FALLBACK_SETTINGS;
}
