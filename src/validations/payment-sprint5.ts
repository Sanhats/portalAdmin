import { z } from "zod";

// SPRINT 5: Esquema para crear pago
export const createPaymentSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  customerId: z.string()
    .uuid("El customerId debe ser un UUID válido"),
  saleId: z.string()
    .uuid("El saleId debe ser un UUID válido")
    .optional()
    .nullable(), // Opcional: permite pagos parciales o pagos sin venta
  amount: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser un número válido"),
    z.number().positive("El monto debe ser mayor a 0")
  ]),
  method: z.enum(["cash", "transfer", "card", "other"], {
    errorMap: () => ({ message: "El método de pago debe ser: cash, transfer, card u other" })
  }),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  // SPRINT 6: Campos de caja
  sellerId: z.string()
    .uuid("El sellerId debe ser un UUID válido"), // SPRINT 6: Requerido para asociar a caja
  // SPRINT 12: Sucursal
  branchId: z.string()
    .uuid("El branchId debe ser un UUID válido"), // SPRINT 12: Requerido
});
