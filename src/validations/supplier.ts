import { z } from "zod";

// Esquema para crear proveedor
export const createSupplierSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres"),
  email: z.string()
    .email("El email debe ser válido")
    .max(255, "El email no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  phone: z.string()
    .max(50, "El teléfono no puede exceder 50 caracteres")
    .optional()
    .nullable(),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
});

// Esquema para actualizar proveedor
export const updateSupplierSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres")
    .optional(),
  email: z.string()
    .email("El email debe ser válido")
    .max(255, "El email no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  phone: z.string()
    .max(50, "El teléfono no puede exceder 50 caracteres")
    .optional()
    .nullable(),
  notes: z.string()
    .max(5000, "Las notas no pueden exceder 5000 caracteres")
    .optional()
    .nullable(),
});
