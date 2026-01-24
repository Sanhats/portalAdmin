import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getProfitabilitySummary } from "@/lib/margin-helpers";
import { z } from "zod";

// GET /api/summary/profitability - Resumen de rentabilidad
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
    let tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    
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

    // Obtener parámetros de fecha (opcionales)
    const fromParam = searchParams.get("from"); // YYYY-MM-DD
    const toParam = searchParams.get("to"); // YYYY-MM-DD

    let startDate: string | undefined = undefined;
    let endDate: string | undefined = undefined;

    if (fromParam) {
      const fromDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(fromParam);
      if (!fromDate.success) {
        return errorResponse("Parámetro 'from' debe estar en formato YYYY-MM-DD", 400);
      }
      startDate = new Date(fromParam + "T00:00:00").toISOString();
    }

    if (toParam) {
      const toDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(toParam);
      if (!toDate.success) {
        return errorResponse("Parámetro 'to' debe estar en formato YYYY-MM-DD", 400);
      }
      endDate = new Date(toParam + "T23:59:59").toISOString();
    }

    // Validar que tenantId no sea null (TypeScript)
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Obtener resumen
    const summary = await getProfitabilitySummary(tenantId, startDate, endDate);

    return jsonResponse(summary, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/summary/profitability");
  }
}
