import { z } from "zod";

/**
 * SPRINT 3 - Validaciones para carga completa de productos
 * Estructura anidada:
 * - internal: datos internos (sku, name_internal, price, stock, etc.)
 * - public: datos públicos (name, slug, description, is_featured)
 * - variants: array de variantes (opcional)
 * - images: array de imágenes (opcional)
 */

// Schema para datos internos
const internalDataSchema = z.object({
  nameInternal: z.string()
    .min(1, "El nombre interno es requerido")
    .max(255, "El nombre interno no puede exceder 255 caracteres"),
  price: z.union([
    z.string().min(1, "El precio es requerido").regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido (ej: 99.99)"),
    z.number().positive("El precio debe ser positivo")
  ]),
  stock: z.number()
    .int("El stock debe ser un número entero")
    .min(0, "El stock no puede ser negativo"),
  categoryId: z.string()
    .uuid("El categoryId debe ser un UUID válido")
    .optional()
    .nullable(),
  isActive: z.boolean(),
  isVisible: z.boolean(),
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

// Schema para datos públicos
const publicDataSchema = z.object({
  name: z.string()
    .min(1, "El nombre público es requerido")
    .max(255, "El nombre público no puede exceder 255 caracteres"),
  slug: z.string()
    .min(1, "El slug es requerido")
    .max(255, "El slug no puede exceder 255 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug debe contener solo letras minúsculas, números y guiones"),
  description: z.string()
    .max(5000, "La descripción no puede exceder 5000 caracteres")
    .optional()
    .nullable(),
  isFeatured: z.boolean().default(false),
});

// Schema para variante
const variantSchema = z.object({
  name: z.string()
    .min(1, "El nombre de la variante es requerido")
    .max(100, "El nombre de la variante no puede exceder 100 caracteres"),
  value: z.string()
    .min(1, "El valor de la variante es requerido")
    .max(100, "El valor de la variante no puede exceder 100 caracteres"),
});

// Schema para imagen
const imageSchema = z.object({
  imageUrl: z.string()
    .url("La URL de la imagen debe ser válida")
    .max(2048, "La URL no puede exceder 2048 caracteres"),
});

// Schema completo para SPRINT 3 (carga completa)
export const createProductSprint3Schema = z.object({
  sku: z.string()
    .min(1, "El SKU es requerido")
    .max(100, "El SKU no puede exceder 100 caracteres")
    .regex(/^[A-Z0-9\-_]+$/, "El SKU debe contener solo letras mayúsculas, números, guiones y guiones bajos"),
  internal: internalDataSchema,
  public: publicDataSchema,
  variants: z.array(variantSchema).optional().default([]),
  images: z.array(imageSchema).optional().default([]),
});

