import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getCancelledSales } from "@/lib/report-helpers-sprint7";
import { exportToExcel, flattenDataForExcel } from "@/lib/excel-export-sprint7";

// GET /api/reports/cancellations - Ventas Canceladas
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
    const limit = parseInt(searchParams.get("limit") || "50");
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

    // Obtener ventas canceladas
    const allCancellations = await getCancelledSales(filters);

    // Exportar a Excel si se solicita
    if (exportExcel) {
      const flattenedCancellations = flattenDataForExcel(allCancellations);

      const excelData = flattenedCancellations.map((cancel: any) => ({
        "ID Venta": cancel.id,
        "Fecha": cancel.date,
        "Fecha Cancelación": cancel.updated_at,
        "Cliente": cancel.customers_name || "Mostrador",
        "Vendedor": cancel.sellers_name || "Sin vendedor",
        "Total": cancel.total,
        "Impacto Económico": cancel.economicImpact,
      }));

      const columns = [
        { key: "ID Venta", header: "ID Venta", width: 40 },
        { key: "Fecha", header: "Fecha", width: 20 },
        { key: "Fecha Cancelación", header: "Fecha Cancelación", width: 20 },
        { key: "Cliente", header: "Cliente", width: 30 },
        { key: "Vendedor", header: "Vendedor", width: 30 },
        { key: "Total", header: "Total", width: 15 },
        { key: "Impacto Económico", header: "Impacto Económico", width: 20 },
      ];

      const excel = await exportToExcel(excelData, columns, "ventas-canceladas");

      return new Response(excel.buffer as any, {
        headers: {
          "Content-Type": excel.contentType,
          "Content-Disposition": `attachment; filename="${excel.filename}"`,
        },
      });
    }

    // Paginación para JSON
    const paginatedCancellations = allCancellations.slice(offset, offset + limit);

    // Calcular totales
    const totalImpact = allCancellations.reduce(
      (sum, cancel) => sum + (cancel.economicImpact || 0),
      0
    );

    return jsonResponse({
      cancellations: paginatedCancellations,
      summary: {
        total: allCancellations.length,
        totalImpact,
      },
      pagination: {
        page,
        limit,
        total: allCancellations.length,
        totalPages: Math.ceil(allCancellations.length / limit),
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/cancellations");
  }
}
