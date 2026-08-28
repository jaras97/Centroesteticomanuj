import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente anon sin cookies, para lecturas públicas de contenido de marketing
// (hero_slides, service_categories, gallery_images — RLS "public_read_active").
// A diferencia de lib/supabase/server.ts, no llama a cookies(), así que no
// vuelve dinámica la ruta que lo usa y es compatible con ISR (revalidate).
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
