# 🏪 Guía de Configuración: Mercado Pago In-Store QR POS

Esta guía explica cómo configurar Mercado Pago In-Store para generar QR codes escaneables por la app de Mercado Pago.

---

## 📋 Requisitos Previos

1. **Access Token de Mercado Pago** (ya configurado)
   - Debe ser `APP_USR-...` (producción) o `TEST-...` (sandbox)
   - Configurado en `MERCADOPAGO_ACCESS_TOKEN` o en `payment_gateways.credentials.access_token`

2. **User ID (Collector ID)**
   - Es el ID numérico del comercio en Mercado Pago
   - Se obtiene del Dashboard o del endpoint `/users/me`

3. **External POS ID**
   - ID lógico del punto de venta
   - Ejemplos: `CAJA_1`, `SUCURSAL_CENTRO`, `POS_TUCUMAN_01`

---

## 🔧 Opción 1: Configuración por Tenant (Recomendada)

### Paso 1: Obtener User ID

**Método A: Dashboard de Mercado Pago**
1. Ingresar a [Mercado Pago](https://www.mercadopago.com.ar/)
2. Ir a **Tu negocio** → **Configuración**
3. El **Collector ID** aparece en la información de la cuenta

**Método B: API**
```bash
curl -X GET \
  'https://api.mercadopago.com/users/me' \
  -H 'Authorization: Bearer APP_USR-...'
```

Respuesta:
```json
{
  "id": 123456789,
  ...
}
```

### Paso 2: Crear POS en Mercado Pago

**⚠️ IMPORTANTE:** El Dashboard de Mercado Pago NO permite asignar directamente un `external_pos_id` personalizado. Debes usar la API.

**Opción Recomendada: Usar API**

```bash
curl -X POST \
  'https://api.mercadopago.com/pos' \
  -H 'Authorization: Bearer APP_USR-...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "POS Principal",
    "fixed_amount": false,
    "category": 621102,
    "external_id": "POS_TUCUMAN_01"
  }'
```

**Parámetros:**
- `name`: Nombre descriptivo del POS
- `external_id`: **Este es tu `mercadopago_external_pos_id`** (ej: `POS_TUCUMAN_01`)
- `fixed_amount`: `false` para QR dinámico (monto variable)
- `category`: `621102` = Retail/Comercio

**Ver guía completa:** Ver `GUIA_CREAR_POS_MERCADOPAGO.md` para instrucciones detalladas.

### Paso 3: Configurar en el Backend

**Opción A: Via API (PUT /api/payment-gateways/:id)**

```json
PUT /api/payment-gateways/{gateway_id}
{
  "config": {
    "mercadopago_user_id": "123456789",
    "mercadopago_external_pos_id": "POS_TUCUMAN_01",
    "notification_url": "https://tu-dominio.com/api/webhooks/mercadopago",
    "auto_return": false
  }
}
```

**Opción B: Via SQL**

```sql
UPDATE payment_gateways
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{mercadopago_user_id}',
  '"123456789"'
)
WHERE provider = 'mercadopago' AND tenant_id = '<tu-tenant-id>';

UPDATE payment_gateways
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{mercadopago_external_pos_id}',
  '"POS_TUCUMAN_01"'
)
WHERE provider = 'mercadopago' AND tenant_id = '<tu-tenant-id>';
```

---

## 🔧 Opción 2: Variables de Entorno (Fallback)

Si no se configura en la BD, el sistema usa variables de entorno como fallback:

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-7769103304624140-122801-...
MERCADOPAGO_USER_ID=123456789
MERCADOPAGO_EXTERNAL_POS_ID=POS_TUCUMAN_01
```

**Nota:** Esta opción es menos flexible para multi-tenant, pero útil para desarrollo/testing.

---

## ✅ Verificación de Configuración

### 1. Verificar en Base de Datos

```sql
SELECT 
  id,
  provider,
  enabled,
  config->>'mercadopago_user_id' as user_id,
  config->>'mercadopago_external_pos_id' as external_pos_id
FROM payment_gateways
WHERE provider = 'mercadopago';
```

### 2. Probar Generación de QR

```bash
POST /api/sales/{sale_id}/payments/qr
{
  "qrType": "dynamic"
}
```

**Respuesta esperada:**
```json
{
  "id": "...",
  "status": "pending",
  "amount": 1000,
  "gateway_metadata": {
    "qr_code": "data:image/png;base64,...",
    "qr_payload": "000201010212...",
    "provider": "mercadopago_instore",
    "expires_at": "2024-12-23T11:00:00Z"
  }
}
```

### 3. Logs Correctos

Buscar en los logs del servidor:
```
[generateMercadoPagoQR] ✅ QR generado con Mercado Pago In-Store
user_id: 123456789
external_pos_id: POS_TUCUMAN_01
```

### 4. Prueba Real con App

1. Crear pago QR desde el frontend
2. Abrir app Mercado Pago en el celular
3. Escanear el QR generado
4. ✅ **Debería aparecer**: Monto + Nombre del comercio

---

## 🐛 Troubleshooting

### Error: "Mercado Pago In-Store requiere configuración"

**Causa:** Faltan `user_id` o `external_pos_id`

**Solución:**
1. Verificar que están en `payment_gateways.config` o en variables de entorno
2. Verificar que el gateway está `enabled = true`

### Error: "Mercado Pago API error: 401"

**Causa:** Access token inválido o expirado

**Solución:**
1. Verificar que el token es `APP_USR-...` (no `TEST-...` para producción)
2. Regenerar token desde el Dashboard de Mercado Pago

### Error: "Mercado Pago API error: 404"

**Causa:** `user_id` o `external_pos_id` incorrectos

**Solución:**
1. Verificar que el `user_id` corresponde al collector_id correcto
2. Verificar que el `external_pos_id` existe en Mercado Pago
3. Verificar que el POS está activo

### QR generado pero no escaneable

**Causa:** Se está usando QR genérico en lugar de Mercado Pago In-Store

**Solución:**
1. Verificar logs: debería decir `mercadopago_instore`, no `generic_qr`
2. Verificar configuración completa
3. Verificar que el gateway está habilitado

---

## 📊 Estados de QR

| Estado | Provider | Escaneable MP | Uso |
|--------|----------|---------------|-----|
| QR Genérico | `generic_qr` | ❌ No | Testing / Fallback |
| MP Checkout | `mercadopago` | ✅ Sí (online) | Pagos online |
| MP In-Store | `mercadopago_instore` | ✅✅ Sí (POS) | POS físico real |

---

## 🎯 Checklist de Configuración

- [ ] Access Token configurado (`APP_USR-...`)
- [ ] User ID obtenido (collector_id)
- [ ] POS creado en Mercado Pago
- [ ] External POS ID asignado
- [ ] Configuración guardada en BD o env
- [ ] Gateway habilitado (`enabled = true`)
- [ ] QR generado con `provider: "mercadopago_instore"`
- [ ] QR escaneable con app Mercado Pago
- [ ] Webhook configurado (opcional pero recomendado)

---

## 📚 Referencias

- [Mercado Pago In-Store API](https://www.mercadopago.com.ar/developers/es/docs/qr-code/integration-api/qr-code-generation)
- [Crear POS](https://www.mercadopago.com.ar/developers/es/docs/qr-code/integration-api/pos-management)
- [Obtener User ID](https://www.mercadopago.com.ar/developers/es/reference/users/_users_me/get)

---

**Última actualización:** Diciembre 2024

