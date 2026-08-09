// Constantes de negocio "configurables" (PRD): editables acá, sin UI de
// configuración — un solo profesional no justifica esa complejidad en Fase 1.

/** Horas mínimas de antelación para poder reservar. */
export const LEAD_TIME_HOURS = 12;

/** Semanas máximas a futuro que se pueden reservar. */
export const BOOKING_HORIZON_WEEKS = 4;

/** Horas antes de que una solicitud sin confirmar se libere automáticamente. */
export const REQUEST_EXPIRATION_HOURS = 24;

/** America/Bogota no tiene horario de verano: offset fijo todo el año. */
export const BOGOTA_UTC_OFFSET_MINUTES = 5 * 60;

/** Máximo de solicitudes de reserva por IP en la ventana de rate limit. */
export const RATE_LIMIT_MAX_REQUESTS = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** Citas COMPLETADA necesarias (dentro de la ventana) para ganar un cupón. */
export const LOYALTY_THRESHOLD_APPOINTMENTS = 5;

/** Ventana móvil en la que deben caer esas citas: ~6 meses. */
export const LOYALTY_WINDOW_DAYS = 182;

/** Porcentaje de descuento del cupón otorgado. */
export const LOYALTY_DISCOUNT_PERCENT = 20;
