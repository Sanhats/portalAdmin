import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { createCustomerSchema } from "@/validations/customer";

// GET /api/customers - Listar clientes
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

    // SPRINT 4: Filtrar por active (soft delete)
    const includeInactive = searchParams.get("includeInactive") === "true";
    
    // Construir query
    let query = supabase
      .from("customers")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId);
    
    // SPRINT 4: Filtrar activos a menos que se solicite incluir inactivos
    if (!includeInactive) {
      query = query.eq("active", true);
    }
    
    query = query.order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar búsqueda si existe
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,document.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/customers] Error al obtener clientes:", error);
      return errorResponse("Error al obtener clientes", 500, error.message, error.code);
    }

    return jsonResponse({
      customers: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/customers");
  }
}

// POST /api/customers - Crear cliente
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
    const parsed = createCustomerSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // SPRINT 4: Validar unicidad de documento por tenant (si existe)
    if (parsed.data.document) {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("document", parsed.data.document)
        .eq("active", true)
        .single();

      if (existingCustomer) {
        return errorResponse("Ya existe un cliente activo con ese documento en este tenant", 409);
      }
    }

    // SPRINT 4: Crear cliente
    const { data: customer, error: createError } = await supabase
      .from("customers")
      .insert({
        tenant_id: tenantId,
        name: parsed.data.name,
        document: parsed.data.document || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        active: parsed.data.active ?? true,
      })
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/customers] Error al crear cliente:", createError);
      
      // Manejar error de unicidad de documento
      if (createError.code === "23505") {
        return errorResponse("Ya existe un cliente con ese documento en este tenant", 409);
      }
      
      return errorResponse("Error al crear cliente", 500, createError.message, createError.code);
    }

    return jsonResponse(customer, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/customers");
  }
}
