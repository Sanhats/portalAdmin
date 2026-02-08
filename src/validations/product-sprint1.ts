import { z } from "zod";

/**
 * SPRINT 2 - Validaciones para carga rápida de productos
 * Campos requeridos:
 * - sku
 * - name_internal
 * - price
 * - stock (opcional, default: 0)
 * 
 * Reglas SPRINT 2:
 * - is_visible = false por defecto (producto no publicado automáticamente)
 * - is_active = true por defecto
 * - category_id, description, images → opcionales
 */
export const productSprint1Schema = z.object({
  sku: z.string()
    .min(1, "El SKU es requerido")
    .max(100, "El SKU no puede exceder 100 caracteres")
    .regex(/^[A-Z0-9\-_]+$/, "El SKU debe contener solo letras mayúsculas, números, guiones y guiones bajos"),
  nameInternal: z.string()
    .min(1, "El nombre interno es requerido")
    .max(255, "El nombre interno no puede exceder 255 caracteres"),
  price: z.union([
    z.string().min(1, "El precio es requerido").regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido (ej: 99.99)"),
    z.number().positive("El precio debe ser positivo")
  ]),
  stock: z.number()
    .int("El stock debe ser un número entero")
    .min(0, "El stock no puede ser negativo")
    .optional()
    .default(0),
  categoryId: z.string()
    .uuid("El categoryId debe ser un UUID válido")
    .optional()
    .nullable(),
  description: z.string()
    .max(5000, "La descripción no puede exceder 5000 caracteres")
    .optional()
    .nullable(),
  isActive: z.boolean().optional().default(true),
  isVisible: z.boolean().optional().default(false), // SPRINT 2: false por defecto (no publicado)
  // SPRINT 1: Campos del núcleo comercial
  barcode: z.string()
    .max(100, "El código de barras no puede exceder 100 caracteres")
    .optional()
    .nullable(),
  isWeighted: z.boolean().optional().default(false),
  unit: z.enum(["unit", "kg", "g"]).optional().default("unit"),
  cost: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El costo debe ser un número válido"),
    z.number().nonnegative("El costo debe ser un número no negativo")
  ]).optional().nullable(),
});

// Esquema para crear producto (SPRINT 2 - Carga rápida)
export const createProductSprint1Schema = productSprint1Schema;

