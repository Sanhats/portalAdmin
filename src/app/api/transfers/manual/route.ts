/**
 * SPRINT H: Endpoint para registro manual de transferencias
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { runMatchingEngine } from "@/lib/matching-engine";

const manualTransferSchema = z.object({
  amount: z.number().positive(),
  reference: z.string().optional(),
  origin_label: z.string().optional(),
  raw_description: z.string(),
  received_at: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id es requerido" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = manualTransferSchema.parse(body);

    // Usar fecha actual si no se proporciona
    const receivedAt = parsed.received_at || new Date().toISOString();

    const { data: transfer, error } = await supabase
      .from("incoming_transfers")
      .insert({
        tenant_id: tenantId,
        amount: parsed.amount.toString(),
        reference: parsed.reference || null,
        origin_label: parsed.origin_label || null,
        raw_description: parsed.raw_description,
        received_at: receivedAt,
        source: "manual",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/transfers/manual] Error:", error);
      return NextResponse.json(
        { error: "Error al registrar transferencia", details: error.message },
        { status: 500 }
      );
    }

    // Ejecutar motor de matching
    await runMatchingEngine(tenantId, transfer.id);

    return NextResponse.json({
      success: true,
      transfer,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("[POST /api/transfers/manual] Error:", error);
    return NextResponse.json(
      { error: "Error al procesar transferencia", details: error.message },
      { status: 500 }
    );
  }
}

