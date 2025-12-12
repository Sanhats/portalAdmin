import { z } from "zod";

// Validación para el nombre del archivo
export const fileNameSchema = z.string().min(1).max(255);

// Validación para el tipo de archivo (solo imágenes)
export const imageFileTypeSchema = z.enum([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Tamaño máximo: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB en bytes

// Validación para el tamaño del archivo
export const fileSizeSchema = z.number().max(MAX_FILE_SIZE, {
  message: `El archivo no puede ser mayor a ${MAX_FILE_SIZE / 1024 / 1024}MB`,
});

// Esquema completo para validar archivo de imagen
export const imageUploadSchema = z.object({
  file: z.instanceof(File, { message: "Debe ser un archivo válido" }),
  fileName: z.string().optional(),
});

// Validación para múltiples archivos
export const multipleImageUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "Debe subir al menos un archivo"),
});

