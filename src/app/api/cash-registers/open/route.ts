import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { openCashRegisterSchema } from "@/validations/cash-register";
import { openCashRegister } from "@/lib/cash-helpers-sprint6";

// POST /api/cash-registers/open - Abrir caja
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

    // Obtener tenant_id del body, header o usar default
    let tenantId: string | null = body.tenantId || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
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

    // Validar datos
    const parsed = openCashRegisterSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Normalizar openingAmount
    const openingAmount = typeof parsed.data.openingAmount === "string"
      ? parseFloat(parsed.data.openingAmount)
      : (parsed.data.openingAmount || 0);

    // Validar que tenantId no sea null
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Abrir caja
    const result = await openCashRegister(parsed.data.sellerId, tenantId, openingAmount);
    
    if (!result.cashRegisterId) {
      return errorResponse(result.error || "Error al abrir caja", 400);
    }

    // Obtener caja completa
    const { data: cashRegister, error: fetchError } = await supabase
      .from("cash_registers")
      .select(`
        *,
        sellers:seller_id (
          id,
          name
        )
      `)
      .eq("id", result.cashRegisterId)
      .single();

    if (fetchError || !cashRegister) {
      return errorResponse("Error al obtener caja", 500, fetchError?.message);
    }

    return jsonResponse(cashRegister, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/cash-registers/open");
  }
}

// GET /api/cash-registers/open - Obtener caja abierta
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
    const sellerId = searchParams.get("sellerId");
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    if (!sellerId) {
      return errorResponse("sellerId es requerido", 400);
    }

    // Validar que sellerId y tenantId no sean null
    if (!sellerId || !tenantId) {
      return errorResponse("sellerId y tenantId son requeridos", 400);
    }

    // Obtener caja abierta
    const { getOpenCashRegister } = await import("@/lib/cash-helpers-sprint6");
    const { cashRegister, error } = await getOpenCashRegister(sellerId, tenantId);

    if (error) {
      return errorResponse(error, 500);
    }

    if (!cashRegister) {
      return errorResponse("No hay caja abierta para este vendedor", 404);
    }

    // Obtener caja completa con relaciones
    const { data: cashRegisterWithRelations, error: fetchError } = await supabase
      .from("cash_registers")
      .select(`
        *,
        sellers:seller_id (
          id,
          name
        )
      `)
      .eq("id", cashRegister.id)
      .single();

    if (fetchError || !cashRegisterWithRelations) {
      return jsonResponse(cashRegister);
    }

    return jsonResponse(cashRegisterWithRelations);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/cash-registers/open");
  }
}
