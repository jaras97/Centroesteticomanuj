'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { evaluateAndGrantLoyaltyReward, getAvailableRewards as getAvailableRewardsForClient } from '@/lib/booking/loyalty';
import { bogotaWallTimeToUtc } from '@/lib/booking/timezone';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  return supabase;
}

function revalidateBooking() {
  revalidatePath('/admin');
  revalidatePath('/admin/agenda');
  revalidatePath('/admin/clientes');
}

export async function confirmAppointment(
  id: string,
  durationMinOverride?: number,
  depositReceivedAmount?: number,
) {
  const supabase = await requireUser();

  const { data: appointment } = await supabase
    .from('appointments')
    .select('client_id, service_id, duration_min')
    .eq('id', id)
    .maybeSingle();

  if (!appointment) return { ok: false, error: 'Cita no encontrada.' };

  const { count: completedCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', appointment.client_id)
    .eq('status', 'COMPLETADA');

  const { data: service } = await supabase
    .from('services')
    .select('deposit_amount')
    .eq('id', appointment.service_id)
    .maybeSingle();

  const isNewClient = (completedCount ?? 0) === 0;
  const requiresDeposit = isNewClient && !!service?.deposit_amount;

  const durationMin = durationMinOverride ?? appointment.duration_min;
  const expiresAt = requiresDeposit
    ? new Date(Date.now() + 24 * 60 * 60_000).toISOString()
    : null;

  // Si la cita queda esperando el anticipo obligatorio, el monto todavía no
  // se ha recibido — se registra después vía markDepositReceived.
  const depositToStore =
    !requiresDeposit && depositReceivedAmount && depositReceivedAmount > 0
      ? depositReceivedAmount
      : undefined;

  const { error } = await supabase
    .from('appointments')
    .update({
      status: requiresDeposit ? 'ESPERANDO_ANTICIPO' : 'CONFIRMADA',
      duration_min: durationMin,
      expires_at: expiresAt,
      ...(depositToStore !== undefined && { deposit_received_amount: depositToStore }),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo confirmar la cita.' };

  revalidateBooking();
  return { ok: true };
}

export async function markDepositReceived(id: string, depositReceivedAmount?: number) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'CONFIRMADA',
      expires_at: null,
      ...(depositReceivedAmount &&
        depositReceivedAmount > 0 && { deposit_received_amount: depositReceivedAmount }),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cita.' };

  revalidateBooking();
  return { ok: true };
}

export async function rejectAppointment(id: string, reason?: string) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'CANCELADA', reject_reason: reason || null, expires_at: null })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo rechazar la solicitud.' };

  revalidateBooking();
  return { ok: true };
}

export async function getAvailableRewards(clientId: string) {
  const supabase = await requireUser();
  return getAvailableRewardsForClient(supabase, clientId);
}

export async function completeAppointment(
  id: string,
  input: { chargedAmount: number; paymentMethod?: string; appliedRewardId?: string },
) {
  const supabase = await requireUser();

  const { data: appointment } = await supabase
    .from('appointments')
    .select('client_id')
    .eq('id', id)
    .maybeSingle();

  if (!appointment) return { ok: false, error: 'Cita no encontrada.' };

  if (input.appliedRewardId) {
    const { data: reward } = await supabase
      .from('loyalty_rewards')
      .select('id, client_id, used_at')
      .eq('id', input.appliedRewardId)
      .maybeSingle();

    if (!reward || reward.client_id !== appointment.client_id || reward.used_at) {
      return { ok: false, error: 'Ese cupón ya no está disponible.' };
    }

    const { error: rewardError } = await supabase
      .from('loyalty_rewards')
      .update({ used_at: new Date().toISOString(), used_appointment_id: id })
      .eq('id', input.appliedRewardId);

    if (rewardError) return { ok: false, error: 'No se pudo aplicar el cupón.' };
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'COMPLETADA',
      charged_amount: input.chargedAmount,
      payment_method: input.paymentMethod || null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cita.' };

  const { granted } = await evaluateAndGrantLoyaltyReward(supabase, appointment.client_id, id);

  revalidateBooking();
  revalidatePath('/admin/finanzas');
  revalidatePath(`/admin/clientes/${appointment.client_id}`);
  return { ok: true, loyaltyGranted: granted };
}

export async function markNoShow(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'NO_ASISTIO' })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cita.' };

  revalidateBooking();
  return { ok: true };
}

export async function createBlockedSlot(input: {
  startAt: string;
  endAt: string;
  reason?: string;
}) {
  const supabase = await requireUser();

  const { error } = await supabase.from('blocked_slots').insert({
    start_at: input.startAt,
    end_at: input.endAt,
    reason: input.reason || null,
  });

  if (error) return { ok: false, error: 'No se pudo crear el bloqueo.' };

  revalidateBooking();
  return { ok: true };
}

export async function deleteBlockedSlot(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('blocked_slots').delete().eq('id', id);

  if (error) return { ok: false, error: 'No se pudo eliminar el bloqueo.' };

  revalidateBooking();
  return { ok: true };
}

export async function updateClientNotes(clientId: string, notes: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from('clients')
    .update({ notes })
    .eq('id', clientId);

  if (error) return { ok: false, error: 'No se pudieron guardar las notas.' };

  revalidatePath(`/admin/clientes/${clientId}`);
  return { ok: true };
}

export async function createAvailabilityWindow(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}) {
  const supabase = await requireUser();

  if (input.endTime <= input.startTime) {
    return { ok: false, error: 'La hora final debe ser después de la inicial.' };
  }

  const { error } = await supabase.from('availability').insert({
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
  });

  if (error) return { ok: false, error: 'No se pudo agregar el horario.' };

  revalidatePath('/admin/horarios');
  return { ok: true };
}

export async function deleteAvailabilityWindow(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('availability').delete().eq('id', id);

  if (error) return { ok: false, error: 'No se pudo eliminar el horario.' };

  revalidatePath('/admin/horarios');
  return { ok: true };
}

export async function searchClients(query: string) {
  const supabase = await requireUser();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data } = await supabase
    .from('clients')
    .select('id, name, phone')
    .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
    .limit(10);

  return data ?? [];
}

export async function createManualAppointment(input: {
  clientId?: string;
  newClientName?: string;
  newClientPhone?: string;
  serviceId: string;
  startTimeIso: string;
  note?: string;
  depositReceivedAmount?: number;
}) {
  const supabase = await requireUser();

  let clientId = input.clientId ?? null;

  if (!clientId) {
    const phone = input.newClientPhone?.trim();
    const name = input.newClientName?.trim();
    if (!phone || !name) {
      return { ok: false, error: 'Falta el nombre o teléfono del cliente nuevo.' };
    }

    // Mismo criterio anti-suplantación que el flujo público: si el
    // teléfono ya pertenece a un cliente, se reutiliza sin tocar su nombre.
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from('clients')
        .insert({ name, phone })
        .select('id')
        .single();
      if (createError || !created) {
        return { ok: false, error: 'No se pudo registrar el cliente.' };
      }
      clientId = created.id;
    }
  }

  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();

  const { data: service } = await supabase
    .from('services')
    .select('duration_min, buffer_min')
    .eq('id', input.serviceId)
    .maybeSingle();

  if (!service || !client) {
    return { ok: false, error: 'Servicio o cliente inválido.' };
  }

  const { error: appointmentError } = await supabase.from('appointments').insert({
    client_id: clientId,
    service_id: input.serviceId,
    status: 'CONFIRMADA',
    start_time: input.startTimeIso,
    duration_min: service.duration_min,
    buffer_min: service.buffer_min,
    requested_name: client.name,
    client_note: input.note || null,
    deposit_received_amount:
      input.depositReceivedAmount && input.depositReceivedAmount > 0
        ? input.depositReceivedAmount
        : null,
  });

  if (appointmentError) {
    if (appointmentError.code === '23P01') {
      return { ok: false, error: 'Ese horario ya está ocupado.' };
    }
    return { ok: false, error: 'No se pudo crear la cita.' };
  }

  revalidateBooking();
  return { ok: true };
}

export async function rescheduleAppointment(id: string, newStartTimeIso: string) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('appointments')
    .update({ start_time: newStartTimeIso })
    .eq('id', id);

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, error: 'Ese horario ya está ocupado.' };
    }
    return { ok: false, error: 'No se pudo reagendar la cita.' };
  }

  revalidateBooking();
  return { ok: true };
}

export async function createClientRecord(input: {
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  notes?: string;
}) {
  const supabase = await requireUser();

  if (!input.name.trim() || !input.phone.trim()) {
    return { ok: false, error: 'Nombre y teléfono son obligatorios.' };
  }

  const { error } = await supabase.from('clients').insert({
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    birthday: input.birthday || null,
    notes: input.notes?.trim() || null,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya existe un cliente con ese teléfono.' };
    }
    return { ok: false, error: 'No se pudo registrar el cliente.' };
  }

  revalidatePath('/admin/clientes');
  return { ok: true };
}

export async function updateClient(
  id: string,
  input: {
    name: string;
    phone: string;
    email?: string;
    birthday?: string;
    notes?: string;
  },
) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('clients')
    .update({
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      birthday: input.birthday || null,
      notes: input.notes || null,
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya existe otro cliente con ese teléfono.' };
    }
    return { ok: false, error: 'No se pudieron guardar los datos del cliente.' };
  }

  revalidatePath(`/admin/clientes/${id}`);
  revalidatePath('/admin/clientes');
  return { ok: true };
}

function revalidateServices() {
  revalidatePath('/admin/servicios');
  revalidatePath('/admin/reservar');
  revalidatePath('/reservar');
}

interface ServiceInput {
  name: string;
  description?: string;
  durationMin: number;
  bufferMin: number;
  price?: number | null;
  depositAmount?: number | null;
  categoryId?: string | null;
}

export async function createService(input: ServiceInput) {
  const supabase = await requireUser();

  if (!input.name.trim()) return { ok: false, error: 'El nombre es obligatorio.' };

  const { error } = await supabase.from('services').insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    duration_min: input.durationMin,
    buffer_min: input.bufferMin,
    price: input.price ?? null,
    deposit_amount: input.depositAmount ?? null,
    category_id: input.categoryId ?? null,
  });

  if (error) return { ok: false, error: 'No se pudo crear el servicio.' };

  revalidateServices();
  return { ok: true };
}

export async function updateService(id: string, input: ServiceInput) {
  const supabase = await requireUser();

  if (!input.name.trim()) return { ok: false, error: 'El nombre es obligatorio.' };

  const { error } = await supabase
    .from('services')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      duration_min: input.durationMin,
      buffer_min: input.bufferMin,
      price: input.price ?? null,
      deposit_amount: input.depositAmount ?? null,
      category_id: input.categoryId ?? null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar el servicio.' };

  revalidateServices();
  return { ok: true };
}

export async function setServiceActive(id: string, active: boolean) {
  const supabase = await requireUser();

  const { error } = await supabase.from('services').update({ active }).eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar el servicio.' };

  revalidateServices();
  return { ok: true };
}

// ============================================================
// Contenido del sitio público (carrusel, categorías de servicios,
// galería) — ver docs/PRD-cms-contenido-y-promociones.md
// ============================================================

function revalidateContenido() {
  revalidatePath('/admin/contenido');
  revalidatePath('/');
  // El Footer (y con site_settings, también el logo del header de /reservar)
  // se renderiza ahí también — ver app/reservar/layout.tsx.
  revalidatePath('/reservar');
}

const MAX_VIDEO_BYTES = 15 * 1024 * 1024; // 15MB — clips cortos, no video largo

export async function uploadSiteMedia(
  folder: 'hero' | 'services' | 'gallery' | 'promos' | 'site',
  formData: FormData,
) {
  const supabase = await requireUser();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: 'Selecciona un archivo.' };
  }

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    return { ok: false as const, error: 'El archivo debe ser una imagen o un video.' };
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return { ok: false as const, error: 'El video no puede pesar más de 15MB — usa un clip corto.' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('site-media')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false as const, error: 'No se pudo subir el archivo.' };

  const { data } = supabase.storage.from('site-media').getPublicUrl(path);
  return { ok: true as const, url: data.publicUrl };
}

type ReorderableTable =
  | 'hero_slides'
  | 'service_categories'
  | 'gallery_images'
  | 'site_sections';

// Recibe el orden completo (ids) tal como quedó tras arrastrar en el admin
// (ver components/admin/*-table.tsx, framer-motion Reorder) y lo persiste
// de una sola vez — más simple y más barato que ir intercambiando de a
// pares, y es lo que un gesto de drag-and-drop produce naturalmente.
async function reorderRows(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  table: ReorderableTable,
  orderedIds: string[],
) {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from(table).update({ display_order: index }).eq('id', id),
    ),
  );

  if (results.some((r) => r.error)) return { ok: false, error: 'No se pudo reordenar.' };
  return { ok: true };
}

interface HeroSlideInput {
  mediaType: 'image' | 'video';
  imageUrl?: string | null;
  /** Obligatorio si mediaType es 'video'; imageUrl queda como poster opcional. */
  videoUrl?: string | null;
  title: string;
  subtitle?: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

function validateHeroSlideInput(input: HeroSlideInput): string | null {
  if (!input.title.trim()) return 'El título es obligatorio.';
  if (input.mediaType === 'video') {
    if (!input.videoUrl) return 'Sube el video.';
  } else if (!input.imageUrl) {
    return 'La imagen es obligatoria.';
  }
  return null;
}

function heroSlideDbFields(input: HeroSlideInput) {
  return {
    media_type: input.mediaType,
    image_url: input.imageUrl || null,
    video_url: input.mediaType === 'video' ? input.videoUrl || null : null,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    description: input.description.trim(),
    cta_label: input.ctaLabel.trim() || 'Reservar cita',
    cta_href: input.ctaHref.trim() || '/reservar',
  };
}

export async function createHeroSlide(input: HeroSlideInput) {
  const supabase = await requireUser();

  const validationError = validateHeroSlideInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { count } = await supabase.from('hero_slides').select('id', { count: 'exact', head: true });

  const { error } = await supabase
    .from('hero_slides')
    .insert({ ...heroSlideDbFields(input), display_order: count ?? 0 });

  if (error) return { ok: false, error: 'No se pudo crear la diapositiva.' };

  revalidateContenido();
  return { ok: true };
}

export async function updateHeroSlide(id: string, input: HeroSlideInput) {
  const supabase = await requireUser();

  const validationError = validateHeroSlideInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { error } = await supabase
    .from('hero_slides')
    .update(heroSlideDbFields(input))
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la diapositiva.' };

  revalidateContenido();
  return { ok: true };
}

export async function setHeroSlideActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('hero_slides').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la diapositiva.' };
  revalidateContenido();
  return { ok: true };
}

export async function deleteHeroSlide(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('hero_slides').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la diapositiva.' };
  revalidateContenido();
  return { ok: true };
}

export async function reorderHeroSlides(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'hero_slides', orderedIds);
  revalidateContenido();
  return result;
}

interface ServiceCategoryInput {
  name: string;
  description: string;
  imageUrl: string;
  features: string[];
}

export async function createServiceCategory(input: ServiceCategoryInput) {
  const supabase = await requireUser();

  if (!input.name.trim()) return { ok: false, error: 'El nombre es obligatorio.' };
  if (!input.imageUrl) return { ok: false, error: 'La imagen es obligatoria.' };

  const { count } = await supabase
    .from('service_categories')
    .select('id', { count: 'exact', head: true });

  const { error } = await supabase.from('service_categories').insert({
    name: input.name.trim(),
    description: input.description.trim(),
    image_url: input.imageUrl,
    features: input.features.filter((f) => f.trim()).map((f) => f.trim()),
    display_order: count ?? 0,
  });

  if (error) return { ok: false, error: 'No se pudo crear la categoría.' };

  revalidateContenido();
  revalidateServices();
  return { ok: true };
}

export async function updateServiceCategory(id: string, input: ServiceCategoryInput) {
  const supabase = await requireUser();

  if (!input.name.trim()) return { ok: false, error: 'El nombre es obligatorio.' };
  if (!input.imageUrl) return { ok: false, error: 'La imagen es obligatoria.' };

  const { error } = await supabase
    .from('service_categories')
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      image_url: input.imageUrl,
      features: input.features.filter((f) => f.trim()).map((f) => f.trim()),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la categoría.' };

  revalidateContenido();
  revalidateServices();
  return { ok: true };
}

export async function setServiceCategoryActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('service_categories').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la categoría.' };
  revalidateContenido();
  return { ok: true };
}

export async function deleteServiceCategory(id: string) {
  const supabase = await requireUser();
  // category_id usa "on delete set null": los servicios que la usaban quedan
  // sin categoría de marketing, pero siguen agendables sin problema.
  const { error } = await supabase.from('service_categories').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la categoría.' };
  revalidateContenido();
  revalidateServices();
  return { ok: true };
}

export async function reorderServiceCategories(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'service_categories', orderedIds);
  revalidateContenido();
  return result;
}

interface GalleryImageInput {
  imageUrl: string;
  altText: string;
  category: string;
}

export async function createGalleryImage(input: GalleryImageInput) {
  const supabase = await requireUser();

  if (!input.imageUrl) return { ok: false, error: 'La imagen es obligatoria.' };
  if (!input.category.trim()) return { ok: false, error: 'La categoría es obligatoria.' };

  const { count } = await supabase.from('gallery_images').select('id', { count: 'exact', head: true });

  const { error } = await supabase.from('gallery_images').insert({
    image_url: input.imageUrl,
    alt_text: input.altText.trim() || input.category.trim(),
    category: input.category.trim(),
    display_order: count ?? 0,
  });

  if (error) return { ok: false, error: 'No se pudo agregar la imagen.' };

  revalidateContenido();
  return { ok: true };
}

export async function updateGalleryImage(id: string, input: GalleryImageInput) {
  const supabase = await requireUser();

  if (!input.imageUrl) return { ok: false, error: 'La imagen es obligatoria.' };
  if (!input.category.trim()) return { ok: false, error: 'La categoría es obligatoria.' };

  const { error } = await supabase
    .from('gallery_images')
    .update({
      image_url: input.imageUrl,
      alt_text: input.altText.trim() || input.category.trim(),
      category: input.category.trim(),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la imagen.' };

  revalidateContenido();
  return { ok: true };
}

export async function setGalleryImageActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('gallery_images').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la imagen.' };
  revalidateContenido();
  return { ok: true };
}

export async function deleteGalleryImage(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('gallery_images').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la imagen.' };
  revalidateContenido();
  return { ok: true };
}

export async function reorderGalleryImages(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'gallery_images', orderedIds);
  revalidateContenido();
  return result;
}

interface PromotionInput {
  title: string;
  body: string;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  requiresBirthday: boolean;
  /** Si es true, la imagen ya trae el texto diseñado — body es opcional. */
  imageOnly: boolean;
  /** Fechas simples 'YYYY-MM-DD' (hora de Bogotá), no ISO — se convierten acá. */
  startsAt?: string | null;
  endsAt?: string | null;
}

function validatePromotionInput(input: PromotionInput): string | null {
  if (!input.title.trim()) return 'El título es obligatorio.';
  if (input.imageOnly) {
    if (!input.imageUrl) return 'Sube la imagen — el texto de la promo va incluido en ella.';
  } else if (!input.body.trim()) {
    return 'El texto es obligatorio.';
  }
  return null;
}

function promotionDbFields(input: PromotionInput) {
  return {
    title: input.title.trim(),
    body: input.body.trim() || null,
    image_url: input.imageUrl || null,
    cta_label: input.ctaLabel?.trim() || null,
    cta_href: input.ctaHref?.trim() || null,
    requires_birthday: input.requiresBirthday,
    image_only: input.imageOnly,
    // starts_at cuenta desde el inicio del día; ends_at hasta el final del
    // día, para que una promo que "termina hoy" siga vigente todo hoy.
    starts_at: input.startsAt ? bogotaWallTimeToUtc(input.startsAt, '00:00').toISOString() : null,
    ends_at: input.endsAt ? bogotaWallTimeToUtc(input.endsAt, '23:59').toISOString() : null,
  };
}

export async function createPromotion(input: PromotionInput) {
  const supabase = await requireUser();

  const validationError = validatePromotionInput(input);
  if (validationError) return { ok: false, error: validationError };

  // active queda en false por defecto (ver 0007): crear una promo no la
  // publica sola, Manu la activa aparte una vez está lista.
  const { error } = await supabase.from('promotions').insert(promotionDbFields(input));

  if (error) return { ok: false, error: 'No se pudo crear la promoción.' };

  revalidateContenido();
  return { ok: true };
}

export async function updatePromotion(id: string, input: PromotionInput) {
  const supabase = await requireUser();

  const validationError = validatePromotionInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { error } = await supabase
    .from('promotions')
    .update(promotionDbFields(input))
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la promoción.' };

  revalidateContenido();
  return { ok: true };
}

export async function setPromotionActive(id: string, active: boolean) {
  const supabase = await requireUser();

  if (active) {
    // Solo una promo activa a la vez (índice único parcial en 0007) — se
    // desactivan las demás primero para no chocar contra esa restricción.
    const { error: deactivateError } = await supabase
      .from('promotions')
      .update({ active: false })
      .neq('id', id)
      .eq('active', true);
    if (deactivateError) return { ok: false, error: 'No se pudo activar la promoción.' };
  }

  const { error } = await supabase.from('promotions').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la promoción.' };

  revalidateContenido();
  return { ok: true };
}

export async function deletePromotion(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la promoción.' };
  revalidateContenido();
  return { ok: true };
}

interface SiteSettingsInput {
  logoUrl?: string | null;
  phoneDisplay?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  footerTagline?: string | null;
  aboutIntro?: string | null;
  founderName?: string | null;
  founderBio?: string | null;
  founderRoles: string[];
  founderImageUrl1?: string | null;
  founderImageUrl2?: string | null;
  missionText?: string | null;
  visionText?: string | null;
}

// site_settings es una tabla singleton (id boolean, siempre `true` — ver
// 0009_site_settings.sql), así que "actualizar" es siempre sobre esa
// única fila. No hay create/delete: la fila la siembra la migración.
export async function updateSiteSettings(input: SiteSettingsInput) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('site_settings')
    .update({
      logo_url: input.logoUrl || null,
      phone_display: input.phoneDisplay?.trim() || null,
      whatsapp_number: input.whatsappNumber?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      instagram_url: input.instagramUrl?.trim() || null,
      facebook_url: input.facebookUrl?.trim() || null,
      footer_tagline: input.footerTagline?.trim() || null,
      about_intro: input.aboutIntro?.trim() || null,
      founder_name: input.founderName?.trim() || null,
      founder_bio: input.founderBio?.trim() || null,
      founder_roles: input.founderRoles.filter((r) => r.trim()).map((r) => r.trim()),
      founder_image_url_1: input.founderImageUrl1 || null,
      founder_image_url_2: input.founderImageUrl2 || null,
      mission_text: input.missionText?.trim() || null,
      vision_text: input.visionText?.trim() || null,
    })
    .eq('id', true);

  if (error) return { ok: false, error: 'No se pudo guardar la configuración.' };

  revalidateContenido();
  return { ok: true };
}

export async function updateThemeColors(input: { ink: string; sand: string; teal: string }) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('site_settings')
    .update({ theme_ink: input.ink, theme_sand: input.sand, theme_teal: input.teal })
    .eq('id', true);

  if (error) return { ok: false, error: 'No se pudo guardar los colores.' };

  revalidateContenido();
  return { ok: true };
}

export async function resetThemeColors() {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('site_settings')
    .update({ theme_ink: null, theme_sand: null, theme_teal: null })
    .eq('id', true);

  if (error) return { ok: false, error: 'No se pudo restaurar los colores.' };

  revalidateContenido();
  return { ok: true };
}

// ============================================================
// site_sections — bloques "foto de fondo + texto" del home. Mismo molde
// exacto que hero_slides (createHeroSlide/updateHeroSlide más arriba).
// ============================================================

interface SiteSectionInput {
  title: string;
  body: string;
  mediaType: 'image' | 'video' | 'color';
  imageUrl?: string | null;
  videoUrl?: string | null;
  bgColor?: string | null;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  ctaLabel?: string | null;
  ctaHref?: string | null;
}

function validateSiteSectionInput(input: SiteSectionInput): string | null {
  if (!input.title.trim()) return 'El título es obligatorio.';
  if (!input.body.trim()) return 'El texto es obligatorio.';
  if (input.mediaType === 'video') {
    if (!input.videoUrl) return 'Sube el video.';
  } else if (input.mediaType === 'color') {
    if (!input.bgColor) return 'Elige un color de fondo.';
  } else if (!input.imageUrl) {
    return 'La imagen es obligatoria.';
  }
  return null;
}

function siteSectionDbFields(input: SiteSectionInput) {
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    media_type: input.mediaType,
    image_url: input.mediaType !== 'color' ? input.imageUrl || null : null,
    video_url: input.mediaType === 'video' ? input.videoUrl || null : null,
    bg_color: input.mediaType === 'color' ? input.bgColor || null : null,
    text_color: input.textColor,
    text_align: input.textAlign,
    cta_label: input.ctaLabel?.trim() || null,
    cta_href: input.ctaHref?.trim() || null,
  };
}

export async function createSiteSection(input: SiteSectionInput) {
  const supabase = await requireUser();

  const validationError = validateSiteSectionInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { count } = await supabase.from('site_sections').select('id', { count: 'exact', head: true });

  // Siempre 'editorial': las filas marcador (servicios/sobre-nosotros/...)
  // solo se crean por la migración de siembra, nunca desde este formulario.
  const { error } = await supabase
    .from('site_sections')
    .insert({ ...siteSectionDbFields(input), kind: 'editorial', display_order: count ?? 0 });

  if (error) return { ok: false, error: 'No se pudo crear la sección.' };

  revalidateContenido();
  return { ok: true };
}

export async function updateSiteSection(id: string, input: SiteSectionInput) {
  const supabase = await requireUser();

  const validationError = validateSiteSectionInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { error } = await supabase
    .from('site_sections')
    .update(siteSectionDbFields(input))
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la sección.' };

  revalidateContenido();
  return { ok: true };
}

export async function setSiteSectionActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('site_sections').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la sección.' };
  revalidateContenido();
  return { ok: true };
}

export async function deleteSiteSection(id: string) {
  const supabase = await requireUser();

  // Las filas marcador (servicios/sobre-nosotros/misión-visión/galería) no
  // se pueden borrar — solo desactivar. Si se borraran, esa sección
  // desaparecería del home sin forma de recuperarla desde el admin.
  const { data: section } = await supabase
    .from('site_sections')
    .select('kind')
    .eq('id', id)
    .maybeSingle();

  if (section && section.kind !== 'editorial') {
    return { ok: false, error: 'Esta sección no se puede eliminar, solo desactivar.' };
  }

  const { error } = await supabase.from('site_sections').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la sección.' };
  revalidateContenido();
  return { ok: true };
}

export async function reorderSiteSections(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'site_sections', orderedIds);
  revalidateContenido();
  return result;
}

interface ExpenseInput {
  expenseDate: string;
  category: string;
  description?: string;
  amount: number;
}

function revalidateFinanzas() {
  revalidatePath('/admin/finanzas');
}

export async function createExpense(input: ExpenseInput) {
  const supabase = await requireUser();

  if (!input.category.trim()) return { ok: false, error: 'La categoría es obligatoria.' };
  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a cero.' };
  }

  const { error } = await supabase.from('expenses').insert({
    expense_date: input.expenseDate,
    category: input.category.trim(),
    description: input.description?.trim() || null,
    amount: input.amount,
  });

  if (error) return { ok: false, error: 'No se pudo registrar el gasto.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const supabase = await requireUser();

  if (!input.category.trim()) return { ok: false, error: 'La categoría es obligatoria.' };
  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a cero.' };
  }

  const { error } = await supabase
    .from('expenses')
    .update({
      expense_date: input.expenseDate,
      category: input.category.trim(),
      description: input.description?.trim() || null,
      amount: input.amount,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar el gasto.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('expenses').delete().eq('id', id);

  if (error) return { ok: false, error: 'No se pudo eliminar el gasto.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/admin', 'layout');
}
