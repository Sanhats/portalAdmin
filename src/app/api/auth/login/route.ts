import { supabaseAuth } from "@/lib/auth";
import { loginSchema } from "@/validations/auth";

// POST /api/auth/login - Iniciar sesión
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Datos inválidos", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Intentar iniciar sesión con Supabase Auth
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return Response.json(
        { error: "Credenciales inválidas", details: error.message },
        { status: 401 }
      );
    }

    if (!data.session || !data.user) {
      return Response.json(
        { error: "Error al iniciar sesión" },
        { status: 500 }
      );
    }

    // Retornar información de la sesión
    return Response.json({
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
    console.error("Error en POST /api/auth/login:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
        type: "unexpected_error",
      },
      { status: 500 }
    );
  }
}

