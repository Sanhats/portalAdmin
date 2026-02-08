import { z } from "zod";

// Estados válidos de compra
export const PURCHASE_STATUSES = {
  DRAFT: "draft",
  CONFIRMED: "confirmed",
  RECEIVED: "received",
  CANCELLED: "cancelled",
} as const;

// SPRINT 3: Esquema para item de compra
export const purchaseItemSchema = z.object({
  productId: z.string()
    .uuid("El productId debe ser un UUID válido"),
  variantId: z.string()
    .uuid("El variantId debe ser un UUID válido")
    .optional()
    .nullable(),
  // SPRINT 3: quantity NUMERIC para soportar decimales
  quantity: z.union([
    z.string().regex(/^\d+(\.\d{1,3})?$/, "La cantidad debe ser un número válido"),
    z.number().positive("La cantidad debe ser mayor a 0")
  ]),
  unitCost: z.union([
    z.string().min(1, "El costo unitario es requerido").regex(/^\d+(\.\d{1,2})?$/, "El costo debe ser un número válido"),
    z.number().positive("El costo unitario debe ser positivo")
  ]),
});

// SPRINT 3: Esquema para crear compra
export const createPurchaseSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  supplierId: z.string()
    .uuid("El supplierId debe ser un UUID válido"),
  invoiceNumber: z.string()
    .max(100, "El número de factura no puede exceder 100 caracteres")
    .optional()
    .nullable(), // SPRINT 3: Número de factura opcional
  purchaseDate: z.union([
    z.string().datetime(), // ISO 8601
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    z.date(),
  ]), // SPRINT 3: Fecha de compra (normalizada a 00:00)
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  items: z.array(purchaseItemSchema)
    .min(1, "Debe incluir al menos un item en la compra"),
  // SPRINT 3: total_amount se calcula automáticamente en backend, no se acepta del frontend
});

// SPRINT 3: No se permite actualizar compras una vez creadas
// Este schema se mantiene para backward compatibility pero no se usará
export const updatePurchaseSchema = z.object({
  // SPRINT 3: Las compras no se pueden modificar
}).refine(() => false, {
  message: "No se permite modificar una compra una vez creada",
});
