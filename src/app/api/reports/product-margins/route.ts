import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getProductMargins } from "@/lib/margin-helpers";
import { z } from "zod";

// SPRINT G: GET /api/reports/product-margins - Reporte de margen por producto
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

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Obtener parámetros de fecha (opcionales)
    const fromParam = searchParams.get("from"); // YYYY-MM-DD
    const toParam = searchParams.get("to"); // YYYY-MM-DD

    // Convertir fechas YYYY-MM-DD a ISO strings si se proporcionan
    let startDate: string | undefined = undefined;
    let endDate: string | undefined = undefined;

    if (fromParam) {
      // Validar formato YYYY-MM-DD
      const fromDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(fromParam);
      if (!fromDate.success) {
        return errorResponse("Parámetro 'from' debe estar en formato YYYY-MM-DD", 400);
      }
      startDate = new Date(fromParam + "T00:00:00").toISOString();
    }

    if (toParam) {
      // Validar formato YYYY-MM-DD
      const toDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(toParam);
      if (!toDate.success) {
        return errorResponse("Parámetro 'to' debe estar en formato YYYY-MM-DD", 400);
      }
      // Incluir todo el día final
      const endDateObj = new Date(toParam + "T23:59:59");
      endDate = endDateObj.toISOString();
    }

    // Validar que startDate <= endDate si ambas están presentes
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return errorResponse("La fecha de inicio debe ser anterior o igual a la fecha de fin", 400);
    }

    // Obtener reporte
    const report = await getProductMargins(tenantId, startDate, endDate);

    return jsonResponse(report, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/product-margins");
  }
}
