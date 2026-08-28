import { z } from 'zod';

export const promoLeadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre completo')
    .max(80, 'Nombre muy largo'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Escribe un número de teléfono válido'),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .optional()
    .or(z.literal('')),
  // Honeypot: los usuarios reales nunca llenan este campo.
  website: z.string().max(0).optional().or(z.literal('')),
});

export type PromoLeadInput = z.infer<typeof promoLeadSchema>;
