import { z } from "zod";

// SPRINT 6: Esquema para abrir caja
// SPRINT 12: Agregado branchId (requerido)
export const openCashRegisterSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  sellerId: z.string()
    .uuid("El sellerId debe ser un UUID válido"),
  branchId: z.string()
    .uuid("El branchId debe ser un UUID válido"), // SPRINT 12: Requerido
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
