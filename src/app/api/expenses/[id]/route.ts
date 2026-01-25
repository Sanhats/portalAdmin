import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// DELETE /api/expenses/:id - Eliminar un egreso
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      return errorResponse("No autorizado. Token Bearer requerido", 401);
    }
    
    const user = await validateBearerToken(token);
    if (!user) {
      return errorResponse("No autorizado. Token inválido o expirado", 401);
    }

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

    const { id } = params;

    // Obtener tenantId del header para validar que el egreso pertenece al tenant
    let tenantId = req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (defaultStore) {
        tenantId = defaultStore.id;
      }
    }

    // Verificar que el egreso existe y pertenece al tenant
    if (tenantId) {
      const { data: expense, error: checkError } = await supabase
        .from("expenses")
        .select("id")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();

      if (checkError || !expense) {
        return errorResponse("Egreso no encontrado o no pertenece al tenant", 404);
      }
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[DELETE /api/expenses/:id] Error al eliminar egreso:", error);
      return errorResponse("Error al eliminar egreso", 500, error.message, error.code);
    }

    return jsonResponse({ message: "Egreso eliminado correctamente" });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/expenses/:id");
  }
}
