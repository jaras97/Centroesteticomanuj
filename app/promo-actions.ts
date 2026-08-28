'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { promoLeadSchema } from '@/lib/promotions/schemas';
import { isRateLimited } from '@/lib/booking/rate-limit';

export type SubmitPromoLeadResult = { ok: true } | { ok: false; error: string };

// Registra el contacto capturado por el modal de promociones. No crea
// ninguna cita — solo hace upsert en public.clients por teléfono, con las
// mismas reglas de no-sobreescritura que app/reservar/actions.ts: el nombre
// canónico y un cumpleaños ya guardado nunca se pisan desde un formulario
// público. Así un cliente existente que llena el modal no queda duplicado
// ni con datos alterados por otra persona reutilizando su teléfono.
export async function submitPromoLead(input: unknown): Promise<SubmitPromoLeadResult> {
  const parsed = promoLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Revisa los datos del formulario.' };
  }

  const data = parsed.data;

  if (data.website) {
    // Honeypot: bot. Respondemos éxito sin escribir nada.
    return { ok: true };
  }

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (isRateLimited(ip)) {
    return { ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' };
  }

  const supabase = createServiceClient();

  const { data: existingClient, error: lookupError } = await supabase
    .from('clients')
    .select('id, birthday')
    .eq('phone', data.phone)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: 'No pudimos registrar tus datos, intenta de nuevo.' };
  }

  if (existingClient) {
    if (data.birthday && !existingClient.birthday) {
      const { error } = await supabase
        .from('clients')
        .update({ birthday: data.birthday })
        .eq('id', existingClient.id);
      if (error) return { ok: false, error: 'No pudimos registrar tus datos, intenta de nuevo.' };
    }
    return { ok: true };
  }

  const { error: insertError } = await supabase.from('clients').insert({
    name: data.name,
    phone: data.phone,
    birthday: data.birthday || null,
  });

  if (insertError) {
    // 23505: otra solicitud concurrente con el mismo teléfono ya lo creó —
    // no es un error real desde la perspectiva de quien llenó el modal.
    if (insertError.code === '23505') return { ok: true };
    return { ok: false, error: 'No pudimos registrar tus datos, intenta de nuevo.' };
  }

  return { ok: true };
}
