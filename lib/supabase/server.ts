import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente con sesión (cookies) para Server Components/Actions del panel admin.
// Sujeto a RLS (rol "authenticated") — es la capa de defensa real, no solo el middleware.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llama desde un Server Component sin poder escribir cookies;
            // el middleware se encarga de refrescar la sesión en ese caso.
          }
        },
      },
    },
  );
}
