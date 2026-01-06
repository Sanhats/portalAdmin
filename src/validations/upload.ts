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

// SPRINT 4: Validación para el tipo de archivo de evidencia (imágenes y PDFs)
export const evidenceFileTypeSchema = z.enum([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

// Tamaño máximo: 5MB para imágenes
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB en bytes

// SPRINT 4: Tamaño máximo para evidencia de pago: 10MB (para incluir PDFs)
const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024; // 10MB en bytes

// Validación para el tamaño del archivo
export const fileSizeSchema = z.number().max(MAX_FILE_SIZE, {
  message: `El archivo no puede ser mayor a ${MAX_FILE_SIZE / 1024 / 1024}MB`,
});

// SPRINT 4: Validación para el tamaño del archivo de evidencia
export const evidenceFileSizeSchema = z.number().max(MAX_EVIDENCE_FILE_SIZE, {
  message: `El archivo no puede ser mayor a ${MAX_EVIDENCE_FILE_SIZE / 1024 / 1024}MB`,
});

// Esquema completo para validar archivo de imagen
export const imageUploadSchema = z.object({
  file: z.instanceof(File, { message: "Debe ser un archivo válido" }),
  fileName: z.string().optional(),
});

// SPRINT 4: Esquema completo para validar archivo de evidencia de pago
export const paymentEvidenceUploadSchema = z.object({
  file: z.instanceof(File, { message: "Debe ser un archivo válido" }),
  fileName: z.string().optional(),
});

// Validación para múltiples archivos
export const multipleImageUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "Debe subir al menos un archivo"),
});

