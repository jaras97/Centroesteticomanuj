import { z } from 'zod';

export const bookingRequestSchema = z.object({
  serviceId: z.string().uuid('Servicio inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida'),
  name: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre completo')
    .max(80, 'Nombre muy largo'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Escribe un número de teléfono válido'),
  note: z.string().trim().max(300, 'Nota muy larga').optional().or(z.literal('')),
  // Honeypot: los usuarios reales nunca llenan este campo.
  website: z.string().max(0).optional().or(z.literal('')),
});

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export const stepDetailsSchema = bookingRequestSchema.pick({
  name: true,
  phone: true,
  note: true,
  website: true,
});

export type StepDetailsInput = z.infer<typeof stepDetailsSchema>;
