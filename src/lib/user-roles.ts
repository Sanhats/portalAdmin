import { supabaseAdmin } from "./auth";

/**
 * Roles disponibles en el sistema
 */
export type UserRole = 'admin' | 'super_admin' | 'manager' | 'cashier' | 'user';

/**
 * SPRINT 2: Actualiza el rol de un usuario en Supabase
 * @param userId - ID del usuario
 * @param role - Rol a asignar
 * @returns true si se actualizó correctamente, false en caso contrario
 */
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    // Actualizar user_metadata con el rol usando el cliente admin
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          role: role,
        },
        app_metadata: {
          role: role, // También en app_metadata para mayor compatibilidad
        },
      }
    );

    if (error) {
      console.error("[updateUserRole] Error al actualizar rol:", error);
      return { success: false, error: error.message };
    }

    console.log(`[updateUserRole] Rol actualizado para usuario ${userId}: ${role}`);
    return { success: true };
  } catch (error) {
    console.error("[updateUserRole] Error inesperado:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Obtiene el rol actual de un usuario
 * @param userId - ID del usuario
 * @returns Rol del usuario o null si no se encuentra
 */
export async function getUserRoleById(
  userId: string
): Promise<{ role: UserRole | null; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !data?.user) {
      return { role: null, error: error?.message || "Usuario no encontrado" };
    }

    const role =
      data.user.user_metadata?.role ||
      data.user.app_metadata?.role ||
      "user";

    return { role: role.toLowerCase() as UserRole };
  } catch (error) {
    console.error("[getUserRoleById] Error:", error);
    return {
      role: null,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

