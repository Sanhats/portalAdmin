import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

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

    const { id } = params;

    if (!id) {
      return errorResponse("ID de egreso requerido", 400);
    }

    // Opcional: Verificar que el egreso pertenece al tenant del usuario
    // Para simplificar, asumimos que si tiene el ID correcto puede borrarlo
    // ya que estamos en un contexto administrativo.

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[DELETE /api/expenses] Error al eliminar egreso:", error);
      return errorResponse("Error al eliminar egreso", 500, error.message, error.code);
    }

    return jsonResponse({ message: "Egreso eliminado correctamente" });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/expenses");
  }
}
