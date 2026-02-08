import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { createSupplierSchema, updateSupplierSchema } from "@/validations/supplier";
import { z } from "zod";

// GET /api/suppliers - Listar proveedores
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

    // Asegurar que tenantId es string (TypeScript)
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Paginación
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Búsqueda
    const search = searchParams.get("search");

    // SPRINT 3: Filtrar por is_active (soft delete)
    const includeInactive = searchParams.get("includeInactive") === "true";
    
    // Construir query
    let query = supabase
      .from("suppliers")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId);
    
    // SPRINT 3: Filtrar activos a menos que se solicite incluir inactivos
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    
    query = query.order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar búsqueda si existe
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/suppliers] Error al obtener proveedores:", error);
      return errorResponse("Error al obtener proveedores", 500, error.message, error.code);
    }

    return jsonResponse({
      suppliers: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/suppliers");
  }
}

// POST /api/suppliers - Crear proveedor
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
    const parsed = createSupplierSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // SPRINT 3: Crear proveedor con contact_name e is_active
    const { data: supplier, error: createError } = await supabase
      .from("suppliers")
      .insert({
        tenant_id: tenantId,
        name: parsed.data.name,
        contact_name: parsed.data.contactName || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
        is_active: parsed.data.isActive ?? true,
      })
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/suppliers] Error al crear proveedor:", createError);
      return errorResponse("Error al crear proveedor", 500, createError.message, createError.code);
    }

    return jsonResponse(supplier, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/suppliers");
  }
}
