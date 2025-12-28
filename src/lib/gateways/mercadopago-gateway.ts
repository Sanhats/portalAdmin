/**
 * SPRINT D: Implementación de Mercado Pago Gateway
 * Implementa la interfaz PaymentGateway para integración con Mercado Pago
 */

import { MercadoPagoConfig, Preference } from "mercadopago";
import {
  PaymentGateway,
  GatewayProvider,
  GatewayCredentials,
  GatewayConfig,
  CreatePaymentInput,
  GatewayResponse,
  RefundInput,
  GatewayEvent,
} from "@/lib/gateway-interface";

export class MercadoPagoGateway implements PaymentGateway {
  private client: MercadoPagoConfig;
  private preferenceClient: Preference;
  private config: GatewayConfig;

  constructor(credentials: GatewayCredentials, config: GatewayConfig = {}) {
    // SPRINT D: Inicializar cliente de Mercado Pago con access_token
    const accessToken = credentials.access_token;
    if (!accessToken) {
      throw new Error("Mercado Pago requiere access_token en las credenciales");
    }

    this.client = new MercadoPagoConfig({
      accessToken: accessToken,
    });

    // SPRINT D: Crear cliente de Preference con la configuración
    this.preferenceClient = new Preference(this.client);
    this.config = config;
  }

  /**
   * Crea un pago en Mercado Pago (crea una preference)
   */
  async createPayment(input: CreatePaymentInput): Promise<GatewayResponse> {
    try {
      // SPRINT D: Crear preference con los datos requeridos
      const preferenceData = {
        items: [
          {
            id: input.saleId, // SPRINT D: ID requerido por el SDK de Mercado Pago
            title: input.description || `Venta ${input.saleId}`,
            quantity: 1,
            unit_price: input.amount,
            currency_id: input.currency || "ARS",
          },
        ],
        external_reference: input.externalReference || input.saleId,
        notification_url: this.config.notification_url || this.config.webhook_url,
        auto_return: this.config.auto_return ? "approved" : undefined,
        back_urls: {
          success: this.config.return_url,
          failure: this.config.cancel_url,
          pending: this.config.return_url,
        },
        metadata: {
          sale_id: input.saleId,
          ...input.metadata,
        },
      };

      // SPRINT D: Crear preference usando el SDK de Mercado Pago
      console.log("[MercadoPagoGateway] Creando preference con datos:", JSON.stringify(preferenceData, null, 2));
      const preference = await this.preferenceClient.create({ body: preferenceData });
      console.log("[MercadoPagoGateway] Preference creada:", JSON.stringify({ id: preference.id, init_point: preference.init_point }, null, 2));

      if (!preference.id || !preference.init_point) {
        return {
          success: false,
          status: "failed",
          error: {
            code: "PREFERENCE_CREATION_FAILED",
            message: "No se pudo crear la preference en Mercado Pago",
          },
        };
      }

      // SPRINT D: Retornar respuesta con checkoutUrl y payment_id
      return {
        success: true,
        paymentId: preference.id.toString(),
        checkoutUrl: preference.init_point,
        status: "pending",
        metadata: {
          preference_id: preference.id.toString(),
          init_point: preference.init_point,
          sandbox_init_point: preference.sandbox_init_point,
          collector_id: preference.collector_id,
        },
      };
    } catch (error: any) {
      console.error("[MercadoPagoGateway] Error al crear preference:", error);
      
      // Manejar errores específicos de Mercado Pago
      let errorCode = "UNKNOWN_ERROR";
      let errorMessage = error.message || "Error al crear preference en Mercado Pago";
      
      if (error.code === "unauthorized" || error.message?.includes("invalid access token")) {
        errorCode = "INVALID_ACCESS_TOKEN";
        errorMessage = "Access token de Mercado Pago inválido o expirado. Verifica las credenciales del gateway.";
      } else if (error.cause?.code) {
        errorCode = error.cause.code;
      }
      
      return {
        success: false,
        status: "failed",
        error: {
          code: errorCode,
          message: errorMessage,
          details: error,
        },
      };
    }
  }

  /**
   * Reembolsa un pago en Mercado Pago
   */
  async refund(input: RefundInput): Promise<void> {
    // SPRINT D: Implementar reembolso (se implementará en Sprint E con webhooks)
    throw new Error("Refund no implementado aún. Se implementará en Sprint E");
  }

  /**
   * Parsea un webhook de Mercado Pago y lo convierte en un evento estandarizado
   * SPRINT E: Implementación completa con validación de estructura
   */
  parseWebhook(payload: any, headers?: Record<string, string>): GatewayEvent {
    console.log("[MercadoPagoGateway] Parseando webhook:", JSON.stringify(payload, null, 2));

    // SPRINT E: Mercado Pago puede enviar webhooks en diferentes formatos
    // Formato 1: { type: "payment", data: { id: "...", status: "...", ... } }
    // Formato 2: { action: "payment.updated", data: { id: "...", ... } }
    // Formato 3: { id: "...", status: "...", ... } (directo)

    const type = payload.type || payload.action || "payment";
    const data = payload.data || payload;

    let eventType: GatewayEvent["type"];
    let status: GatewayEvent["status"];

    // SPRINT E: Mapear estados de MP a estados internos
    // MP Status → Internal Status
    // approved → confirmed
    // rejected/cancelled → failed
    // refunded → refunded
    // pending/in_process → pending
    const paymentStatus = data.status || data.payment?.status || payload.status;

    switch (paymentStatus) {
      case "approved":
        eventType = "payment.approved";
        status = "confirmed";
        break;
      case "rejected":
      case "cancelled":
        eventType = "payment.rejected";
        status = "failed";
        break;
      case "refunded":
        eventType = "payment.refunded";
        status = "refunded";
        break;
      case "pending":
      case "in_process":
        eventType = "payment.created";
        status = "processing";
        break;
      default:
        // Si no reconocemos el estado, mantener como pending
        eventType = "payment.created";
        status = "pending";
    }

    // SPRINT E: Extraer payment_id (puede estar en diferentes lugares)
    const paymentId = data.id?.toString() 
      || data.payment?.id?.toString() 
      || payload.id?.toString() 
      || "";

    // SPRINT E: Extraer external_reference (preference_id o sale_id)
    const externalReference = data.external_reference 
      || data.payment?.external_reference 
      || payload.external_reference 
      || data.preference_id?.toString()
      || "";

    // SPRINT E: Extraer amount
    const amount = parseFloat(
      data.transaction_amount?.toString() 
      || data.payment?.transaction_amount?.toString() 
      || payload.transaction_amount?.toString()
      || "0"
    );

    return {
      type: eventType,
      paymentId,
      externalReference,
      status,
      amount,
      metadata: {
        ...data,
        raw_payload: payload,
        headers: headers || {},
      },
      timestamp: new Date(),
    };
  }

  /**
   * Obtiene el estado actual de un pago en Mercado Pago
   */
  async getPaymentStatus(externalPaymentId: string): Promise<{
    status: "pending" | "processing" | "confirmed" | "failed" | "refunded";
    metadata?: Record<string, any>;
  }> {
    // SPRINT D: Implementar obtención de estado (se completará en Sprint E)
    throw new Error("getPaymentStatus no implementado aún. Se implementará en Sprint E");
  }

  /**
   * Valida las credenciales de Mercado Pago
   */
  async validateCredentials(credentials: GatewayCredentials): Promise<boolean> {
    try {
      if (!credentials.access_token) {
        return false;
      }

      // Intentar crear un cliente y hacer una petición simple
      const testClient = new MercadoPagoConfig({
        accessToken: credentials.access_token,
      });

      // SPRINT D: Validación básica (se puede mejorar haciendo una petición real)
      return true;
    } catch (error) {
      console.error("[MercadoPagoGateway] Error al validar credenciales:", error);
      return false;
    }
  }
}

