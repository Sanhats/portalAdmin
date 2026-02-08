/**
 * SPRINT 12: Endpoints para gestión de sucursales
 * GET /api/branches - Listar sucursales
 * POST /api/branches - Crear sucursal
 */

import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

const createBranchSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().min(1, "El nombre es requerido"),
  address: z.string().optional(),
  active: z.boolean().default(true),
});

const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  active: z.boolean().optional(),
});

// GET /api/branches - Listar sucursales
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
    const activeOnly = searchParams.get("activeOnly") === "true";

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Construir query
    let query = supabase
      .from("branches")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("active", true);
    }

    const { data: branches, error } = await query;

    if (error) {
      console.error("[GET /api/branches] Error:", error);
      return errorResponse("Error al obtener sucursales", 500, error.message);
    }

    return jsonResponse(branches || []);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/branches");
  }
}

// POST /api/branches - Crear sucursal
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
    
    // Obtener tenantId del body o header
    const tenantId = body.tenantId || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar datos
    const parsed = createBranchSchema.safeParse({ ...body, tenantId });
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Crear sucursal
    const { data: branch, error: createError } = await supabase
      .from("branches")
      .insert({
        tenant_id: tenantId,
        name: parsed.data.name,
        address: parsed.data.address || null,
        active: parsed.data.active ?? true,
      })
      .select()
      .single();

    if (createError || !branch) {
      console.error("[POST /api/branches] Error:", createError);
      return errorResponse("Error al crear sucursal", 500, createError?.message);
    }

    return jsonResponse(branch, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/branches");
  }
}
