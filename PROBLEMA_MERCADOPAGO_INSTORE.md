# 🚨 Problema Técnico: Mercado Pago In-Store API - Error 404

## 📋 Resumen Ejecutivo

Al intentar generar códigos QR dinámicos usando la **API de Mercado Pago In-Store**, obtenemos el error `404 - "Point of sale not found"`, a pesar de que:
- ✅ El POS existe y está activo en Mercado Pago
- ✅ El access token es válido y pertenece al usuario correcto
- ✅ El código de integración está correctamente implementado según la documentación oficial
- ✅ El mismo error ocurrió con una aplicación anterior que tenía la integración "CódigoQR" habilitada

**Estado actual:** El sistema funciona usando QR genérico como fallback, pero no podemos generar QR escaneables por la app de Mercado Pago.

---

## 🔍 Detalles Técnicos

### Endpoint Utilizado

```
POST https://api.mercadopago.com/instore/orders/qr/seller/collectors/{userId}/pos/{externalPosId}/qrs
```

**Documentación oficial:** [Mercado Pago In-Store API - QR Code Generation](https://www.mercadopago.com.ar/developers/es/docs/qr-code/integration-api/qr-code-generation)

### Configuración Actual

- **User ID (Collector ID):** `1231202386`
- **Access Token:** `APP_USR-6056863249479510-122803-be1893d7a5c544305a180bbe51abc4b1-1231202386`
- **POS ID (numérico):** `123439423`
- **POS External ID:** Vacío (no asignado)
- **Aplicación Mercado Pago:**
  - Número: `6056863249479510`
  - Integración: `CheckoutAPI`
  - API integrada: `API Pagos`

### Error Obtenido

```json
{
  "error": "pos_obtainment_error",
  "message": "Point of sale not found",
  "status": 404,
  "causes": []
}
```

### Request Enviado

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

## 🔬 Investigación Realizada

### 1. Verificación de Credenciales

✅ **Access Token válido:**
- El token pertenece al usuario `1231202386`
- Funciona correctamente para Checkout API (pagos online)
- No genera errores de autenticación (401)

✅ **User ID correcto:**
- Coincide con el del access token
- Verificado mediante endpoint `/users/me`

### 2. Verificación del POS

✅ **POS existe:**
- ID numérico: `123439423`
- Estado: Activo
- Tipo: QR Code
- **Problema:** No tiene `external_id` asignado

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

### 3. Intentos de Solución

#### Intento 1: Usar ID numérico del POS
- **Endpoint:** `/pos/123439423/qrs`
- **Resultado:** ❌ `404 - Point of sale not found`

#### Intento 2: Crear nuevo POS con external_id
- **Endpoint:** `POST /pos`
- **Body:** `{ "name": "POS_Toludev", "external_id": "POS_TOLUDEV_NEW", ... }`
- **Resultado:** ❌ `400 - Bad Request` (no se puede crear con external_id)

#### Intento 3: Verificar permisos de aplicación
- **Aplicación anterior:** Tenía integración "CódigoQR" → Mismo error 404
- **Aplicación actual:** Tiene "CheckoutAPI" → Mismo error 404
- **Conclusión:** El problema no parece ser de permisos de aplicación

### 4. Análisis del Código

✅ **Implementación correcta:**
- El código sigue la documentación oficial de Mercado Pago
- Manejo de errores adecuado
- Logging completo para debugging
- Fallback a QR genérico implementado

**Ubicación del código:** `src/lib/qr-helpers.ts` (función `generateMercadoPagoQR`)

---

## 💡 Soluciones Alternativas Implementadas

### Solución Actual: QR Genérico (Funcionando)

El sistema detecta automáticamente cuando Mercado Pago In-Store falla y genera un QR genérico usando la librería `qrcode`.

**Ventajas:**
- ✅ Funciona inmediatamente
- ✅ No requiere configuración adicional
- ✅ Útil para testing y desarrollo

**Limitaciones:**
- ❌ No es escaneable por la app de Mercado Pago
- ❌ Requiere confirmación manual del pago
- ❌ No se integra con el ecosistema de Mercado Pago

**Implementación:**
```typescript
// Fallback automático en src/lib/qr-helpers.ts
if (mercadoPagoFails) {
  return generateGenericQR(saleId, amount, qrType);
}
```

---

## 🎯 Recomendaciones para Soporte

### Preguntas para Mercado Pago

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

### Información para Proporcionar a Mercado Pago

- **User ID:** `1231202386`
- **Application Number:** `6056863249479510`
- **POS ID:** `123439423`
- **Error:** `404 - Point of sale not found`
- **Endpoint:** `POST /instore/orders/qr/seller/collectors/1231202386/pos/123439423/qrs`
- **Access Token:** `APP_USR-6056863249479510-122803-be1893d7a5c544305a180bbe51abc4b1-1231202386`

---

## 📊 Impacto en el Negocio

### Impacto Actual

- ⚠️ **Funcionalidad limitada:** No podemos generar QR escaneables por la app de Mercado Pago
- ✅ **Sistema operativo:** El QR genérico permite continuar operando
- ⚠️ **Experiencia de usuario:** Requiere confirmación manual del pago

### Impacto si se Resuelve

- ✅ **Mejor UX:** Pagos instantáneos escaneando QR con la app de Mercado Pago
- ✅ **Automatización:** Confirmación automática de pagos vía webhooks
- ✅ **Integración completa:** Conexión total con el ecosistema de Mercado Pago

---

## 🔧 Plan de Acción Recomendado

### Corto Plazo (Inmediato)

1. ✅ **Mantener QR genérico como solución temporal**
   - Ya está implementado y funcionando
   - Permite continuar operando mientras se resuelve

2. 📧 **Contactar a Mercado Pago Soporte**
   - Proporcionar toda la información técnica detallada arriba
   - Solicitar asistencia específica para el error 404

### Mediano Plazo (1-2 semanas)

3. 🔍 **Investigar alternativas**
   - Verificar si hay otros endpoints de Mercado Pago para QR
   - Evaluar si podemos usar Checkout API con QR estático

4. 📝 **Documentar solución**
   - Una vez resuelto, documentar los pasos necesarios
   - Actualizar guías de configuración

### Largo Plazo (Si no se resuelve)

5. 🔄 **Evaluar otros proveedores**
   - Considerar otros gateways de pago con soporte QR
   - Mantener arquitectura flexible para múltiples proveedores

---

## 📝 Notas Adicionales

### Evidencia del Problema

- **Logs del sistema:** Disponibles en `src/lib/qr-helpers.ts` con logging completo
- **Scripts de prueba:** `test-mercadopago-instore-direct.ps1` reproduce el error
- **Historial:** El mismo error ocurrió con aplicación anterior que tenía "CódigoQR"

### Arquitectura del Sistema

- **Multi-tenant:** Soporta múltiples tiendas
- **Gateway abstraction:** Interfaz abstracta para múltiples proveedores
- **Fallback automático:** Sistema robusto con manejo de errores

### Contacto Técnico

Para más detalles técnicos o acceso a logs, contactar al equipo de desarrollo.

---

**Fecha del reporte:** $(Get-Date -Format "yyyy-MM-dd")
**Estado:** Pendiente de resolución con Mercado Pago
**Prioridad:** Media (sistema funciona con alternativa)

