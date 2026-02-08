import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getSalesSummary } from "@/lib/report-helpers-sprint7";
import { exportToExcel, flattenDataForExcel } from "@/lib/excel-export-sprint7";
import { supabase } from "@/lib/supabase";

// GET /api/reports/sales/summary - Resumen General de Ventas
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

    // Obtener tenant_id del header o query
    let finalTenantId: string | null = tenantId;
    
    if (!finalTenantId) {
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (!defaultStore) {
        return errorResponse("No se encontró store por defecto. Proporciona tenantId", 400);
      }
      
      finalTenantId = defaultStore.id;
    }

    // Filtros
    const filters = {
      tenantId: finalTenantId!,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      sellerId: searchParams.get("sellerId") || undefined,
      customerId: searchParams.get("customerId") || undefined,
    };

    // Obtener resumen
    const summary = await getSalesSummary(filters);

    // Exportar a Excel si se solicita
    if (exportExcel) {
      const excelData = [
        {
          "Total Ventas": summary.totalSales,
          "Cantidad de Tickets": summary.totalTickets,
          "Ticket Promedio": summary.averageTicket,
          "Total Descuentos": summary.totalDiscounts,
          "Total Facturado": summary.totalAmount,
          "Ventas Confirmadas": summary.confirmedSales,
          "Ventas Canceladas": summary.cancelledSales,
        },
      ];

      const columns = [
        { key: "Total Ventas", header: "Total Ventas", width: 15 },
        { key: "Cantidad de Tickets", header: "Cantidad de Tickets", width: 20 },
        { key: "Ticket Promedio", header: "Ticket Promedio", width: 15 },
        { key: "Total Descuentos", header: "Total Descuentos", width: 15 },
        { key: "Total Facturado", header: "Total Facturado", width: 15 },
        { key: "Ventas Confirmadas", header: "Ventas Confirmadas", width: 20 },
        { key: "Ventas Canceladas", header: "Ventas Canceladas", width: 20 },
      ];

      const excel = await exportToExcel(excelData, columns, "resumen-ventas");

      return new Response(excel.buffer as any, {
        headers: {
          "Content-Type": excel.contentType,
          "Content-Disposition": `attachment; filename="${excel.filename}"`,
        },
      });
    }

    return jsonResponse(summary);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/sales/summary");
  }
}
