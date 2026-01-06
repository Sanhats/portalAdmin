import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken, isAdmin } from "@/lib/auth";
import { updateUserRole, getUserRoleById, UserRole } from "@/lib/user-roles";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");
const roleSchema = z.enum(["admin", "super_admin", "manager", "cashier", "user"], {
  errorMap: () => ({ message: "El rol debe ser: admin, super_admin, manager, cashier o user" })
});

// PATCH /api/admin/users/:id/role - Actualizar rol de usuario
export async function PATCH(
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
    
    const currentUser = await validateBearerToken(token);
    if (!currentUser) {
      return errorResponse("No autorizado. Token inválido o expirado", 401);
    }

    // Solo admins pueden asignar roles
    if (!isAdmin(currentUser)) {
      return errorResponse(
        "No autorizado. Solo administradores pueden asignar roles",
        403
      );
    }

    // Validar UUID del usuario
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID de usuario inválido", 400, uuidValidation.error.errors);
    }

    const body = await req.json();
    const parsed = z.object({ role: roleSchema }).safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const { role } = parsed.data;

    // Verificar que el usuario existe
    const userRoleCheck = await getUserRoleById(params.id);
    if (userRoleCheck.error || userRoleCheck.role === null) {
      return errorResponse(
        userRoleCheck.error || "Usuario no encontrado",
        404
      );
    }

    // Actualizar el rol
    const updateResult = await updateUserRole(params.id, role as UserRole);

    if (!updateResult.success) {
      return errorResponse(
        `Error al actualizar el rol: ${updateResult.error}`,
        500
      );
    }

    // Obtener el rol actualizado para confirmar
    const updatedRole = await getUserRoleById(params.id);

    return jsonResponse({
      success: true,
      message: `Rol actualizado correctamente a '${role}'`,
      user: {
        id: params.id,
        role: updatedRole.role,
      },
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "PATCH /api/admin/users/:id/role");
  }
}

// GET /api/admin/users/:id/role - Obtener rol de usuario
export async function GET(
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
    
    const currentUser = await validateBearerToken(token);
    if (!currentUser) {
      return errorResponse("No autorizado. Token inválido o expirado", 401);
    }

    // Solo admins pueden ver roles
    if (!isAdmin(currentUser)) {
      return errorResponse(
        "No autorizado. Solo administradores pueden ver roles",
        403
      );
    }

    // Validar UUID del usuario
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID de usuario inválido", 400, uuidValidation.error.errors);
    }

    // Obtener el rol
    const userRole = await getUserRoleById(params.id);

    if (userRole.error || userRole.role === null) {
      return errorResponse(
        userRole.error || "Usuario no encontrado",
        404
      );
    }

    return jsonResponse({
      user: {
        id: params.id,
        role: userRole.role,
      },
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/admin/users/:id/role");
  }
}

