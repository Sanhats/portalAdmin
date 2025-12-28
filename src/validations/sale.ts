import { z } from "zod";
import { SALE_STATUSES } from "@/lib/sale-constants";

// SPRINT A: Esquema para item de venta (con campos opcionales para snapshot)
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
  // SPRINT A: Campos opcionales para snapshot (se calculan automáticamente si no se proporcionan)
  unitCost: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El costo debe ser un número válido"),
    z.number().nonnegative("El costo no puede ser negativo")
  ]).optional(),
  unitTax: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El impuesto debe ser un número válido"),
    z.number().nonnegative("El impuesto no puede ser negativo")
  ]).optional().default("0"),
  unitDiscount: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El descuento debe ser un número válido"),
    z.number().nonnegative("El descuento no puede ser negativo")
  ]).optional().default("0"),
});

// SPRINT A: Esquema para crear venta (con campos opcionales para totales)
export const createSaleSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  status: z.enum([
    SALE_STATUSES.DRAFT,
    SALE_STATUSES.IN_PROGRESS,
  ] as const)
    .optional()
    .default(SALE_STATUSES.DRAFT),
  paymentMethod: z.enum(["cash", "transfer", "mercadopago", "other"])
    .optional()
    .nullable(),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  items: z.array(saleItemSchema)
    .min(1, "Debe incluir al menos un item en la venta"),
  // SPRINT A: Campos opcionales para totales (se calculan automáticamente si no se proporcionan)
  subtotal: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El subtotal debe ser un número válido"),
    z.number().nonnegative("El subtotal no puede ser negativo")
  ]).optional(),
  taxes: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Los impuestos deben ser un número válido"),
    z.number().nonnegative("Los impuestos no pueden ser negativos")
  ]).optional().default("0"),
  discounts: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Los descuentos deben ser un número válido"),
    z.number().nonnegative("Los descuentos no pueden ser negativos")
  ]).optional().default("0"),
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

