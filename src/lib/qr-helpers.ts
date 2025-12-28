/**
 * Helper functions para generación de QR codes
 * Soporta Mercado Pago In-Store API y QR genérico
 */

import { supabase } from "@/lib/supabase";
import { GatewayFactory } from "@/lib/gateway-interface";
import { crc16ccitt } from "crc";

export interface QRGenerationResult {
  qr_code: string; // URL o base64 del QR
  qr_payload: string; // Payload del QR (EMVCo o genérico)
  provider: string; // 'mercadopago_instore' | 'generic_qr' | 'interoperable_qr'
  expires_at?: string; // ISO-8601 timestamp (opcional)
  reference?: string; // Referencia única del pago (ej: SALE-8F3A)
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
    // SPRINT G: Prioridad 1: Intentar QR Interoperable si está configurado
    const { data: interoperableGateway, error: interoperableError } = await supabase
      .from("payment_gateways")
      .select("id, provider, config, enabled")
      .eq("tenant_id", tenantId)
      .eq("provider", "interoperable_qr")
      .eq("enabled", true)
      .single();

    if (interoperableGateway && !interoperableError) {
      console.log(`[generateQRPayment] Gateway QR Interoperable encontrado`);
      try {
        // Parsear config si viene como string
        let config = interoperableGateway.config;
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch {
            console.warn("[generateQRPayment] No se pudo parsear config como JSON");
          }
        }
        
        const cbu = config?.merchant_cbu || config?.merchant_cvu;
        const merchantName = config?.merchant_name;
        
        if (cbu) {
          // Generar reference única
          const reference = `SALE-${saleId.substring(0, 8).toUpperCase()}`;
          
          const qrResult = await generateInteroperableQR(
            saleId,
            amount,
            reference,
            tenantId,
            cbu,
            merchantName
          );
          console.log(`[generateQRPayment] ✅ QR Interoperable generado`);
          return qrResult;
        } else {
          console.warn("[generateQRPayment] Gateway interoperable_qr configurado pero sin CBU/CVU");
        }
      } catch (error: any) {
        console.error("[generateQRPayment] Error al generar QR Interoperable:", error);
        console.warn("[generateQRPayment] Continuando con otros métodos...");
      }
    }

    // Prioridad 2: Intentar obtener gateway de Mercado Pago configurado
    const { data: mpGateway, error: gatewayError } = await supabase
      .from("payment_gateways")
      .select("id, provider, credentials, config, enabled")
      .eq("tenant_id", tenantId)
      .eq("provider", "mercadopago")
      .eq("enabled", true)
      .single();

    // Si hay un gateway de Mercado Pago configurado y habilitado, intentar usarlo
    if (mpGateway && !gatewayError && mpGateway.credentials) {
      console.log(`[generateQRPayment] Gateway Mercado Pago encontrado`);
      
      try {
        // Parsear config si viene como string (JSONB puede venir como string)
        let config = mpGateway.config;
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch {
            console.warn("[generateQRPayment] No se pudo parsear config como JSON");
          }
        }
        
        const qrResult = await generateMercadoPagoQR(
          mpGateway.credentials as any,
          config,
          saleId,
          amount,
          qrType
        );
        console.log(`[generateQRPayment] ✅ QR generado con Mercado Pago In-Store`);
        return qrResult;
      } catch (error: any) {
        console.error("[generateQRPayment] Error al generar QR con Mercado Pago:", error);
        console.warn("[generateQRPayment] Usando QR genérico como fallback");
        // Continuar con QR genérico si falla MP
      }
    }

    // Fallback: Generar QR genérico
    console.log(`[generateQRPayment] Usando QR genérico (fallback)`);
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
 * Requiere: mercadopago_user_id (collector_id) y mercadopago_external_pos_id configurados
 * 
 * Fuentes de configuración (en orden de prioridad):
 * 1. Gateway config (config.mercadopago_user_id, config.mercadopago_external_pos_id)
 * 2. Variables de entorno (MERCADOPAGO_USER_ID, MERCADOPAGO_EXTERNAL_POS_ID)
 */
async function generateMercadoPagoQR(
  credentials: { access_token?: string },
  config: any,
  saleId: string,
  amount: number,
  qrType: "static" | "dynamic"
): Promise<QRGenerationResult> {
  const accessToken = credentials.access_token || process.env.MERCADOPAGO_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error("Mercado Pago access token no disponible");
  }

  // Obtener user_id y external_pos_id (prioridad: config > env)
  // El config puede venir como objeto o como string JSON desde Supabase
  let parsedConfig = config;
  if (typeof config === 'string') {
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      console.warn("[generateMercadoPagoQR] No se pudo parsear config como JSON");
    }
  }
  
  const userId = parsedConfig?.mercadopago_user_id || process.env.MERCADOPAGO_USER_ID;
  const externalPosId = parsedConfig?.mercadopago_external_pos_id || process.env.MERCADOPAGO_EXTERNAL_POS_ID;

  console.log(`[generateMercadoPagoQR] Valores obtenidos:`, {
    userId,
    externalPosId,
    fromConfig: !!parsedConfig?.mercadopago_user_id,
    fromEnv: !!process.env.MERCADOPAGO_USER_ID,
  });

  if (!userId || !externalPosId) {
    throw new Error(
      `Mercado Pago In-Store requiere configuración: user_id=${userId ? '✅' : '❌'}, external_pos_id=${externalPosId ? '✅' : '❌'}. ` +
      `Configura en gateway.config o variables de entorno (MERCADOPAGO_USER_ID, MERCADOPAGO_EXTERNAL_POS_ID)`
    );
  }

  // Solo QR dinámico usa In-Store API
  if (qrType !== "dynamic") {
    console.log("[generateMercadoPagoQR] QR estático no soportado por In-Store, usando genérico");
    return generateGenericQR(saleId, amount, qrType);
  }

  try {
    console.log(`[generateMercadoPagoQR] Creando QR In-Store con user_id=${userId}, external_pos_id=${externalPosId}`);
    
    // Llamar a Mercado Pago In-Store API
    // Documentación: https://www.mercadopago.com.ar/developers/es/docs/qr-code/integration-api/qr-code-generation
    // Nota: El endpoint puede requerir external_id en lugar de ID numérico
    // Si externalPosId es numérico y no funciona, puede que necesitemos buscar el external_id del POS
    const apiUrl = `https://api.mercadopago.com/instore/orders/qr/seller/collectors/${userId}/pos/${externalPosId}/qrs`;
    
    console.log(`[generateMercadoPagoQR] Endpoint URL: ${apiUrl}`);
    
    const notificationUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`
      : undefined;

    // Formato según documentación de Mercado Pago In-Store API
    // Nota: El formato puede variar según la versión de la API
    const requestBody: any = {
      external_reference: saleId,
      title: `Venta ${saleId}`,
      description: `Pago de venta ${saleId}`,
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
    };
    
    // Agregar notification_url solo si está disponible
    if (notificationUrl) {
      requestBody.notification_url = notificationUrl;
    }

    console.log(`[generateMercadoPagoQR] Request URL: ${apiUrl}`);
    console.log(`[generateMercadoPagoQR] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorData: any = {};
      let errorText = "";
      
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json();
        } else {
          errorText = await response.text();
        }
      } catch (e) {
        errorText = `No se pudo leer respuesta: ${e}`;
      }
      
      console.error(`[generateMercadoPagoQR] Error ${response.status}:`, errorData || errorText);
      console.error(`[generateMercadoPagoQR] Request URL: ${apiUrl}`);
      console.error(`[generateMercadoPagoQR] Request body:`, JSON.stringify(requestBody, null, 2));
      
      // Mensaje de error más descriptivo
      let errorMessage = `Mercado Pago In-Store API error: ${response.status}`;
      if (errorData?.message) {
        errorMessage += ` - ${errorData.message}`;
      } else if (errorText) {
        errorMessage += ` - ${errorText}`;
      }
      
      // Si es 401 "user not found", puede ser problema de permisos o formato
      if (response.status === 401 && (errorData?.message?.includes("user not found") || errorText?.includes("user not found"))) {
        errorMessage += "\nPosibles causas:\n";
        errorMessage += "- El access token no tiene permisos para In-Store API\n";
        errorMessage += "- El user_id no coincide con el del access token\n";
        errorMessage += "- El access token necesita permisos adicionales en Mercado Pago Dashboard";
      }
      
      throw new Error(errorMessage);
    }

    const qrData = await response.json();
    console.log(`[generateMercadoPagoQR] ✅ QR creado exitosamente:`, {
      qr_data_length: qrData.qr_data?.length || 0,
      expiration_date: qrData.expiration_date,
      in_store_order_id: qrData.in_store_order_id,
    });

    // Mercado Pago devuelve el QR en formato EMVCo (qr_data)
    // Generar imagen QR del payload para que sea renderizable
    const qrCodeBase64 = await generateQRCodeBase64(qrData.qr_data);

    return {
      qr_code: qrCodeBase64, // Imagen QR en base64
      qr_payload: qrData.qr_data, // Payload EMVCo de Mercado Pago
      provider: "mercadopago_instore",
      expires_at: qrData.expiration_date || undefined,
    };
  } catch (error: any) {
    console.error("[generateMercadoPagoQR] Error al crear QR con Mercado Pago In-Store:", error);
    throw error;
  }
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
 * SPRINT G: Genera QR Interoperable con formato EMVCo Argentina (Transferencias 3.0)
 * Escaneable por cualquier billetera: MODO, Naranja X, MP, Bancos, etc.
 * 
 * @param saleId ID de la venta
 * @param amount Monto del pago (null para monto abierto)
 * @param reference Referencia única del pago (ej: SALE-8F3A)
 * @param tenantId ID del tenant (requerido para obtener configuración)
 * @param cbu CVU/CBU del comercio (opcional, se obtiene de BD o env si no se proporciona)
 * @param merchantName Nombre del comercio (opcional, se obtiene de BD o env si no se proporciona)
 * @returns QR interoperable en formato EMVCo Argentina
 */
export async function generateInteroperableQR(
  saleId: string,
  amount: number | null,
  reference: string,
  tenantId: string,
  cbu?: string,
  merchantName?: string
): Promise<QRGenerationResult> {
  try {
    // Generar referencia única si no se proporciona
    const paymentReference = reference || `SALE-${saleId.substring(0, 8).toUpperCase()}`;
    
    // Obtener configuración del comercio (prioridad: parámetros > BD > env)
    const merchantConfig = await getMerchantConfig(tenantId, cbu, merchantName);
    
    if (!merchantConfig.cbu) {
      throw new Error(
        "CBU/CVU del comercio no configurado. " +
        "Configura en payment_gateways (provider='interoperable_qr') o variables de entorno (MERCHANT_CBU/MERCHANT_CVU)"
      );
    }
    
    // Generar payload EMVCo Argentina según especificación Transferencias 3.0
    // Formato: https://www.bcra.gob.ar/Noticias/BCRA-otro-paso-pagos-QR.asp
    let qrPayload = "";
    
    // Obtener Merchant Category Code de configuración (opcional)
    const merchantCategoryCode = merchantConfig.merchantCategoryCode || 
                                  process.env.MERCHANT_CATEGORY_CODE || 
                                  undefined; // Por defecto usa "5492" en buildEMVCoPayload
    
    if (amount !== null && amount > 0) {
      // QR con monto fijo
      qrPayload = buildEMVCoPayload({
        type: "fixed",
        amount: amount,
        reference: paymentReference,
        cbu: merchantConfig.cbu,
        merchantName: merchantConfig.name,
        merchantCategoryCode: merchantCategoryCode,
      });
    } else {
      // QR con monto abierto (el usuario ingresa el monto)
      qrPayload = buildEMVCoPayload({
        type: "open",
        reference: paymentReference,
        cbu: merchantConfig.cbu,
        merchantName: merchantConfig.name,
        merchantCategoryCode: merchantCategoryCode,
      });
    }
    
    // Generar imagen QR en base64
    const qrCodeBase64 = await generateQRCodeBase64(qrPayload);
    
    // Calcular expiración (30 minutos por defecto)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    console.log(`[generateInteroperableQR] QR interoperable generado:`, {
      reference: paymentReference,
      amount: amount || "abierto",
      provider: "interoperable_qr",
    });
    
    return {
      qr_code: qrCodeBase64,
      qr_payload: qrPayload,
      provider: "interoperable_qr",
      expires_at: expiresAt,
      reference: paymentReference,
    };
  } catch (error: any) {
    console.error("[generateInteroperableQR] Error al generar QR interoperable:", error);
    throw new Error(`Error al generar QR interoperable: ${error.message}`);
  }
}

/**
 * Obtiene configuración del comercio para QR interoperable
 * Prioridad: parámetros > payment_gateways config > stores > variables de entorno
 */
async function getMerchantConfig(
  tenantId: string,
  providedCBU?: string,
  providedName?: string
): Promise<{ cbu?: string; name: string; merchantCategoryCode?: string }> {
  // Si se proporcionan parámetros, usarlos directamente
  if (providedCBU && providedName) {
    return { cbu: providedCBU, name: providedName };
  }

  try {
    // Intentar obtener desde payment_gateways (provider='interoperable_qr')
    const { data: gateway, error: gatewayError } = await supabase
      .from("payment_gateways")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", "interoperable_qr")
      .eq("enabled", true)
      .single();

    if (!gatewayError && gateway?.config) {
      const config = typeof gateway.config === 'string' 
        ? JSON.parse(gateway.config) 
        : gateway.config;
      
      const cbu = providedCBU || config.merchant_cbu || config.merchant_cvu;
      const name = providedName || config.merchant_name;
      const mcc = config.merchant_category_code;
      
      if (cbu && name) {
        return { cbu, name, merchantCategoryCode: mcc };
      }
    }

    // Intentar obtener desde stores (nombre del comercio)
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("name")
      .eq("id", tenantId)
      .single();

    const storeName = !storeError && store?.name ? store.name : undefined;

    // Combinar con variables de entorno
    const cbu = providedCBU || process.env.MERCHANT_CBU || process.env.MERCHANT_CVU;
    const name = providedName || storeName || process.env.MERCHANT_NAME || "Comercio";

    return { cbu, name };
  } catch (error) {
    console.warn("[getMerchantConfig] Error al obtener configuración, usando fallback:", error);
    // Fallback a variables de entorno
    return {
      cbu: providedCBU || process.env.MERCHANT_CBU || process.env.MERCHANT_CVU,
      name: providedName || process.env.MERCHANT_NAME || "Comercio",
    };
  }
}

/**
 * Construye payload EMVCo Argentina para Transferencias 3.0
 * Formato basado en especificación BCRA para QR interoperable
 */
function buildEMVCoPayload(params: {
  type: "fixed" | "open";
  amount?: number;
  reference: string;
  cbu?: string;
  merchantName: string;
  merchantCategoryCode?: string; // Opcional: código de categoría del comercio (ej: "5492" para Retail)
}): string {
  // Formato EMVCo simplificado para Argentina
  // Estructura básica: 00 (Payload Format Indicator) + 01 (Point of Initiation) + 26 (Merchant Account Info) + 52 (Merchant Category) + 53 (Currency) + 54 (Amount) + 58 (Country) + 59 (Merchant Name) + 60 (Merchant City) + 62 (Additional Data)
  
  let payload = "";
  
  // 00: Payload Format Indicator (2 dígitos)
  payload += "00" + padLength("01", 2); // "01" = QR Code
  
  // 01: Point of Initiation Method (2 dígitos)
  // "11" = Dynamic QR (monto puede cambiar), "12" = Static QR (monto fijo)
  // Para QR interoperable, usamos "12" (static) porque el QR contiene toda la información necesaria
  // Esto es más compatible con todas las billeteras
  payload += "01" + padLength("12", 2); // Siempre static para interoperable
  
  // 26: Merchant Account Information (hasta 99 caracteres)
  if (params.cbu) {
    // Validar y normalizar CBU/CVU (debe tener exactamente 22 dígitos)
    const normalizedCBU = params.cbu.replace(/\D/g, ""); // Remover caracteres no numéricos
    if (normalizedCBU.length !== 22) {
      throw new Error(`CBU/CVU debe tener exactamente 22 dígitos. Recibido: ${normalizedCBU.length} dígitos`);
    }
    
    // Truncar reference a máximo 25 caracteres si es necesario
    const normalizedReference = params.reference.substring(0, 25);
    
    // Formato EMVCo para Argentina Transferencias 3.0:
    // 00 (GUI) + 01 (CBU/CVU) + 02 (Reference)
    const accountInfo = 
      "00" + padLength("AR", 2) + // GUI Argentina (longitud 2 dígitos)
      "01" + padLength(normalizedCBU, 2) + // CBU/CVU (longitud 2 dígitos para 22 caracteres)
      "02" + padLength(normalizedReference, 2); // Reference (longitud 2 dígitos)
    
    // Validar que el campo 26 no exceda 99 caracteres
    if (accountInfo.length > 99) {
      throw new Error(`Merchant Account Information excede 99 caracteres: ${accountInfo.length}`);
    }
    
    payload += "26" + padLength(accountInfo, 2);
  }
  
  // 52: Merchant Category Code (4 dígitos)
  // Usar código válido en lugar de "0000" para mejor compatibilidad
  // "5492" = Retail (comercio minorista) - código comúnmente aceptado
  const mcc = params.merchantCategoryCode || "5492";
  
  // Validar que MCC sea string y tenga exactamente 4 dígitos
  if (typeof mcc !== "string") {
    throw new Error(`Merchant Category Code debe ser string, recibido: ${typeof mcc}`);
  }
  if (mcc.length !== 4) {
    throw new Error(`Merchant Category Code debe tener 4 dígitos, recibido: "${mcc}" (${mcc.length} caracteres)`);
  }
  
  // Generar campo 52: [ID][LENGTH][VALUE]
  const campo52 = "52" + padLength(mcc, 2);
  payload += campo52;
  
  // Debug logging (remover en producción)
  if (process.env.NODE_ENV === "development") {
    console.log(`[buildEMVCoPayload] Campo 52 - MCC: "${mcc}", Longitud: ${mcc.length}, Campo completo: "${campo52}"`);
  }
  
  // 53: Transaction Currency (3 dígitos)
  payload += "53" + padLength("032", 2); // Longitud siempre 2 dígitos en EMVCo
  
  // 54: Transaction Amount (hasta 13 dígitos, sin decimales en formato EMVCo)
  // Solo incluir si es monto fijo
  if (params.type === "fixed" && params.amount && params.amount > 0) {
    // Formato EMVCo: monto sin decimales (ej: 1000.00 -> "100000")
    const amountStr = Math.round(params.amount * 100).toString();
    // Validar que no exceda 13 dígitos
    if (amountStr.length > 13) {
      throw new Error(`Transaction Amount excede 13 dígitos: ${amountStr.length}`);
    }
    payload += "54" + padLength(amountStr, 2);
  }
  
  // 58: Country Code (2 dígitos)
  payload += "58" + padLength("AR", 2); // AR = Argentina
  
  // 59: Merchant Name (hasta 25 caracteres)
  const merchantName = params.merchantName.substring(0, 25);
  payload += "59" + padLength(merchantName, 2);
  
  // 60: Merchant City (hasta 15 caracteres)
  payload += "60" + padLength("Argentina", 2); // Ciudad por defecto
  
  // 62: Additional Data Field Template
  // Incluir reference en el campo adicional
  const normalizedRef = params.reference.substring(0, 25); // Máximo 25 caracteres
  const additionalData = "05" + padLength(normalizedRef, 2); // 05 = Reference Label, longitud 2 dígitos
  payload += "62" + padLength(additionalData, 2);
  
  // 63: CRC (Cyclic Redundancy Check) - 4 dígitos hexadecimales
  // Algoritmo CRC16-CCITT según especificación EMVCo
  // El CRC se calcula sobre el payload completo + campo 63 con longitud (sin el valor del CRC)
  const payloadSinCRC = payload; // Payload sin campo 63
  const dataParaCRC = payloadSinCRC + "6304"; // Agregar campo 63 con longitud 04
  
  // Usar librería 'crc' para calcular CRC16-CCITT correctamente
  // EMVCo usa CRC16-CCITT con inicialización 0xFFFF (no XModem que usa 0x0000)
  // crc16ccitt es la variante correcta para EMVCo QR codes
  const crc = crc16ccitt(dataParaCRC);
  const crcHex = crc.toString(16).toUpperCase().padStart(4, "0"); // 4 dígitos hexadecimales en mayúsculas
  
  // Debug logging (remover en producción)
  if (process.env.NODE_ENV === "development") {
    console.log(`[buildEMVCoPayload] CRC - Data para CRC (completo): "${dataParaCRC}"`);
    console.log(`[buildEMVCoPayload] CRC - Longitud del payload: ${dataParaCRC.length} caracteres`);
    console.log(`[buildEMVCoPayload] CRC - CRC calculado: "${crcHex}"`);
  }
  
  payload += "63" + padLength(crcHex, 2); // Campo 63 con longitud 2 dígitos (04) + CRC
  
  return payload;
}

// Nota: La función calculateCRC16CCITT fue reemplazada por la librería 'crc'
// que proporciona una implementación probada y confiable de CRC16-CCITT
// La librería 'crc' se importa al inicio del archivo: import { crc16ccitt } from "crc";

/**
 * Formatea longitud de campo EMVCo
 */
function padLength(value: string, lengthDigits: number): string {
  const length = value.length.toString().padStart(lengthDigits, "0");
  return length + value;
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

