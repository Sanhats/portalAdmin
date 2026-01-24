import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getProfitabilitySummary } from "@/lib/margin-helpers";
import { z } from "zod";

/**
 * Calcula el delta porcentual entre dos valores
 * Maneja división por cero retornando 0 si el valor anterior es 0
 */
function calculateDeltaPercent(current: number, previous: number): number {
  if (previous === 0) {
    // Si el valor anterior es 0, el delta es 0 (evita división por cero)
    return 0;
  }
  const delta = ((current - previous) / previous) * 100;
  return Math.round(delta * 100) / 100; // Redondeo a 2 decimales
}

/**
 * Normaliza una fecha al inicio del día (00:00:00)
 */
function normalizeStartOfDay(dateString: string): string {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Normaliza una fecha al final del día (23:59:59)
 */
function normalizeEndOfDay(dateString: string): string {
  const date = new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

// GET /api/summary/comparison - Resumen comparativo entre períodos
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

    // Validar que tenantId no sea null (TypeScript)
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Obtener y validar parámetros de fecha (requeridos)
    const fromParam = searchParams.get("from"); // YYYY-MM-DD
    const toParam = searchParams.get("to"); // YYYY-MM-DD

    if (!fromParam || !toParam) {
      return errorResponse("Los parámetros 'from' y 'to' son requeridos (formato YYYY-MM-DD)", 400);
    }

    // Validar formato de fechas
    const fromDateValidation = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(fromParam);
    const toDateValidation = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(toParam);

    if (!fromDateValidation.success) {
      return errorResponse("Parámetro 'from' debe estar en formato YYYY-MM-DD", 400);
    }

    if (!toDateValidation.success) {
      return errorResponse("Parámetro 'to' debe estar en formato YYYY-MM-DD", 400);
    }

    // Normalizar fechas (inicio y fin del día)
    const currentStartDate = normalizeStartOfDay(fromParam);
    const currentEndDate = normalizeEndOfDay(toParam);

    // Validar que from <= to
    if (new Date(currentStartDate) > new Date(currentEndDate)) {
      return errorResponse("La fecha de inicio debe ser anterior o igual a la fecha de fin", 400);
    }

    // Calcular duración del período en días
    const startDateObj = new Date(fromParam + "T00:00:00");
    const endDateObj = new Date(toParam + "T23:59:59");
    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir ambos días

    // Calcular período anterior equivalente (mismo número de días antes)
    // El fin del período anterior es un día antes del inicio del período actual
    const previousEndDateObj = new Date(startDateObj);
    previousEndDateObj.setDate(previousEndDateObj.getDate() - 1);
    
    // El inicio del período anterior es (daysDiff - 1) días antes del fin del período anterior
    const previousStartDateObj = new Date(previousEndDateObj);
    previousStartDateObj.setDate(previousStartDateObj.getDate() - daysDiff + 1);

    // Formatear fechas anteriores en formato YYYY-MM-DD
    const previousStartDateStr = previousStartDateObj.toISOString().split('T')[0];
    const previousEndDateStr = previousEndDateObj.toISOString().split('T')[0];

    const previousStartDate = normalizeStartOfDay(previousStartDateStr);
    const previousEndDate = normalizeEndOfDay(previousEndDateStr);

    // Calcular resumen del período actual
    const currentSummary = await getProfitabilitySummary(
      tenantId,
      currentStartDate,
      currentEndDate
    );

    // Calcular resumen del período anterior
    const previousSummary = await getProfitabilitySummary(
      tenantId,
      previousStartDate,
      previousEndDate
    );

    // Calcular deltas en porcentaje
    const delta = {
      sales: calculateDeltaPercent(currentSummary.sales, previousSummary.sales),
      expenses: calculateDeltaPercent(currentSummary.expenses, previousSummary.expenses),
      netResult: calculateDeltaPercent(currentSummary.netResult, previousSummary.netResult),
    };

    return jsonResponse({
      current: currentSummary,
      previous: previousSummary,
      delta,
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/summary/comparison");
  }
}
