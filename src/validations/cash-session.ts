/**
 * SPRINT 2: Validaciones para sesiones de caja
 */

import { z } from "zod";

export const openCashSessionSchema = z.object({
  sellerId: z.string()
    .uuid("El sellerId debe ser un UUID válido"),
  openingAmount: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El monto inicial debe ser un número válido"),
    z.number().nonnegative("El monto inicial no puede ser negativo")
  ]).default("0"),
});

export const closeCashSessionSchema = z.object({
  closingAmount: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El monto final debe ser un número válido"),
    z.number().nonnegative("El monto final no puede ser negativo")
  ]).optional(), // Opcional, se calcula automáticamente si no se proporciona
});
