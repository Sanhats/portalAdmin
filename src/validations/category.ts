import { z } from "zod";

// Esquema para crear/actualizar categoría
export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre no puede exceder 255 caracteres"),
  slug: z.string()
    .min(1, "El slug es requerido")
    .max(255, "El slug no puede exceder 255 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug debe contener solo letras minúsculas, números y guiones"),
});

// Esquema para actualización parcial
export const categoryUpdateSchema = categorySchema.partial();

// Esquema para crear categoría (igual que categorySchema por ahora, pero puede extenderse)
export const createCategorySchema = categorySchema;

// Esquema para actualizar categoría
export const updateCategorySchema = categoryUpdateSchema;

