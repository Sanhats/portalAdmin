/**
 * SPRINT 2: Validaciones para vendedores
 */

import { z } from "zod";

export const createSellerSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres"),
  email: z.string().email("Email inválido").optional().nullable(),
  role: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
  is_active: z.boolean().optional(), // Alias para active, se mapea internamente
});

export const updateSellerSchema = createSellerSchema.partial();
