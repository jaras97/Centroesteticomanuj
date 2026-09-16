export type AppointmentStatus =
  | 'SOLICITADA'
  | 'ESPERANDO_ANTICIPO'
  | 'CONFIRMADA'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'NO_ASISTIO'
  | 'EXPIRADA';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  buffer_min: number;
  price: number | null;
  deposit_amount: number | null;
  active: boolean;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  /** Si es true, no recibe correos de marketing (el saludo de cumpleaños).
   * Los avisos transaccionales (solicitud, recordatorio) no dependen de esto. */
  marketing_opt_out: boolean;
  created_at: string;
  updated_at: string;
}

export interface Availability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

export interface BlockedSlot {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  service_id: string;
  status: AppointmentStatus;
  start_time: string;
  duration_min: number;
  buffer_min: number;
  end_time: string;
  requested_name: string;
  client_note: string | null;
  reject_reason: string | null;
  expires_at: string | null;
  deposit_received_amount: number | null;
  charged_amount: number | null;
  /** Texto libre histórico (0003). Se sigue escribiendo con el nombre de la
   * cuenta elegida para no romper el historial de citas anterior a 0016. */
  payment_method: string | null;
  /** Cuenta a la que entró el ingreso de esta cita (0016). null = "Sin asignar". */
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Tabla muerta desde la migración 0016. Se conserva intacta (los
 * dos proyectos de Supabase tienen datos reales y la regla es aditiva), pero
 * ya nadie la lee ni le escribe: sus filas se copiaron a `financial_movements`
 * con `kind='GASTO'` y `legacy_expense_id`. Todo gasto nuevo va allá.
 */
export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Finanzas (migración 0016). Ver lib/finance/queries.ts para la agregación.
// ---------------------------------------------------------------------------

/** Dónde vive la plata. */
export type FinancialAccountKind = 'EFECTIVO' | 'DIGITAL' | 'BANCO' | 'OTRO';

export interface FinancialAccount {
  id: string;
  name: string;
  kind: FinancialAccountKind;
  /** Saldo con el que arrancó la cuenta, antes de usar el sistema. */
  opening_balance: number;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** FIJO = se repite mes a mes (arriendo, servicios). VARIABLE = puntual. */
export type ExpenseNature = 'FIJO' | 'VARIABLE';

export interface ExpenseCategory {
  id: string;
  name: string;
  nature: ExpenseNature;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * INGRESO_OTRO y GASTO son operativos: entran a la utilidad (P&L).
 * RETIRO y APORTE NO son operativos: solo mueven la caja. Un retiro no es un
 * gasto — es utilidad ya ganada que cambia de bolsillo.
 */
export type MovementKind = 'INGRESO_OTRO' | 'GASTO' | 'RETIRO' | 'APORTE';

export interface FinancialMovement {
  id: string;
  /** 'YYYY-MM-DD'. Es un `date` simple, no un timestamptz: se compara como string. */
  movement_date: string;
  kind: MovementKind;
  amount: number;
  account_id: string | null;
  /** Solo tiene sentido en kind='GASTO'; las Server Actions lo limpian en el resto. */
  category_id: string | null;
  description: string | null;
  recurring_template_id: string | null;
  /** Id de la fila de `expenses` de la que salió este movimiento en el backfill de 0016. */
  legacy_expense_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  category_id: string | null;
  account_id: string | null;
  amount: number;
  /** 1-28, para que la plantilla exista en todos los meses (febrero incluido). */
  day_of_month: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyReward {
  id: string;
  client_id: string;
  discount_percent: number;
  earned_at: string;
  source_appointment_id: string | null;
  used_at: string | null;
  used_appointment_id: string | null;
  created_at: string;
}

export interface HeroSlide {
  id: string;
  media_type: 'image' | 'video';
  image_url: string | null;
  /** Solo si media_type === 'video'. Usa image_url como poster mientras carga. */
  video_url: string | null;
  title: string;
  subtitle: string | null;
  description: string;
  cta_label: string;
  cta_href: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  image_url: string;
  features: string[];
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GalleryImage {
  id: string;
  image_url: string;
  alt_text: string;
  category: string;
  display_order: number;
  active: boolean;
  created_at: string;
}

export interface SiteSettings {
  id: true;
  logo_url: string | null;
  phone_display: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  footer_tagline: string | null;
  about_intro: string | null;
  founder_name: string | null;
  founder_bio: string | null;
  founder_roles: string[];
  founder_image_url_1: string | null;
  founder_image_url_2: string | null;
  mission_text: string | null;
  vision_text: string | null;
  /** Colores de marca opcionales (hex). null = usar default de globals.css. */
  theme_ink: string | null;
  theme_sand: string | null;
  theme_teal: string | null;
  updated_at: string;
}

/** Filas 'services'/'about'/'mission_vision'/'gallery' son marcadores de
 * posición sin contenido propio — solo existen para reordenar/activar esas
 * secciones fijas junto con las editoriales. Ver docs del plan de esta sesión. */
export type SiteSectionKind = 'editorial' | 'services' | 'about' | 'mission_vision' | 'gallery';

export interface SiteSection {
  id: string;
  kind: SiteSectionKind;
  title: string;
  body: string;
  media_type: 'image' | 'video' | 'color';
  image_url: string | null;
  video_url: string | null;
  bg_color: string | null;
  text_color: string;
  text_align: 'left' | 'center' | 'right';
  cta_label: string | null;
  cta_href: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  requires_birthday: boolean;
  /** Si es true, la imagen ya incluye el texto de la promo — el modal no muestra título/cuerpo. */
  image_only: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}
