/**
 * SPRINT C: Gateway Abstraction Interface
 * Contrato que deben implementar todos los gateways de pago
 */

export type GatewayProvider = 'mercadopago' | 'qr' | 'pos' | 'stripe' | 'paypal' | 'other';

export interface GatewayCredentials {
  access_token?: string;
  public_key?: string;
  secret_key?: string;
  client_id?: string;
  client_secret?: string;
  [key: string]: any; // Permite credenciales adicionales según el provider
}

export interface GatewayConfig {
  webhook_url?: string;
  notification_url?: string;
  auto_return?: boolean;
  return_url?: string;
  cancel_url?: string;
  [key: string]: any; // Permite configuración adicional según el provider
}

export interface CreatePaymentInput {
  saleId: string;
  amount: number;
  currency?: string;
  description?: string;
  externalReference?: string;
  metadata?: Record<string, any>;
}

export interface GatewayResponse {
  success: boolean;
  paymentId?: string; // ID del pago en el gateway externo
  checkoutUrl?: string; // URL para redirigir al usuario (si aplica)
  qrCode?: string; // Código QR (si aplica)
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  metadata?: Record<string, any>; // Metadata adicional del gateway
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface RefundInput {
  paymentId: string; // ID del pago en nuestro sistema
  amount?: number; // Monto parcial (si no se especifica, reembolso total)
  reason?: string;
}

export interface GatewayEvent {
  type: 'payment.created' | 'payment.approved' | 'payment.rejected' | 'payment.refunded' | 'payment.cancelled';
  paymentId: string; // ID del pago en el gateway externo
  externalReference: string; // sale_id o referencia externa
  status: 'pending' | 'processing' | 'confirmed' | 'failed' | 'refunded';
  amount: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Contrato que deben implementar todos los gateways de pago
 */
export interface PaymentGateway {
  /**
   * Crea un pago en el gateway externo
   */
  createPayment(input: CreatePaymentInput): Promise<GatewayResponse>;

  /**
   * Reembolsa un pago (total o parcial)
   */
  refund(input: RefundInput): Promise<void>;

  /**
   * Parsea un webhook del gateway y lo convierte en un evento estandarizado
   */
  parseWebhook(payload: any, headers?: Record<string, string>): GatewayEvent;

  /**
   * Obtiene el estado actual de un pago en el gateway externo
   */
  getPaymentStatus(externalPaymentId: string): Promise<{
    status: 'pending' | 'processing' | 'confirmed' | 'failed' | 'refunded';
    metadata?: Record<string, any>;
  }>;

  /**
   * Valida las credenciales del gateway
   */
  validateCredentials(credentials: GatewayCredentials): Promise<boolean>;
}

/**
 * Factory para crear instancias de gateways según el provider
 */
export class GatewayFactory {
  private static gateways: Map<GatewayProvider, new (credentials: GatewayCredentials, config: GatewayConfig) => PaymentGateway> = new Map();

  /**
   * Registra un gateway implementation
   */
  static register(
    provider: GatewayProvider,
    gatewayClass: new (credentials: GatewayCredentials, config: GatewayConfig) => PaymentGateway
  ): void {
    this.gateways.set(provider, gatewayClass);
  }

  /**
   * Crea una instancia de gateway según el provider
   */
  static create(
    provider: GatewayProvider,
    credentials: GatewayCredentials,
    config: GatewayConfig = {}
  ): PaymentGateway {
    const GatewayClass = this.gateways.get(provider);
    if (!GatewayClass) {
      throw new Error(`Gateway provider '${provider}' no está registrado`);
    }
    return new GatewayClass(credentials, config);
  }

  /**
   * Verifica si un provider está registrado
   */
  static isRegistered(provider: GatewayProvider): boolean {
    return this.gateways.has(provider);
  }

  /**
   * Inicializa los gateways por defecto
   * Se llama manualmente desde los endpoints que lo necesiten
   */
  static initialize(): void {
    // SPRINT D: Registrar Mercado Pago Gateway
    if (!this.isRegistered("mercadopago")) {
      try {
        // Import dinámico para evitar problemas de carga circular
        import("@/lib/gateways/mercadopago-gateway").then((module) => {
          this.register("mercadopago", module.MercadoPagoGateway);
        }).catch((error) => {
          console.warn("[GatewayFactory] No se pudo registrar MercadoPagoGateway:", error);
        });
      } catch (error) {
        console.warn("[GatewayFactory] No se pudo registrar MercadoPagoGateway:", error);
      }
    }
  }
}

