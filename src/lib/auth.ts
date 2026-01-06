import { createClient } from "@supabase/supabase-js";

/**
 * Crea un cliente de Supabase para autenticación
 * Usa la URL pública y la clave anónima (para validar tokens sin bypasear RLS)
 */
export const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Crea un cliente de Supabase Admin para operaciones administrativas
 * Usa service_role_key para tener permisos completos
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Valida un token Bearer de Supabase
 * @param token - Token Bearer (sin el prefijo "Bearer ")
 * @returns Usuario autenticado o null
 */
export async function validateBearerToken(token: string) {
  try {
    // Verificar que el token no esté vacío
    if (!token || token.trim() === "") {
      return null;
    }

    // Usar el cliente de auth para verificar el token
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Error al validar token:", error);
    return null;
  }
}

/**
 * Extrae el token Bearer del header Authorization
 * @param authHeader - Header Authorization completo
 * @returns Token sin el prefijo "Bearer " o null
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Verificar que comience con "Bearer "
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  // Extraer el token (remover "Bearer ")
  const token = authHeader.substring(7).trim();

  return token || null;
}

/**
 * Obtiene el rol del usuario desde user_metadata
 * @param user - Usuario de Supabase
 * @returns Rol del usuario o 'user' por defecto
 */
export function getUserRole(user: any): string {
  if (!user) {
    return 'user';
  }

  // Obtener rol de user_metadata o app_metadata
  const role = user.user_metadata?.role || user.app_metadata?.role || 'user';
  return role.toLowerCase();
}

/**
 * Verifica si un usuario tiene rol de admin
 * @param user - Usuario de Supabase
 * @returns true si es admin, false en caso contrario
 */
export function isAdmin(user: any): boolean {
  if (!user) {
    return false;
  }

  const role = getUserRole(user);
  return role === 'admin' || role === 'super_admin';
}

/**
 * Verifica si un usuario tiene permisos para confirmar pagos
 * SPRINT 2: Solo admin, manager o cashier pueden confirmar pagos
 * @param user - Usuario de Supabase
 * @returns true si puede confirmar pagos, false en caso contrario
 */
export function canConfirmPayments(user: any): boolean {
  if (!user) {
    return false;
  }

  const role = getUserRole(user);
  // Roles permitidos: admin, manager, cashier
  const allowedRoles = ['admin', 'super_admin', 'manager', 'cashier'];
  return allowedRoles.includes(role);
}

