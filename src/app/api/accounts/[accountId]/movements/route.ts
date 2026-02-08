import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/accounts/:accountId/movements - Obtener movimientos de una cuenta
export async function GET(
  req: Request,
  { params }: { params: { accountId: string } }
) {
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
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar que la cuenta existe y pertenece al tenant
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, tenant_id")
      .eq("id", params.accountId)
      .eq("tenant_id", tenantId)
      .single();

    if (accountError || !account) {
      return errorResponse("Cuenta no encontrada", 404);
    }

    // Filtros
    const type = searchParams.get("type"); // 'debit' | 'credit'
    const referenceType = searchParams.get("referenceType"); // 'sale' | 'payment' | 'adjustment' | 'sale_cancelation'
    const referenceId = searchParams.get("referenceId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Paginación
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Construir query
    let query = supabase
      .from("account_movements")
      .select("*", { count: "exact" })
      .eq("account_id", params.accountId)
      .eq("tenant_id", tenantId);

    // Aplicar filtros
    if (type && (type === "debit" || type === "credit")) {
      query = query.eq("type", type);
    }

    if (referenceType) {
      query = query.eq("reference_type", referenceType);
    }

    if (referenceId) {
      query = query.eq("reference_id", referenceId);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    // Ordenar por fecha (más recientes primero)
    query = query.order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: movements, error: movementsError, count } = await query;

    if (movementsError) {
      console.error("[GET /api/accounts/:accountId/movements] Error:", movementsError);
      return errorResponse("Error al obtener movimientos", 500, movementsError.message);
    }

    return jsonResponse({
      movements: movements || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/accounts/:accountId/movements");
  }
}
