import { supabase } from "@/lib/supabase";
import { dailyCashSchema } from "@/validations/report";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getDailyCash } from "@/lib/report-helpers";

// SPRINT 6: GET /api/reports/daily-cash - Caja diaria
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    
    // Obtener tenant_id del query param o header
    let tenantId: string | null = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      // Usar store por defecto
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (!defaultStore) {
        return errorResponse("No se encontró store por defecto. Proporciona tenantId", 400);
      }
      
      tenantId = defaultStore.id;
    }

    // Asegurar que tenantId es string (TypeScript)
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar parámetro de fecha
    const dateParam = searchParams.get("date");
    const parsed = dailyCashSchema.safeParse({ date: dateParam });
    
    if (!parsed.success) {
      return errorResponse("Parámetro de fecha inválido", 400, parsed.error.errors);
    }

    // Convertir fecha YYYY-MM-DD a ISO string si se proporciona
    let dateISO: string | undefined = undefined;
    if (parsed.data.date && parsed.data.date !== null) {
      const date = new Date(parsed.data.date);
      dateISO = date.toISOString();
    }

    // Obtener reporte
    const report = await getDailyCash(tenantId, dateISO);

    return jsonResponse(report, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/daily-cash");
  }
}

