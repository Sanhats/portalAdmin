/**
 * SPRINT 2: Endpoints para gestionar vendedores
 * POST /api/sellers - Crear vendedor
 * GET /api/sellers - Listar vendedores
 */

import { supabase } from "@/lib/supabase";
import { createSellerSchema } from "@/validations/seller";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/sellers - Listar vendedores
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
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido (query param o header x-tenant-id)", 400);
    }

    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/sellers] Error:", error);
      return errorResponse("Error al obtener vendedores", 500, error.message, error.code);
    }

    // Mapear respuesta para incluir todos los campos requeridos
    const sellers = (data || []).map((seller: any) => ({
      id: seller.id,
      tenant_id: seller.tenant_id,
      name: seller.name,
      email: seller.email || null,
      role: seller.role || null,
      is_active: seller.active ?? true,
      active: seller.active ?? true,
      created_at: seller.created_at,
      updated_at: seller.updated_at,
    }));

    return jsonResponse(sellers);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/sellers");
  }
}

// POST /api/sellers - Crear vendedor
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
    const parsed = createSellerSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Obtener tenant_id
    const tenantId = body.tenantId || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido (body o header x-tenant-id)", 400);
    }

    // Preparar datos para insertar
    const insertData: any = {
      tenant_id: tenantId,
      name: parsed.data.name,
      active: parsed.data.active ?? parsed.data.is_active ?? true,
    };

    // Si viene email o role en el body, agregarlos
    if (parsed.data.email) {
      insertData.email = parsed.data.email;
    }
    if (parsed.data.role) {
      insertData.role = parsed.data.role;
    }

    const { data, error } = await supabase
      .from("sellers")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[POST /api/sellers] Error:", error);
      return errorResponse("Error al crear vendedor", 500, error.message, error.code);
    }

    // Mapear respuesta para incluir todos los campos requeridos
    const seller = {
      id: data.id,
      tenant_id: data.tenant_id,
      name: data.name,
      email: data.email || null,
      role: data.role || null,
      is_active: data.active ?? true,
      active: data.active ?? true,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return jsonResponse(seller, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sellers");
  }
}
