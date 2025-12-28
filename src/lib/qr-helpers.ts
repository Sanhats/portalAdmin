/**
 * Helper functions para generación de QR codes
 * Soporta Mercado Pago In-Store API y QR genérico
 */

import { supabase } from "@/lib/supabase";
import { GatewayFactory } from "@/lib/gateway-interface";

export interface QRGenerationResult {
  qr_code: string; // URL o base64 del QR
  qr_payload: string; // Payload del QR (EMVCo o genérico)
  provider: string; // 'mercadopago' | 'generic_qr'
  expires_at?: string; // ISO-8601 timestamp (opcional)
}

/**
 * Genera un QR code para un pago
 * Intenta usar Mercado Pago In-Store API si está configurado, sino usa QR genérico
 */
export async function generateQRPayment(
  tenantId: string,
  saleId: string,
  amount: number,
  qrType: "static" | "dynamic" = "dynamic"
): Promise<QRGenerationResult> {
  try {
    // Intentar obtener gateway de Mercado Pago configurado
    const { data: mpGateway, error: gatewayError } = await supabase
      .from("payment_gateways")
      .select("id, provider, credentials, config, enabled")
      .eq("tenant_id", tenantId)
      .eq("provider", "mercadopago")
      .eq("enabled", true)
      .single();

    // Si hay un gateway de Mercado Pago configurado y habilitado, intentar usarlo
    if (mpGateway && !gatewayError && mpGateway.credentials) {
      try {
        const qrResult = await generateMercadoPagoQR(
          mpGateway.credentials as any,
          saleId,
          amount,
          qrType
        );
        return qrResult;
      } catch (error) {
        console.warn("[generateQRPayment] Error al generar QR con Mercado Pago, usando genérico:", error);
        // Continuar con QR genérico si falla MP
      }
    }

    // Fallback: Generar QR genérico
    return generateGenericQR(saleId, amount, qrType);
  } catch (error) {
    console.error("[generateQRPayment] Error al generar QR:", error);
    // En caso de error, generar QR genérico
    return generateGenericQR(saleId, amount, qrType);
  }
}

/**
 * Genera QR usando Mercado Pago In-Store API
 * Nota: Mercado Pago In-Store requiere un access token con permisos específicos
 * Para usar esta función, el tenant debe tener configurado user_id y external_pos_id en el gateway config
 */
async function generateMercadoPagoQR(
  credentials: { access_token?: string },
  saleId: string,
  amount: number,
  qrType: "static" | "dynamic"
): Promise<QRGenerationResult> {
  const accessToken = credentials.access_token || process.env.MERCADOPAGO_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error("Mercado Pago access token no disponible");
  }

  // Para QR dinámico, usar Mercado Pago In-Store API
  // Documentación: https://www.mercadopago.com.ar/developers/es/docs/qr-code/integration-api/qr-code-generation
  // NOTA: Esta implementación requiere user_id y external_pos_id configurados en el gateway
  // Por ahora, si no están configurados, usar QR genérico
  
  // TODO: Obtener user_id y external_pos_id del gateway config
  // Por ahora, lanzar error para que use QR genérico
  throw new Error("Mercado Pago In-Store requiere configuración adicional (user_id, external_pos_id). Usando QR genérico.");
  
  // Código futuro cuando se configure:
  /*
  if (qrType === "dynamic") {
    try {
      const userId = config.user_id; // Obtener del gateway config
      const externalPosId = config.external_pos_id; // Obtener del gateway config
      
      const response = await fetch(`https://api.mercadopago.com/instore/orders/qr/seller/collectors/${userId}/pos/${externalPosId}/qrs`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_reference: saleId,
          title: `Venta ${saleId}`,
          description: `Pago de venta ${saleId}`,
          notification_url: process.env.NEXT_PUBLIC_APP_URL 
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`
            : undefined,
          total_amount: amount,
          items: [
            {
              sku_number: saleId,
              category: "VENTA",
              title: `Venta ${saleId}`,
              description: `Pago de venta ${saleId}`,
              unit_price: amount,
              quantity: 1,
              unit_measure: "unit",
              total_amount: amount,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mercado Pago API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const qrData = await response.json();

      return {
        qr_code: qrData.qr_data || qrData.qr_code || "",
        qr_payload: qrData.qr_data || "",
        provider: "mercadopago",
        expires_at: qrData.expiration_date || undefined,
      };
    } catch (error: any) {
      console.error("[generateMercadoPagoQR] Error al crear QR con Mercado Pago In-Store:", error);
      throw error;
    }
  } else {
    return generateGenericQR(saleId, amount, qrType);
  }
  */
}

/**
 * Genera un QR genérico (fallback)
 * Usa formato EMVCo básico o datos simples
 */
async function generateGenericQR(
  saleId: string,
  amount: number,
  qrType: "static" | "dynamic"
): Promise<QRGenerationResult> {
  // Generar payload EMVCo básico o datos simples
  const timestamp = new Date().toISOString();
  
  if (qrType === "dynamic") {
    // QR dinámico: incluir datos del pago
    const qrPayload = JSON.stringify({
      sale_id: saleId,
      amount: amount,
      timestamp: timestamp,
      type: "payment",
    });
    
    // Generar código QR base64 usando librería qrcode
    const qrCodeBase64 = await generateQRCodeBase64(qrPayload);
    
    return {
      qr_code: qrCodeBase64, // Base64 del QR image
      qr_payload: qrPayload, // Payload JSON
      provider: "generic_qr",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
    };
  } else {
    // QR estático: usar datos fijos
    const qrPayload = `VENTA:${saleId}`;
    const qrCodeBase64 = await generateQRCodeBase64(qrPayload);
    
    return {
      qr_code: qrCodeBase64,
      qr_payload: qrPayload,
      provider: "generic_qr",
    };
  }
}

/**
 * Genera un código QR en formato base64 usando la librería qrcode
 */
async function generateQRCodeBase64(data: string): Promise<string> {
  try {
    // Importar dinámicamente para evitar problemas de SSR
    const QRCode = (await import('qrcode')).default;
    
    // Generar QR como data URL (base64)
    const qrCodeBase64 = await QRCode.toDataURL(data, {
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeBase64;
  } catch (error) {
    console.error("[generateQRCodeBase64] Error al generar QR:", error);
    // Fallback: retornar placeholder si falla la generación
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }
}

/**
 * Detecta si un método de pago es de tipo QR
 */
export function isQRPaymentMethod(
  paymentMethod: { type?: string; payment_category?: string; metadata?: any } | null
): boolean {
  if (!paymentMethod) return false;
  
  // Detectar por type
  if (paymentMethod.type === "qr") return true;
  
  // Detectar por payment_category (legacy)
  if (paymentMethod.payment_category === "qr") return true;
  
  // Detectar por metadata.provider
  if (paymentMethod.metadata?.provider === "mercadopago_qr") return true;
  
  return false;
}

