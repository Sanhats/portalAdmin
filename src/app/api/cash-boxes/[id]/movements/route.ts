/**
 * SPRINT B2: Endpoints para gestión de movimientos de caja
 * GET /api/cash-boxes/:id/movements - Listar movimientos de una caja
 * POST /api/cash-boxes/:id/movements - Crear movimiento manual
 */

import { supabase } from "@/lib/supabase";
import { createCashMovementSchema } from "@/validations/cash-box";
import { jsonResponse, errorResponse, handleUnexpectedError, validatePagination } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/cash-boxes/:id/movements - Listar movimientos de una caja
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
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

    // Verificar que la caja existe
    const { data: cashBox, error: cashBoxError } = await supabase
      .from("cash_boxes")
      .select("id, status")
      .eq("id", params.id)
      .single();

    if (cashBoxError || !cashBox) {
      return errorResponse("Caja no encontrada", 404);
    }

    // Validar paginación
    const { searchParams } = new URL(req.url);
    let pagination;
    try {
      pagination = validatePagination(
        searchParams.get("page"),
        searchParams.get("limit"),
        false
      );
    } catch (error: any) {
      return errorResponse(`Parámetros de paginación inválidos: ${error.message}`, 400);
    }
    
    const { page, limit, offset, isAllMode } = pagination;

    // Filtros
    const type = searchParams.get("type"); // 'income' | 'expense'
    const paymentMethod = searchParams.get("paymentMethod"); // 'cash' | 'transfer'

    // Construir query
    let query = supabase
      .from("cash_movements")
      .select("*", { count: "exact" })
      .eq("cash_box_id", params.id);

    // Aplicar filtros
    if (type) {
      query = query.eq("type", type);
    }

    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    // Ordenar por fecha descendente (más recientes primero)
    query = query.order("created_at", { ascending: false });

    // Aplicar paginación (solo si no es modo "all")
    if (!isAllMode && typeof limit === "number") {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: movements, error, count } = await query;

    if (error) {
      console.error("[GET /api/cash-boxes/:id/movements] Error al obtener movimientos:", error);
      return errorResponse("Error al obtener movimientos", 500);
    }

    return jsonResponse({
      data: movements || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: isAllMode ? 1 : Math.ceil((count || 0) / (typeof limit === "number" ? limit : 1)),
      },
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/cash-boxes/:id/movements");
  }
}

// POST /api/cash-boxes/:id/movements - Crear movimiento manual
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
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

    const body = await req.json();

    // Validar datos
    const parsed = createCashMovementSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const { type, amount, paymentMethod, reference } = parsed.data;

    // Verificar que la caja existe y está abierta
    const { data: cashBox, error: cashBoxError } = await supabase
      .from("cash_boxes")
      .select("id, status, tenant_id")
      .eq("id", params.id)
      .single();

    if (cashBoxError || !cashBox) {
      return errorResponse("Caja no encontrada", 404);
    }

    // Verificar que la caja esté abierta
    if (cashBox.status !== "open") {
      return errorResponse(`No se pueden crear movimientos en una caja cerrada (estado: ${cashBox.status})`, 400);
    }

    // Obtener tenant_id
    const tenantId = cashBox.tenant_id;

    // Crear el movimiento
    const { data: movement, error: createError } = await supabase
      .from("cash_movements")
      .insert({
        cash_box_id: params.id,
        tenant_id: tenantId,
        type,
        amount: amount.toString(),
        payment_method: paymentMethod,
        reference: reference || null,
        // payment_id y sale_id son NULL para movimientos manuales
      })
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/cash-boxes/:id/movements] Error al crear movimiento:", createError);
      return errorResponse("Error al crear movimiento", 500);
    }

    return jsonResponse(movement, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/cash-boxes/:id/movements");
  }
}
