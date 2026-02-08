import { z } from "zod";

// SPRINT 6: Esquema para abrir caja
export const openCashRegisterSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  sellerId: z.string()
    .uuid("El sellerId debe ser un UUID válido"),
  openingAmount: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El monto inicial debe ser un número válido"),
    z.number().nonnegative("El monto inicial no puede ser negativo")
  ]).optional().default(0),
});

// SPRINT 6: Esquema para cerrar caja
export const closeCashRegisterSchema = z.object({
  closingAmount: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El monto de cierre debe ser un número válido"),
    z.number().nonnegative("El monto de cierre no puede ser negativo")
  ]),
});
