import { supabaseAuth } from "@/lib/auth";
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
    // Retornar información de la sesión
    return jsonResponse({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || "user",
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

