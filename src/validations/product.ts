import { z } from "zod";

// Esquema para crear/actualizar producto
export const productSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres"),
  slug: z.string()
    .min(1, "El slug es requerido")
    .max(255, "El slug no puede exceder 255 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug debe contener solo letras minúsculas, números y guiones"),
  description: z.string()
    .max(5000, "La descripción no puede exceder 5000 caracteres")
    .optional()
    .nullable(),
  price: z.union([
    z.string().min(1, "El precio es requerido").regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido (ej: 99.99)"),
    z.number().positive("El precio debe ser positivo")
  ]),
  stock: z.number()
    .int("El stock debe ser un número entero")
    .min(0, "El stock no puede ser negativo")
    .default(0),
  isFeatured: z.boolean().default(false),
  categoryId: z.string()
    .uuid("El categoryId debe ser un UUID válido")
    .optional()
    .nullable(),
});

// Esquema para variante
export const variantSchema = z.object({
  name: z.string()
    .min(1, "El nombre de la variante es requerido")
    .max(100, "El nombre de la variante no puede exceder 100 caracteres"),
  value: z.string()
    .min(1, "El valor de la variante es requerido")
    .max(100, "El valor de la variante no puede exceder 100 caracteres"),
});

// Esquema para imagen - acepta tanto imageUrl como image_url para compatibilidad
export const productImageSchema = z.object({
  imageUrl: z.string()
    .url("La URL de la imagen debe ser válida")
    .max(2048, "La URL no puede exceder 2048 caracteres")
    .optional(),
  image_url: z.string()
    .url("La URL de la imagen debe ser válida")
    .max(2048, "La URL no puede exceder 2048 caracteres")
    .optional(),
}).refine((data) => data.imageUrl || data.image_url, {
  message: "Debe proporcionar 'imageUrl' o 'image_url'",
});

// Esquema completo para crear producto con variantes e imágenes
// Acepta tanto 'images' como 'product_images' para compatibilidad
export const createProductSchema = productSchema.extend({
  variants: z.array(variantSchema).optional().default([]),
  images: z.array(productImageSchema).optional().default([]),
  product_images: z.array(productImageSchema).optional().default([]),
});

// Esquema para actualizar producto con variantes e imágenes
// Acepta tanto 'images' como 'product_images' para compatibilidad
export const productUpdateSchema = productSchema.partial().extend({
  variants: z.array(variantSchema).optional(),
  images: z.array(productImageSchema).optional(),
  product_images: z.array(productImageSchema).optional(),
});
