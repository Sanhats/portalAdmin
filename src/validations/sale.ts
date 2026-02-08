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
  // SPRINT 2: quantity NUMERIC para soportar pesables
  quantity: z.union([
    z.string().regex(/^\d+(\.\d{1,3})?$/, "La cantidad debe ser un número válido"),
    z.number().positive("La cantidad debe ser mayor a 0")
  ]),
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

// SPRINT 4: Esquema para crear venta (con campos del Sprint 4)
export const createSaleSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  customerId: z.string()
    .uuid("El customerId debe ser un UUID válido")
    .optional()
    .nullable(), // SPRINT 4: Cliente (nullable → venta mostrador)
  date: z.union([
    z.string().datetime("La fecha debe ser válida"),
    z.date()
  ]).optional(), // SPRINT 4: Fecha de venta (default: now)
  status: z.enum([
    "draft", // SPRINT 4: Estado inicial
    "confirmed",
    "cancelled"
  ] as const)
    .optional()
    .default("draft"), // SPRINT 4: default draft
  discountPercentage: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El porcentaje de descuento debe ser un número válido"),
    z.number().min(0, "El porcentaje de descuento no puede ser negativo")
      .max(100, "El porcentaje de descuento no puede ser mayor a 100")
  ]).optional().default(0), // SPRINT 4: Porcentaje de descuento
  discountAmount: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El monto de descuento debe ser un número válido"),
    z.number().nonnegative("El monto de descuento no puede ser negativo")
  ]).optional(), // SPRINT 4: Se calcula automáticamente si no se proporciona
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  items: z.array(saleItemSchema)
    .min(1, "Debe incluir al menos un item en la venta"),
  // SPRINT 4: Total y subtotal (se calculan automáticamente)
  subtotal: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El subtotal debe ser un número válido"),
    z.number().nonnegative("El subtotal no puede ser negativo")
  ]).optional(), // SPRINT 4: Suma de ítems (calculado en backend)
  total: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El total debe ser un número válido"),
    z.number().nonnegative("El total no puede ser negativo")
  ]).optional(), // SPRINT 4: subtotal - discount_amount (calculado en backend)
  // SPRINT 2: Campos adicionales (backward compatibility)
  sellerId: z.string()
    .uuid("El sellerId debe ser un UUID válido")
    .optional(),
  paymentMethod: z.enum(["cash", "card", "transfer", "mixed"])
    .optional()
    .nullable(),
  cashReceived: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El efectivo recibido debe ser un número válido"),
    z.number().nonnegative("El efectivo recibido no puede ser negativo")
  ]).optional().nullable(),
  changeGiven: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El vuelto debe ser un número válido"),
    z.number().nonnegative("El vuelto no puede ser negativo")
  ]).optional().nullable(),
  discountTotal: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El descuento total debe ser un número válido"),
    z.number().nonnegative("El descuento total no puede ser negativo")
  ]).optional().default("0"), // Alias de discount_amount
  taxes: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Los impuestos deben ser un número válido"),
    z.number().nonnegative("Los impuestos no pueden ser negativos")
  ]).optional().default("0"),
  discounts: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Los descuentos deben ser un número válido"),
    z.number().nonnegative("Los descuentos no pueden ser negativos")
  ]).optional().default("0"),
});

// SPRINT 4: Esquema para actualizar venta (solo permite editar en draft)
export const updateSaleSchema = z.object({
  customerId: z.string()
    .uuid("El customerId debe ser un UUID válido")
    .optional()
    .nullable(), // SPRINT 4: Cliente
  date: z.union([
    z.string().datetime("La fecha debe ser válida"),
    z.date()
  ]).optional(), // SPRINT 4: Fecha de venta
  discountPercentage: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El porcentaje de descuento debe ser un número válido"),
    z.number().min(0, "El porcentaje de descuento no puede ser negativo")
      .max(100, "El porcentaje de descuento no puede ser mayor a 100")
  ]).optional(),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
  items: z.array(saleItemSchema)
    .min(1, "Debe incluir al menos un item en la venta")
    .optional(),
  // SPRINT 2: Campos adicionales (backward compatibility)
  paymentMethod: z.enum(["cash", "transfer", "mercadopago", "other"])
    .optional()
    .nullable(),
});

