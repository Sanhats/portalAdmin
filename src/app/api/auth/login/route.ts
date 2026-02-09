import { supabaseAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { loginSchema } from "@/validations/auth";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

// POST /api/auth/login - Iniciar sesión
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[POST /api/auth/login] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const { email, password } = parsed.data;

    // Intentar iniciar sesión con Supabase Auth
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[POST /api/auth/login] Error de autenticación:", error.message);
      return errorResponse("Credenciales inválidas", 401, error.message);
    }

    if (!data.session || !data.user) {
      console.error("[POST /api/auth/login] Sesión o usuario no retornado");
      return errorResponse("Error al iniciar sesión", 500);
    }

    console.log("[POST /api/auth/login] Login exitoso para:", email);
    
    // Obtener tenant_id desde user_metadata o buscar store por defecto
    let tenantId: string | null = data.user.user_metadata?.tenant_id || data.user.user_metadata?.tenantId || null;
    
    // Si no está en user_metadata, buscar store por defecto
    if (!tenantId) {
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (defaultStore) {
        tenantId = defaultStore.id;
        console.log("[POST /api/auth/login] Usando store por defecto como tenant_id:", tenantId);
      } else {
        // Si no hay store por defecto, intentar obtener el primer store activo
        const { data: firstStore } = await supabase
          .from("stores")
          .select("id")
          .is("deleted_at", null)
          .limit(1)
          .single();
        
        if (firstStore) {
          tenantId = firstStore.id;
          console.log("[POST /api/auth/login] Usando primer store disponible como tenant_id:", tenantId);
        } else {
          console.warn("[POST /api/auth/login] No se encontró ningún store disponible. tenant_id será null.");
        }
      }
    } else {
      console.log("[POST /api/auth/login] tenant_id obtenido desde user_metadata:", tenantId);
    }
    
    // Retornar información de la sesión
    return jsonResponse({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || "user",
        tenant_id: tenantId, // Agregar tenant_id a la respuesta
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/auth/login");
  }
}

