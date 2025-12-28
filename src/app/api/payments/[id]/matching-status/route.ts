/**
 * SPRINT L: Señales claras para Frontend
 * Expone el estado de matching y sugerencias de transferencias para un pago
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener pago con información de matching
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Pago no encontrado" },
        { status: 404 }
      );
    }

    const confidence = parseFloat(payment.match_confidence || "0");
    const matchResult = payment.match_result || "no_match";
    const matchedTransferId = payment.matched_transfer_id;

    // Obtener transferencia sugerida si existe
    let suggestedTransfer = null;
    if (matchedTransferId) {
      const { data: transfer, error: transferError } = await supabase
        .from("incoming_transfers")
        .select("*")
        .eq("id", matchedTransferId)
        .single();

      if (!transferError && transfer) {
        suggestedTransfer = {
          id: transfer.id,
          amount: parseFloat(transfer.amount),
          origin: transfer.origin_label || "Desconocido",
          received_at: transfer.received_at,
          raw_description: transfer.raw_description,
        };
      }
    }

    // Determinar mensaje para el frontend
    let message = "";
    let action = "none";

    if (matchResult === "matched_auto") {
      message = "Pago confirmado automáticamente";
      action = "confirmed";
    } else if (matchResult === "matched_suggested") {
      message = "Detectamos una transferencia compatible. ¿Confirmar?";
      action = "suggest";
    } else {
      message = "Esperando transferencia";
      action = "waiting";
    }

    return NextResponse.json({
      status: payment.status,
      confidence: confidence,
      match_result: matchResult,
      suggested_transfer: suggestedTransfer,
      message: message,
      action: action,
      payment: {
        id: payment.id,
        amount: parseFloat(payment.amount),
        reference: payment.reference,
        created_at: payment.created_at,
      },
    });
  } catch (error: any) {
    console.error("[GET /api/payments/:id/matching-status] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener estado de matching", details: error.message },
      { status: 500 }
    );
  }
}

