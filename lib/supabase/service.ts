import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente service_role: ignora RLS, sin sesión/cookies. SOLO se usa desde
// Server Actions/módulos server-only (Server Actions públicas de /reservar
// y lib/booking/availability.ts). El import de "server-only" hace fallar el
// build si este archivo termina importado desde un componente 'use client'.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
