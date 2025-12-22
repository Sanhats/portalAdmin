import { z } from "zod";

// Esquema para item de venta
export const saleItemSchema = z.object({
  productId: z.string()
    .uuid("El productId debe ser un UUID válido"),
  variantId: z.string()
    .uuid("El variantId debe ser un UUID válido")
    .optional()
    .nullable(),
  quantity: z.number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0"),
  unitPrice: z.union([
    z.string().min(1, "El precio unitario es requerido").regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido"),
    z.number().positive("El precio unitario debe ser positivo")
  ]),
});

// Esquema para crear venta
export const createSaleSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  paymentMethod: z.enum(["cash", "transfer", "mercadopago", "other"])
    .optional()
    .nullable(),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  items: z.array(saleItemSchema)
    .min(1, "Debe incluir al menos un item en la venta"),
});

// Esquema para actualizar venta (solo permite editar ciertos campos en draft)
export const updateSaleSchema = z.object({
  paymentMethod: z.enum(["cash", "transfer", "mercadopago", "other"])
    .optional()
    .nullable(),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  items: z.array(saleItemSchema)
    .min(1, "Debe incluir al menos un item en la venta")
    .optional(),
});

