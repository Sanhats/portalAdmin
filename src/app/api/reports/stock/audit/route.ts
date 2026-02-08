import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getStockAudit } from "@/lib/report-helpers-sprint7";
import { exportToExcel, flattenDataForExcel } from "@/lib/excel-export-sprint7";

// GET /api/reports/stock/audit - Auditoría de Stock
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
    const exportExcel = searchParams.get("export") === "excel";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = (page - 1) * limit;

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Filtros
    const filters = {
      tenantId,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      sellerId: searchParams.get("sellerId") || undefined,
      customerId: searchParams.get("customerId") || undefined,
    };

    // Obtener auditoría de stock
    const allMovements = await getStockAudit(filters);

    // Exportar a Excel si se solicita
    if (exportExcel) {
      const flattenedMovements = flattenDataForExcel(allMovements);

      const excelData = flattenedMovements.map((mov: any) => ({
        "Fecha": mov.created_at,
        "Producto": mov.products_name_internal || mov.products_sku || "N/A",
        "SKU": mov.products_sku || "",
        "Tipo": mov.type,
        "Cantidad": mov.quantity,
        "Referencia": mov.reference_type || "",
        "ID Referencia": mov.reference_id || "",
      }));

      const columns = [
        { key: "Fecha", header: "Fecha", width: 20 },
        { key: "Producto", header: "Producto", width: 30 },
        { key: "SKU", header: "SKU", width: 15 },
        { key: "Tipo", header: "Tipo", width: 15 },
        { key: "Cantidad", header: "Cantidad", width: 15 },
        { key: "Referencia", header: "Referencia", width: 15 },
        { key: "ID Referencia", header: "ID Referencia", width: 40 },
      ];

      const excel = await exportToExcel(excelData, columns, "auditoria-stock");

      return new Response(excel.buffer as any, {
        headers: {
          "Content-Type": excel.contentType,
          "Content-Disposition": `attachment; filename="${excel.filename}"`,
        },
      });
    }

    // Paginación para JSON
    const paginatedMovements = allMovements.slice(offset, offset + limit);

    return jsonResponse({
      movements: paginatedMovements,
      pagination: {
        page,
        limit,
        total: allMovements.length,
        totalPages: Math.ceil(allMovements.length / limit),
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/stock/audit");
  }
}
