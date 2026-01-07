/**
 * SPRINT B2: Endpoints para gestión de cajas diarias
 * GET /api/cash-boxes - Listar cajas
 * POST /api/cash-boxes - Abrir nueva caja
 */

import { supabase } from "@/lib/supabase";
import { openCashBoxSchema } from "@/validations/cash-box";
import { jsonResponse, errorResponse, handleUnexpectedError, validatePagination } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getOpenCashBox, associatePendingPaymentsToCashBox, getPendingPaymentsCount } from "@/lib/cash-box-helpers";

// GET /api/cash-boxes - Listar cajas con filtros y paginación
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

    // Validar paginación
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
    const status = searchParams.get("status"); // 'open' | 'closed'
    const dateFrom = searchParams.get("dateFrom"); // YYYY-MM-DD
    const dateTo = searchParams.get("dateTo"); // YYYY-MM-DD

    // Construir query
    let query = supabase
      .from("cash_boxes")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId);

    // Aplicar filtros
    if (status) {
      query = query.eq("status", status);
    }

    if (dateFrom) {
      query = query.gte("date", `${dateFrom}T00:00:00`);
    }

    if (dateTo) {
      query = query.lte("date", `${dateTo}T23:59:59`);
    }

    // Ordenar por fecha descendente (más recientes primero)
    query = query.order("date", { ascending: false });

    // Aplicar paginación (solo si no es modo "all")
    if (!isAllMode && typeof limit === "number") {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: cashBoxes, error, count } = await query;

    if (error) {
      console.error("[GET /api/cash-boxes] Error al obtener cajas:", error);
      return errorResponse("Error al obtener cajas", 500);
    }

    return jsonResponse({
      data: cashBoxes || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: isAllMode ? 1 : Math.ceil((count || 0) / (typeof limit === "number" ? limit : 1)),
      },
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/cash-boxes");
  }
}

// POST /api/cash-boxes - Abrir nueva caja
export async function POST(req: Request) {
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
    const parsed = openCashBoxSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const { date, openingBalance } = parsed.data;

    // Obtener tenant_id del body o header
    let tenantId = body.tenantId || req.headers.get("x-tenant-id");
    
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

    // Verificar que no haya una caja abierta para esta fecha
    const existingOpenBox = await getOpenCashBox(tenantId, date);
    
    if (existingOpenBox) {
      return errorResponse(
        `Ya existe una caja abierta para la fecha ${date.toISOString().split("T")[0]}. Debe cerrar la caja existente antes de abrir una nueva.`,
        400
      );
    }

    // Crear la caja
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const { data: cashBox, error: createError } = await supabase
      .from("cash_boxes")
      .insert({
        tenant_id: tenantId,
        date: `${dateStr}T00:00:00`,
        opening_balance: openingBalance.toString(),
        status: "open",
      })
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/cash-boxes] Error al crear caja:", createError);
      return errorResponse("Error al crear caja", 500);
    }

    // Asociar automáticamente pagos confirmados pendientes
    const associationResult = await associatePendingPaymentsToCashBox(cashBox.id, tenantId);
    
    console.log(`[POST /api/cash-boxes] Caja ${cashBox.id} creada. ${associationResult.count} movimientos asociados automáticamente.`);

    // Obtener conteo de pagos pendientes restantes (si hay)
    const pendingCount = await getPendingPaymentsCount(tenantId);

    return jsonResponse({
      ...cashBox,
      associatedMovements: associationResult.count,
      pendingPaymentsCount: pendingCount,
    }, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/cash-boxes");
  }
}
