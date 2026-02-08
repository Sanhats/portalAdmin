import { z } from "zod";

// SPRINT 3: Esquema para crear proveedor
export const createSupplierSchema = z.object({
  tenantId: z.string()
    .uuid("El tenantId debe ser un UUID válido")
    .optional(), // Opcional, se puede obtener del header o usar default
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres"),
  contactName: z.string()
    .max(255, "El nombre de contacto no puede exceder 255 caracteres")
    .optional()
    .nullable(), // SPRINT 3: Nombre de contacto opcional
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
  isActive: z.boolean()
    .optional()
    .default(true), // SPRINT 3: Soft delete con is_active
});

// SPRINT 3: Esquema para actualizar proveedor
export const updateSupplierSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre no puede exceder 255 caracteres")
    .optional(),
  contactName: z.string()
    .max(255, "El nombre de contacto no puede exceder 255 caracteres")
    .optional()
    .nullable(), // SPRINT 3
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
  isActive: z.boolean()
    .optional(), // SPRINT 3: Soft delete
});
