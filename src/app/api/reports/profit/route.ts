import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getProfitReport } from "@/lib/report-helpers-sprint7";
import { exportToExcel } from "@/lib/excel-export-sprint7";

// GET /api/reports/profit - Reporte de Ganancias
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

    // Obtener reporte de ganancias
    const profit = await getProfitReport(filters);

    // Exportar a Excel si se solicita
    if (exportExcel) {
      const excelData = [
        {
          "Ingresos Totales": profit.totalRevenue,
          "Costos Totales": profit.totalCost,
          "Ganancia Bruta": profit.grossProfit,
          "Margen Bruto %": profit.grossMargin,
        },
      ];

      const columns = [
        { key: "Ingresos Totales", header: "Ingresos Totales", width: 18 },
        { key: "Costos Totales", header: "Costos Totales", width: 18 },
        { key: "Ganancia Bruta", header: "Ganancia Bruta", width: 18 },
        { key: "Margen Bruto %", header: "Margen Bruto %", width: 18 },
      ];

      const excel = await exportToExcel(excelData, columns, "ganancias");

      return new Response(excel.buffer as any, {
        headers: {
          "Content-Type": excel.contentType,
          "Content-Disposition": `attachment; filename="${excel.filename}"`,
        },
      });
    }

    return jsonResponse(profit);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/profit");
  }
}
