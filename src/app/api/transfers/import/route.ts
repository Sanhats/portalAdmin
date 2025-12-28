/**
 * SPRINT H-J: Importación de movimientos entrantes
 * Permite importar transferencias recibidas desde CSV, JSON o API
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { runMatchingEngine } from "@/lib/matching-engine";
import { autoConfirmPayment } from "@/lib/payment-confirmation";

// Schema de validación para transferencia entrante
const incomingTransferSchema = z.object({
  amount: z.number().positive(),
  reference: z.string().optional(),
  origin_label: z.string().optional(),
  raw_description: z.string(),
  received_at: z.string().datetime(),
  source: z.enum(["api", "csv", "manual"]).default("manual"),
});

const importTransfersSchema = z.object({
  transfers: z.array(incomingTransferSchema).min(1),
});

export async function POST(req: NextRequest) {
  try {
    // Obtener tenant_id del header (asumimos que viene del middleware de autenticación)
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id es requerido" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = importTransfersSchema.parse(body);

    // Insertar transferencias en batch
    const transfersToInsert = parsed.transfers.map((transfer) => ({
      tenant_id: tenantId,
      amount: transfer.amount.toString(),
      reference: transfer.reference || null,
      origin_label: transfer.origin_label || null,
      raw_description: transfer.raw_description,
      received_at: transfer.received_at,
      source: transfer.source,
    }));

    const { data: insertedTransfers, error } = await supabase
      .from("incoming_transfers")
      .insert(transfersToInsert)
      .select();

    if (error) {
      console.error("[POST /api/transfers/import] Error al insertar transferencias:", error);
      return NextResponse.json(
        { error: "Error al importar transferencias", details: error.message },
        { status: 500 }
      );
    }

    console.log(`[POST /api/transfers/import] ${insertedTransfers.length} transferencias importadas`);

    // Ejecutar motor de matching automático (Sprint I)
    // Esto se ejecutará en background, pero podemos hacerlo aquí también
    for (const transfer of insertedTransfers) {
      const matchingResults = await runMatchingEngine(tenantId, transfer.id);
      
      // Procesar auto-confirmaciones (Sprint K)
      for (const result of matchingResults) {
        if (result.matchResult === "matched_auto" && result.confidence >= 0.9) {
          await autoConfirmPayment(
            result.paymentId,
            result.transferId,
            result.confidence,
            result.reasons
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: insertedTransfers.length,
      transfers: insertedTransfers,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("[POST /api/transfers/import] Error:", error);
    return NextResponse.json(
      { error: "Error al procesar importación", details: error.message },
      { status: 500 }
    );
  }
}
