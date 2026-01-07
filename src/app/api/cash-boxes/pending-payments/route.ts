/**
 * SPRINT B2: Endpoint para obtener conteo de pagos confirmados sin movimiento de caja
 * GET /api/cash-boxes/pending-payments - Obtener pagos pendientes de asociación
 */

import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getPendingPaymentsCount } from "@/lib/cash-box-helpers";
import { supabase } from "@/lib/supabase";

// GET /api/cash-boxes/pending-payments - Obtener conteo de pagos pendientes
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

    // En este punto, tenantId no puede ser null
    if (!tenantId) {
      return errorResponse("No se pudo determinar tenantId", 400);
    }

    // Obtener conteo de pagos pendientes
    const pendingCount = await getPendingPaymentsCount(tenantId);

    // Obtener información adicional de los pagos pendientes (opcional, para debugging)
    const { data: payments } = await supabase
      .from("payments")
      .select("id, amount, method, sale_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "confirmed")
      .not("sale_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10); // Solo los últimos 10 para no sobrecargar

    // Obtener los IDs de pagos que ya tienen movimientos
    const { data: existingMovements } = await supabase
      .from("cash_movements")
      .select("payment_id")
      .eq("tenant_id", tenantId)
      .not("payment_id", "is", null);

    const existingPaymentIds = new Set(
      existingMovements?.map((m: any) => m.payment_id).filter(Boolean) || []
    );

    // Filtrar pagos sin movimiento
    const pendingPayments = payments?.filter((p: any) => !existingPaymentIds.has(p.id)) || [];

    return jsonResponse({
      count: pendingCount,
      hasPending: pendingCount > 0,
      sample: pendingPayments.slice(0, 5), // Solo mostrar 5 como muestra
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/cash-boxes/pending-payments");
  }
}
