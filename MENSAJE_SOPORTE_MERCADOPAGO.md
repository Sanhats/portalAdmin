# 📧 Mensaje para Soporte de Mercado Pago

---

## Asunto

Error 404 "Point of sale not found" al generar QR dinámicos con In-Store API

---

## Información del Cliente

- **User ID (Collector ID):** `1231202386`
- **Application Number:** `6056863249479510`
- **Access Token:** `APP_USR-6056863249479510-122803-be1893d7a5c544305a180bbe51abc4b1-1231202386`
- **POS ID:** `123439423`
- **Tenant ID:** `5fc90125-23b9-4200-bd86-c6edba203f16`

---

## Problema

Al intentar generar códigos QR dinámicos usando la **API de Mercado Pago In-Store**, obtenemos el error:

```json
{
  "error": "pos_obtainment_error",
  "message": "Point of sale not found",
  "status": 404,
  "causes": []
}
```

### Endpoint utilizado

```
POST https://api.mercadopago.com/instore/orders/qr/seller/collectors/1231202386/pos/123439423/qrs
```

### Request enviado

```json
{
  "external_reference": "sale-id-123",
  "title": "Venta sale-id-123",
  "description": "Pago de venta sale-id-123",
  "total_amount": 1000.00,
  "items": [
    {
      "sku_number": "sale-id-123",
      "category": "VENTA",
      "title": "Venta sale-id-123",
      "description": "Pago de venta sale-id-123",
      "unit_price": 1000.00,
      "quantity": 1,
      "unit_measure": "unit",
      "total_amount": 1000.00
    }
  ],
  "notification_url": "https://nuestra-app.com/api/webhooks/mercadopago"
}
```

---

## Verificaciones Realizadas

✅ **Access Token válido:**
- El token pertenece al usuario `1231202386`
- Funciona correctamente para Checkout API (pagos online)
- No genera errores de autenticación (401)

✅ **User ID correcto:**
- Coincide con el del access token
- Verificado mediante endpoint `/users/me`

✅ **POS existe y está activo:**
- ID numérico: `123439423`
- Estado: Activo
- Tipo: QR Code
- **Nota:** El POS no tiene `external_id` asignado (campo `null`)

**Listado de POS obtenido:**
```json
{
  "results": [
    {
      "id": "123439423",
      "name": "POS Principal",
      "external_id": null,
      "fixed_amount": false,
      "category": 621102,
      "store_id": "69325483"
    }
  ]
}
```

---

## Intentos de Solución

### Intento 1: Usar ID numérico del POS
- **Endpoint:** `/pos/123439423/qrs`
- **Resultado:** ❌ `404 - Point of sale not found`

### Intento 2: Crear nuevo POS con external_id
- **Endpoint:** `POST /pos`
- **Body:** `{ "name": "POS_Toludev", "external_id": "POS_TOLUDEV_NEW", ... }`
- **Resultado:** ❌ `400 - Bad Request` (no se puede crear con external_id)

### Intento 3: Verificar permisos de aplicación
- **Aplicación anterior:** Tenía integración "CódigoQR" → Mismo error 404
- **Aplicación actual:** Tiene "CheckoutAPI" → Mismo error 404
- **Conclusión:** El problema no parece ser de permisos de aplicación

---

## Preguntas para Soporte

1. **¿El endpoint requiere `external_id` en lugar de ID numérico?**
   - Si es así, ¿cómo asignamos un `external_id` a un POS existente?
   - ¿Por qué la API de creación de POS rechaza el `external_id`?

2. **¿El POS necesita configuración adicional para In-Store API?**
   - ¿Hay algún paso de activación que no hemos realizado?
   - ¿El POS debe estar asociado a una tienda específica?

3. **¿La aplicación necesita permisos adicionales?**
   - Aunque la aplicación anterior tenía "CódigoQR" y daba el mismo error
   - ¿Hay algún scope o permiso específico que debamos solicitar?

4. **¿El formato del endpoint es correcto?**
   - Endpoint actual: `/instore/orders/qr/seller/collectors/{userId}/pos/{externalPosId}/qrs`
   - ¿Debería ser diferente para nuestro caso de uso?

---

## Solución Temporal Implementada

Hemos implementado un sistema de fallback que genera QR genérico cuando Mercado Pago In-Store falla. Esto nos permite continuar operando, pero:

- ❌ El QR no es escaneable por la app de Mercado Pago
- ❌ Requiere confirmación manual del pago
- ❌ No se integra con el ecosistema de Mercado Pago

**Necesitamos resolver esto para ofrecer la mejor experiencia de usuario.**

---

## Impacto en el Negocio

- ⚠️ **Funcionalidad limitada:** No podemos generar QR escaneables por la app de Mercado Pago
- ⚠️ **Experiencia de usuario:** Requiere confirmación manual del pago
- ✅ **Sistema operativo:** El QR genérico permite continuar operando

---

## Información Adicional

- **Documentación consultada:** [Mercado Pago In-Store API - QR Code Generation](https://www.mercadopago.com.ar/developers/es/docs/qr-code/integration-api/qr-code-generation)
- **Código implementado:** Según la documentación oficial
- **Logs disponibles:** Tenemos logging completo del error para debugging

---

## Contacto

Por favor, contactarnos para coordinar una sesión de debugging o para solicitar más información técnica si es necesario.

**Gracias por su asistencia.**

---

*Fecha del reporte: $(Get-Date -Format "yyyy-MM-dd")*

