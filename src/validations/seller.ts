/**
 * SPRINT 2: Validaciones para vendedores
 */

import { z } from "zod";

export const createSellerSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres"),
  active: z.boolean().optional().default(true),
});

export const updateSellerSchema = createSellerSchema.partial();
