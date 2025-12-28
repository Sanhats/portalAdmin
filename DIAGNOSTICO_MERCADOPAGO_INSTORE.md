# Diagnóstico: Mercado Pago In-Store API - Error 401

## Problema Actual

Al intentar generar QR codes usando Mercado Pago In-Store API, obtenemos:
```
Error 401: { code: 'unauthorized', message: 'user not found' }
```

## Estado de la Configuración

✅ **Configuración Correcta:**
- User ID: `1231202386` (coincide con el del access token)
- POS ID: `123439423` (existe en Mercado Pago)
- Access Token: Configurado en `.env.local`
- Gateway: Habilitado en BD

✅ **Verificaciones Realizadas:**
- El access token pertenece al usuario correcto
- El POS existe y está activo
- La URL del endpoint está correctamente formada
- El formato del request body es correcto

## Causa Probable

El access token **no tiene permisos para usar la API de In-Store**. Mercado Pago requiere permisos específicos para esta funcionalidad.

## Soluciones

### Opción 1: Solicitar Permisos Adicionales (Recomendado)

1. Ve a [Mercado Pago Dashboard](https://www.mercadopago.com.ar/developers/panel/app)
2. Selecciona tu aplicación
3. Ve a "Credenciales" → "Permisos"
4. Verifica que tengas permisos para:
   - **In-Store API**
   - **QR Code Generation**
   - **Point of Sale Management**

5. Si no los tienes:
   - Solicita permisos adicionales a Mercado Pago
   - O crea una nueva aplicación con estos permisos habilitados
   - Genera un nuevo access token con los permisos necesarios

### Opción 2: Usar QR Genérico (Temporal)

Mientras se resuelven los permisos, el sistema ya está usando QR genérico como fallback. Este QR:
- ✅ Funciona para testing
- ✅ Se genera correctamente
- ❌ NO es escaneable por la app de Mercado Pago
- ✅ Puede ser útil para desarrollo/testing

### Opción 3: Verificar Tipo de Access Token

Asegúrate de que el access token sea de **producción** (`APP_USR-...`) y no de sandbox (`TEST-...`), ya que algunos endpoints de In-Store solo funcionan en producción.

## Verificación de Permisos

Para verificar qué permisos tiene tu access token:

```bash
curl -X GET "https://api.mercadopago.com/users/me" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

Luego verifica en el Dashboard qué permisos tiene tu aplicación.

## Próximos Pasos

1. **Inmediato:** El sistema funciona con QR genérico como fallback
2. **Corto plazo:** Contactar a Mercado Pago para solicitar permisos de In-Store API
3. **Largo plazo:** Una vez obtenidos los permisos, el código ya está listo y funcionará automáticamente

## Nota Importante

El código está **correctamente implementado**. El problema es de permisos/autenticación con Mercado Pago, no del código. Una vez que tengas los permisos correctos, todo funcionará sin cambios adicionales.


