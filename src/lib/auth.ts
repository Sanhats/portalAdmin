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
 * Verifica si un usuario tiene rol de admin
 * Por ahora, cualquier usuario autenticado es considerado admin
 * Puedes mejorar esto agregando un campo role en user_metadata
 * @param user - Usuario de Supabase
 * @returns true si es admin, false en caso contrario
 */
export function isAdmin(user: any): boolean {
  if (!user) {
    return false;
  }

  // Por ahora, cualquier usuario autenticado es admin
  // Puedes mejorar esto verificando user.user_metadata.role === 'admin'
  return true;
}

