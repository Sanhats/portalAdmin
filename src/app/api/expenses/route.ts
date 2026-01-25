import { supabase } from "@/lib/supabase";
import { expenseSchema } from "@/validations/expense";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/expenses - Listar egresos con filtros por fecha
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
    
    // Obtener tenantId del query param o header
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

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = supabase
      .from("expenses")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("date", { ascending: false });

    if (from) {
      // Normalizar fecha de inicio (00:00:00)
      const fromDate = new Date(from + "T00:00:00");
      query = query.gte("date", fromDate.toISOString());
    }
    if (to) {
      // Normalizar fecha de fin (23:59:59)
      const toDate = new Date(to + "T23:59:59");
      query = query.lte("date", toDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/expenses] Error al obtener egresos:", error);
      return errorResponse("Error al obtener egresos", 500, error.message, error.code);
    }

    // Formatear respuesta para coincidir con el formato esperado por el frontend
    const formattedExpenses = (data || []).map((expense: any) => ({
      id: expense.id,
      type: expense.type,
      amount: parseFloat(expense.amount || "0"),
      date: expense.date ? new Date(expense.date).toISOString().split('T')[0], // YYYY-MM-DD
      isRecurring: expense.is_recurring || false,
      created_at: expense.created_at,
    }));

    return jsonResponse(formattedExpenses);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/expenses");
  }
}

// POST /api/expenses - Crear nuevo egreso
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

    // Obtener tenantId del body, header o usar default
    let tenantId = body.tenantId || req.headers.get("x-tenant-id");
    
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
    const parsed = expenseSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const { type, amount, date, isRecurring } = parsed.data;

    // Normalizar fecha: si viene como string YYYY-MM-DD, convertir a Date
    let dateToInsert: Date;
    if (typeof date === 'string') {
      dateToInsert = new Date(date + "T00:00:00");
    } else {
      dateToInsert = date;
    }

    // Crear egreso
    const { data: expense, error: createError } = await supabase
      .from("expenses")
      .insert({
        tenant_id: tenantId,
        type,
        amount: amount.toString(),
        date: dateToInsert.toISOString(),
        is_recurring: isRecurring || false,
      })
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/expenses] Error al crear egreso:", createError);
      return errorResponse("Error al crear egreso", 500, createError.message, createError.code);
    }

    // Formatear respuesta para coincidir con el formato esperado por el frontend
    const formattedExpense = {
      id: expense.id,
      type: expense.type,
      amount: parseFloat(expense.amount || "0"),
      date: expense.date ? new Date(expense.date).toISOString().split('T')[0], // YYYY-MM-DD
      isRecurring: expense.is_recurring || false,
      created_at: expense.created_at,
    };

    return jsonResponse(formattedExpense, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/expenses");
  }
}
