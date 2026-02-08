import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getReplenishmentReport } from "@/lib/report-helpers-sprint7";
import { exportToExcel } from "@/lib/excel-export-sprint7";

// GET /api/reports/replenishment - Reposición por Proveedor
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

    // Obtener reporte de reposición
    const replenishment = await getReplenishmentReport(filters);

    // Exportar a Excel si se solicita
    if (exportExcel) {
      const excelData = replenishment.map((item) => ({
        "Producto": item.productName,
        "SKU": item.productSku,
        "Stock Actual": item.stockCurrent,
        "Stock Mínimo": item.stockMin,
        "Cantidad Sugerida": item.suggestedQuantity,
        "Proveedor": item.supplierName,
      }));

      const columns = [
        { key: "Producto", header: "Producto", width: 30 },
        { key: "SKU", header: "SKU", width: 15 },
        { key: "Stock Actual", header: "Stock Actual", width: 15 },
        { key: "Stock Mínimo", header: "Stock Mínimo", width: 15 },
        { key: "Cantidad Sugerida", header: "Cantidad Sugerida", width: 20 },
        { key: "Proveedor", header: "Proveedor", width: 30 },
      ];

      const excel = await exportToExcel(excelData, columns, "reposicion");

      return new Response(excel.buffer as any, {
        headers: {
          "Content-Type": excel.contentType,
          "Content-Disposition": `attachment; filename="${excel.filename}"`,
        },
      });
    }

    return jsonResponse({
      replenishment,
      total: replenishment.length,
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/replenishment");
  }
}
