import { supabase } from "@/lib/supabase";
import { createCategorySchema } from "@/validations/category";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

export async function GET() {
  try {
    // Verificar que las variables de entorno estén configuradas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return errorResponse("Variables de entorno no configuradas", 500);
    }

    const { data, error } = await supabase.from("categories").select("*");
    
    if (error) {
      console.error("[GET /api/categories] Error de Supabase:", error);
      return errorResponse("Error al obtener categorías", 500, error.message, error.code);
    }
    
    return jsonResponse(data || []);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/categories");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/categories] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const { data, error } = await supabase.from("categories").insert(parsed.data).select();
    
    if (error) {
      console.error("[POST /api/categories] Error al crear categoría:", error);
      return errorResponse("Error al crear la categoría", 500, error.message, error.code);
    }
    
    console.log("[POST /api/categories] Categoría creada exitosamente:", data?.[0]?.id);
    return jsonResponse(data, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/categories");
  }
}

