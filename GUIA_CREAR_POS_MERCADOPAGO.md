# 🏪 Guía: Crear POS en Mercado Pago y Asignar External POS ID

Esta guía explica cómo crear un Punto de Venta (POS) en Mercado Pago y asignarle un `external_pos_id` para usar con QR In-Store.

---

## 📋 Método 1: Dashboard de Mercado Pago (Más Fácil)

### Paso 1: Acceder al Dashboard

1. Ingresa a [Mercado Pago](https://www.mercadopago.com.ar/)
2. Inicia sesión con tu cuenta de comercio
3. Ve a **Tu negocio** → **Puntos de venta** (o **POS**)

### Paso 2: Crear Nuevo POS

1. Haz clic en **"Crear punto de venta"** o **"Nuevo POS"**
2. Completa el formulario:
   - **Nombre del POS**: Ej: "Caja Principal", "Sucursal Centro", "POS Tucumán 01"
   - **Tipo**: Selecciona **"QR"** o **"QR Code"**
   - **Ubicación** (opcional): Dirección física del punto de venta

### Paso 3: Asignar External POS ID

**⚠️ IMPORTANTE:** Mercado Pago NO permite asignar directamente un `external_pos_id` desde el Dashboard.

Tienes dos opciones:

#### Opción A: Usar el ID que Mercado Pago genera automáticamente

1. Después de crear el POS, Mercado Pago te asignará un ID automático
2. Este ID aparece en la URL o en los detalles del POS
3. **Problema:** Este ID es un UUID largo y difícil de recordar

#### Opción B: Usar la API para crear/actualizar con external_pos_id (Recomendado)

Usa la API de Mercado Pago para crear el POS con tu propio `external_pos_id`:

```bash
curl -X POST \
  'https://api.mercadopago.com/pos' \
  -H 'Authorization: Bearer APP_USR-...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "POS Tucumán 01",
    "fixed_amount": false,
    "category": 621102,
    "external_id": "POS_TUCUMAN_01",
    "store_id": "STORE_ID_AQUI"
  }'
```

**Parámetros importantes:**
- `name`: Nombre descriptivo del POS
- `external_id`: **Este es tu `external_pos_id`** (ej: `POS_TUCUMAN_01`)
- `fixed_amount`: `false` para QR dinámico (monto variable)
- `category`: Código de categoría (621102 = Retail)
- `store_id`: ID de la tienda (opcional, si tienes múltiples tiendas)

---

## 📋 Método 2: API de Mercado Pago (Recomendado para Integración)

### Paso 1: Obtener tu User ID (Collector ID)

```bash
curl -X GET \
  'https://api.mercadopago.com/users/me' \
  -H 'Authorization: Bearer APP_USR-...'
```

Respuesta:
```json
{
  "id": 123456789,
  "nickname": "TU_COMERCIO",
  ...
}
```

**Guarda el `id`** - este es tu `mercadopago_user_id`.

### Paso 2: Crear POS con External ID

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

**Respuesta exitosa:**
```json
{
  "id": "abc123-def456-ghi789",
  "name": "POS Principal",
  "external_id": "POS_TUCUMAN_01",
  "qr": {
    "qr_code_base64": "...",
    "qr_code": "..."
  },
  ...
}
```

### Paso 3: Verificar POS Creado

```bash
curl -X GET \
  'https://api.mercadopago.com/pos' \
  -H 'Authorization: Bearer APP_USR-...'
```

Esto lista todos tus POS con sus `external_id`.

---

## 🔧 Configuración en el Backend

Una vez que tengas el `external_pos_id`, configúralo en tu backend:

### Opción 1: Via SQL

```sql
UPDATE payment_gateways
SET config = jsonb_set(
  jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{mercadopago_user_id}',
    '"123456789"'
  ),
  '{mercadopago_external_pos_id}',
  '"POS_TUCUMAN_01"'
)
WHERE provider = 'mercadopago' AND tenant_id = '<tu-tenant-id>';
```

### Opción 2: Via API

```bash
PUT /api/payment-gateways/{gateway_id}
{
  "config": {
    "mercadopago_user_id": "123456789",
    "mercadopago_external_pos_id": "POS_TUCUMAN_01",
    "notification_url": "https://tu-dominio.com/api/webhooks/mercadopago"
  }
}
```

### Opción 3: Variables de Entorno

```env
MERCADOPAGO_USER_ID=123456789
MERCADOPAGO_EXTERNAL_POS_ID=POS_TUCUMAN_01
```

---

## ✅ Verificación

### 1. Verificar POS en Mercado Pago

```bash
curl -X GET \
  'https://api.mercadopago.com/pos' \
  -H 'Authorization: Bearer APP_USR-...'
```

Busca tu POS y verifica que tiene el `external_id` correcto.

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
  "gateway_metadata": {
    "provider": "mercadopago_instore",
    "qr_code": "data:image/png;base64,...",
    ...
  }
}
```

### 3. Probar Escaneo

1. Abre la app Mercado Pago en tu celular
2. Ve a **Pagar con QR**
3. Escanea el QR generado
4. ✅ **Debería aparecer**: Monto + Nombre de tu comercio

---

## 📝 Ejemplos de External POS ID

Usa nombres descriptivos y consistentes:

✅ **Buenos ejemplos:**
- `POS_TUCUMAN_01`
- `CAJA_PRINCIPAL`
- `SUCURSAL_CENTRO`
- `POS_ONLINE`
- `MOSTRADOR_1`

❌ **Evitar:**
- IDs muy largos
- Caracteres especiales (solo letras, números y guiones bajos)
- Espacios (usa guiones bajos)

---

## 🐛 Troubleshooting

### Error: "external_id already exists"

**Causa:** Ya existe un POS con ese `external_id`

**Solución:**
1. Lista todos los POS: `GET /pos`
2. Usa un `external_id` diferente
3. O elimina el POS existente y crea uno nuevo

### Error: "Invalid category"

**Causa:** El código de categoría no es válido

**Solución:** Usa uno de estos códigos comunes:
- `621102` - Retail / Comercio
- `5411` - Supermercados
- `5812` - Restaurantes
- `5999` - Otros

### Error: "Store not found"

**Causa:** El `store_id` no existe

**Solución:** 
1. Obtén tu `store_id` con `GET /users/me/stores`
2. O omite el campo `store_id` si no tienes múltiples tiendas

---

## 📚 Referencias

- [API de POS de Mercado Pago](https://www.mercadopago.com.ar/developers/es/reference/pos/_pos/post)
- [Listar POS](https://www.mercadopago.com.ar/developers/es/reference/pos/_pos/get)
- [Categorías de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/qr-code/integration-api/pos-management)

---

## 🎯 Checklist

- [ ] Obtener `user_id` (collector_id) de `/users/me`
- [ ] Crear POS con `external_id` personalizado
- [ ] Verificar que el POS aparece en la lista
- [ ] Configurar `mercadopago_user_id` en backend
- [ ] Configurar `mercadopago_external_pos_id` en backend
- [ ] Probar generación de QR
- [ ] Verificar que el QR es escaneable
- [ ] Probar pago completo end-to-end

---

**Última actualización:** Diciembre 2024

