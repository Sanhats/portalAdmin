import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getOrCreateAccount, getAccountBalance } from "@/lib/accounting-helpers-sprint5";

// GET /api/accounts/customers/:customerId - Obtener cuenta corriente de un cliente
export async function GET(
  req: Request,
  { params }: { params: { customerId: string } }
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

    // Validar que el cliente existe
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name, active")
      .eq("id", params.customerId)
      .eq("tenant_id", tenantId)
      .single();

    if (customerError || !customer) {
      return errorResponse("Cliente no encontrado", 404);
    }

    if (!customer.active) {
      return errorResponse("El cliente está inactivo", 400);
    }

    // Obtener o crear cuenta
    const { accountId } = await getOrCreateAccount(params.customerId, tenantId);

    // Obtener datos de la cuenta
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      return errorResponse("Error al obtener cuenta", 500, accountError?.message);
    }

    // Calcular balance actual desde movimientos (fuente de verdad)
    const balance = await getAccountBalance(accountId);

    // Obtener últimos movimientos (paginado)
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const { data: movements, error: movementsError, count } = await supabase
      .from("account_movements")
      .select("*", { count: "exact" })
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (movementsError) {
      console.error("[GET /api/accounts/customers/:customerId] Error al obtener movimientos:", movementsError);
      return errorResponse("Error al obtener movimientos", 500, movementsError.message);
    }

    return jsonResponse({
      account: {
        ...account,
        balance: balance, // Balance calculado (fuente de verdad)
        balanceCached: parseFloat(account.balance || "0"), // Balance cacheado (solo informativo)
      },
      customer: {
        id: customer.id,
        name: customer.name,
      },
      movements: {
        data: movements || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/accounts/customers/:customerId");
  }
}
