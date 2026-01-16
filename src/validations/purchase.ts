import { z } from "zod";

// Estados válidos de compra
export const PURCHASE_STATUSES = {
  DRAFT: "draft",
  CONFIRMED: "confirmed",
  RECEIVED: "received",
  CANCELLED: "cancelled",
} as const;

// Esquema para item de compra
export const purchaseItemSchema = z.object({
  productId: z.string()
    .uuid("El productId debe ser un UUID válido"),
  variantId: z.string()
    .uuid("El variantId debe ser un UUID válido")
    .optional()
    .nullable(),
  quantity: z.number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0"),
  unitCost: z.union([
    z.string().min(1, "El costo unitario es requerido").regex(/^\d+(\.\d{1,2})?$/, "El costo debe ser un número válido"),
    z.number().positive("El costo unitario debe ser positivo")
  ]),
});

// Esquema para crear compra
export const createPurchaseSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  supplierId: z.string()
    .uuid("El supplierId debe ser un UUID válido"),
  status: z.enum([
    PURCHASE_STATUSES.DRAFT,
    PURCHASE_STATUSES.CONFIRMED,
  ] as const)
    .optional()
    .default(PURCHASE_STATUSES.DRAFT),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  items: z.array(purchaseItemSchema)
    .min(1, "Debe incluir al menos un item en la compra"),
  // Campos opcionales para totales (se calculan automáticamente si no se proporcionan)
  subtotal: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El subtotal debe ser un número válido"),
    z.number().nonnegative("El subtotal no puede ser negativo")
  ]).optional(),
});

// Esquema para actualizar compra (solo permite editar ciertos campos en draft)
export const updatePurchaseSchema = z.object({
  supplierId: z.string()
    .uuid("El supplierId debe ser un UUID válido")
    .optional(),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  items: z.array(purchaseItemSchema)
    .min(1, "Debe incluir al menos un item en la compra")
    .optional(),
});
