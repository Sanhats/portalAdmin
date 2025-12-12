import { supabase } from "@/lib/supabase";
import { createCategorySchema } from "@/validations/category";

export async function GET() {
  try {
    // Verificar que las variables de entorno estén configuradas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        { error: "Variables de entorno no configuradas" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase.from("categories").select("*");
    
    if (error) {
      console.error("Error de Supabase:", error);
      return Response.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }
    
    return Response.json(data || []);
  } catch (error) {
    console.error("Error en GET /api/categories:", error);
    return Response.json(
      { 
        error: error instanceof Error ? error.message : "Error desconocido",
        type: "unexpected_error"
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    
    if (!parsed.success) {
      return Response.json(
        { error: "Datos inválidos", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.from("categories").insert(parsed.data).select();
    
    if (error) {
      console.error("Error al crear categoría:", error);
      return Response.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }
    
    return Response.json(data, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/categories:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
        type: "unexpected_error",
      },
      { status: 500 }
    );
  }
}

