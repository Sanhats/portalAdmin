import { z } from "zod";

/**
 * SPRINT 6: Validaciones para reportes
 */

// Esquema para parámetros de fecha
export const dateRangeSchema = z.object({
  startDate: z.string()
    .datetime("La fecha de inicio debe ser una fecha válida (ISO 8601)")
    .optional()
    .nullable(),
  endDate: z.string()
    .datetime("La fecha de fin debe ser una fecha válida (ISO 8601)")
    .optional()
    .nullable(),
}).refine(
  (data) => {
    // Si ambas fechas están presentes, startDate debe ser anterior a endDate
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: "La fecha de inicio debe ser anterior o igual a la fecha de fin",
    path: ["startDate"],
  }
);

// Esquema para reporte de caja diaria
export const dailyCashSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe estar en formato YYYY-MM-DD")
    .optional()
    .nullable(),
});

