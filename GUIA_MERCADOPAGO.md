# Guía de Configuración de Mercado Pago

Esta guía explica cómo configurar Mercado Pago para el Sprint D.

## 📋 Requisitos Previos

1. Cuenta de Mercado Pago (puede ser de prueba/sandbox)
2. Access Token de Mercado Pago

## 🔑 Obtener Access Token de Mercado Pago

### Opción 1: Sandbox (Recomendado para desarrollo)

1. **Crear cuenta de prueba:**
   - Ve a [https://www.mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers)
   - Inicia sesión o crea una cuenta
   - Ve a **"Tus integraciones"** → **"Crear nueva aplicación"**

2. **Obtener credenciales de prueba:**
   - En la aplicación creada, ve a la pestaña **"Credenciales de prueba"**
   - Copia el **Access Token** (empieza con `TEST-`)

3. **Ejemplo de Access Token de prueba:**
   ```
   TEST-1234567890-123456-1234567890abcdef1234567890abcdef12-123456789
   ```

### Opción 2: Producción

1. **Crear aplicación de producción:**
   - En el panel de desarrolladores, crea una aplicación de producción
   - Ve a **"Credenciales de producción"**
   - Copia el **Access Token** (NO empieza con `TEST-`)

## ⚙️ Configurar Gateway en el Sistema

Una vez que tengas el Access Token, configúralo en el sistema:

### Método 1: Usando la API (Recomendado)

```bash
POST /api/payment-gateways
Authorization: Bearer <tu_token>

{
  "provider": "mercadopago",
  "enabled": true,
  "credentials": {
    "access_token": "TU_ACCESS_TOKEN_AQUI"
  },
  "config": {
    "notification_url": "https://tu-dominio.com/api/webhooks/mercadopago",
    "auto_return": false
  }
}
```

### Método 2: Actualizar gateway existente

```bash
PUT /api/payment-gateways/<gateway_id>
Authorization: Bearer <tu_token>

{
  "enabled": true,
  "credentials": {
    "access_token": "TU_ACCESS_TOKEN_AQUI"
  },
  "config": {
    "notification_url": "https://tu-dominio.com/api/webhooks/mercadopago",
    "auto_return": false
  }
}
```

## 🧪 Probar la Integración

Una vez configurado el gateway con un Access Token válido:

```bash
POST /api/sales/<sale_id>/payments/mercadopago
Authorization: Bearer <tu_token>
```

**Respuesta esperada:**
```json
{
  "id": "<payment_id>",
  "checkoutUrl": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "payment_id": "<preference_id>",
  "external_reference": "<sale_id>",
  "status": "pending",
  ...
}
```

## 🔍 Verificar que Funciona

1. **El endpoint retorna `checkoutUrl`:**
   - Debe ser una URL válida de Mercado Pago
   - Puedes abrirla en el navegador para ver el checkout

2. **El pago queda en estado `pending`:**
   - Verifica con `GET /api/sales/<sale_id>/payments`

3. **El `gateway_metadata` contiene:**
   - `preference_id`: ID de la preference creada
   - `init_point`: URL del checkout
   - `provider`: "mercadopago"

## ⚠️ Notas Importantes

- **Sandbox vs Producción:**
  - Los tokens de prueba (`TEST-`) solo funcionan en modo sandbox
  - Los tokens de producción solo funcionan en producción
  - No mezcles tokens de prueba con producción

- **Notification URL:**
  - En desarrollo local, usa un servicio como ngrok para exponer tu servidor
  - En producción, usa tu dominio real

- **Seguridad:**
  - **NUNCA** expongas tu Access Token en el frontend
  - Solo se almacena en el backend (tabla `payment_gateways`)
  - Las credenciales se ocultan en las respuestas de la API

## 🐛 Solución de Problemas

### Error: "invalid access token"
- Verifica que el Access Token sea válido
- Asegúrate de usar el token correcto (sandbox vs producción)
- Verifica que el token no haya expirado

### Error: "Gateway no configurado"
- Verifica que hayas creado el gateway con `provider: "mercadopago"`
- Verifica que `enabled: true`
- Verifica que el `tenant_id` sea correcto

### Error: "No se pudo crear la preference"
- Verifica los logs del servidor para más detalles
- Verifica que el Access Token tenga permisos para crear preferences
- Verifica que los datos de la venta sean válidos

## 📚 Recursos Adicionales

- [Documentación de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs)
- [API de Preferences](https://www.mercadopago.com.ar/developers/es/reference/preferences/_checkout_preferences/post)
- [Credenciales de Prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/credentials)

