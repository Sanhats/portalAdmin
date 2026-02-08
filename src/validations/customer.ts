import { z } from "zod";

// SPRINT 4: Esquema para crear cliente
export const createCustomerSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres"),
  document: z.string()
    .max(50, "El documento no puede exceder 50 caracteres")
    .optional()
    .nullable(), // DNI / CUIT (opcional, único por tenant)
  email: z.string()
    .email("El email debe ser válido")
    .max(255, "El email no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  phone: z.string()
    .max(50, "El teléfono no puede exceder 50 caracteres")
    .optional()
    .nullable(),
  address: z.string()
    .max(500, "La dirección no puede exceder 500 caracteres")
    .optional()
    .nullable(),
  active: z.boolean()
    .optional()
    .default(true), // Soft delete
});

// SPRINT 4: Esquema para actualizar cliente
export const updateCustomerSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres")
    .optional(),
  document: z.string()
    .max(50, "El documento no puede exceder 50 caracteres")
    .optional()
    .nullable(),
  email: z.string()
    .email("El email debe ser válido")
    .max(255, "El email no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  phone: z.string()
    .max(50, "El teléfono no puede exceder 50 caracteres")
    .optional()
    .nullable(),
  address: z.string()
    .max(500, "La dirección no puede exceder 500 caracteres")
    .optional()
    .nullable(),
  active: z.boolean()
    .optional(), // Soft delete
});
