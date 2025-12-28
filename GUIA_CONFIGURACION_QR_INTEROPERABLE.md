# 🔧 Guía: Configuración de QR Interoperable

Esta guía explica cómo configurar el CBU/CVU y nombre del comercio para generar QR interoperables.

---

## 📋 ¿Dónde Obtener los Valores?

### CBU/CVU

El **CBU (Clave Bancaria Uniforme)** o **CVU (Clave Virtual Uniforme)** es un número de 22 dígitos que identifica tu cuenta bancaria.

**Dónde encontrarlo:**
- En el homebanking de tu banco
- En la app móvil de tu banco
- En extractos bancarios
- En la configuración de tu cuenta

**Formato:** 22 dígitos (ej: `1234567890123456789012`)

### Nombre del Comercio

Es el nombre que aparecerá en el QR cuando el cliente lo escanee.

**Recomendaciones:**
- Máximo 25 caracteres (limitación EMVCo)
- Nombre claro y reconocible
- Sin caracteres especiales complejos

---

## 🔧 Opción 1: Configuración en Base de Datos (Recomendada)

### Paso 1: Ejecutar Script SQL

Edita el archivo `drizzle/configure_interoperable_qr.sql` y reemplaza:
- `TU_TENANT_ID_AQUI` → Tu tenant_id
- `TU_CBU_AQUI` → Tu CBU (22 dígitos)
- `TU_CVU_AQUI` → Tu CVU (22 dígitos) - opcional si tienes CBU
- `Nombre del Comercio` → Nombre de tu comercio

Luego ejecuta en Supabase SQL Editor:

```sql
-- Ver: drizzle/configure_interoperable_qr.sql
```

### Paso 2: Verificar Configuración

```sql
SELECT 
  id,
  provider,
  enabled,
  config->>'merchant_cbu' as cbu,
  config->>'merchant_name' as nombre
FROM payment_gateways
WHERE provider = 'interoperable_qr'
  AND tenant_id = 'TU_TENANT_ID';
```

**Ventajas:**
- ✅ Configuración por tenant (multi-tenant)
- ✅ Fácil de actualizar
- ✅ No requiere reiniciar servidor
- ✅ Seguro (no en código)

---

## 🔧 Opción 2: Variables de Entorno (Fallback)

Si no configuras en BD, el sistema usa variables de entorno como fallback.

### Archivo `.env.local`

```env
MERCHANT_CBU=1234567890123456789012
MERCHANT_CVU=1234567890123456789012
MERCHANT_NAME=Mi Comercio
```

**Nota:** Esta opción es menos flexible para multi-tenant, pero útil para desarrollo/testing.

**Ventajas:**
- ✅ Rápido para desarrollo
- ✅ No requiere acceso a BD

**Desventajas:**
- ❌ Mismo CBU para todos los tenants
- ❌ Requiere reiniciar servidor al cambiar
- ❌ Menos seguro (en archivo de código)

---

## 🔧 Opción 3: Parámetros en la Función (Desarrollo)

Si llamas directamente a `generateInteroperableQR()`, puedes pasar los valores:

```typescript
const qr = await generateInteroperableQR(
  saleId,
  amount,
  reference,
  tenantId,
  "1234567890123456789012", // CBU
  "Mi Comercio" // Nombre
);
```

---

## 📊 Orden de Prioridad

El sistema obtiene la configuración en este orden:

1. **Parámetros de la función** (si se pasan)
2. **Base de datos** (`payment_gateways` con `provider='interoperable_qr'`)
3. **Base de datos** (`stores.name` para el nombre)
4. **Variables de entorno** (`MERCHANT_CBU`, `MERCHANT_CVU`, `MERCHANT_NAME`)

---

## ✅ Verificación

### 1. Verificar en Base de Datos

```sql
SELECT 
  provider,
  enabled,
  config->>'merchant_cbu' as cbu,
  config->>'merchant_name' as nombre
FROM payment_gateways
WHERE provider = 'interoperable_qr';
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
  "gateway_metadata": {
    "qr_code": "data:image/png;base64,...",
    "qr_payload": "000201010212...",
    "provider": "interoperable_qr",
    "reference": "SALE-8F3A"
  }
}
```

### 3. Escanear QR

- Abre cualquier billetera (MODO, Naranja X, MP, Banco)
- Escanea el QR generado
- ✅ Debería aparecer el monto y nombre del comercio

---

## 🐛 Troubleshooting

### Error: "CBU/CVU del comercio no configurado"

**Causa:** No hay configuración en BD ni variables de entorno.

**Solución:**
1. Configurar en BD usando `drizzle/configure_interoperable_qr.sql`
2. O agregar variables de entorno en `.env.local`

### QR no escaneable

**Causa:** CBU/CVU inválido o formato incorrecto.

**Solución:**
- Verificar que el CBU/CVU tenga exactamente 22 dígitos
- Verificar que no tenga espacios o guiones
- Verificar que sea un CBU/CVU válido de Argentina

### Nombre no aparece en el QR

**Causa:** Nombre muy largo o con caracteres especiales.

**Solución:**
- Usar máximo 25 caracteres
- Evitar caracteres especiales complejos
- Usar solo letras, números y espacios básicos

---

## 📝 Ejemplo Completo

### 1. Obtener Tenant ID

```sql
SELECT id FROM stores WHERE slug = 'mi-tienda';
```

### 2. Configurar Gateway

```sql
INSERT INTO payment_gateways (tenant_id, provider, enabled, config)
VALUES (
  '5fc90125-23b9-4200-bd86-c6edba203f16',
  'interoperable_qr',
  true,
  jsonb_build_object(
    'merchant_cbu', '1234567890123456789012',
    'merchant_name', 'Mi Comercio'
  )
);
```

### 3. Verificar

```sql
SELECT config FROM payment_gateways 
WHERE provider = 'interoperable_qr' 
  AND tenant_id = '5fc90125-23b9-4200-bd86-c6edba203f16';
```

---

**Última actualización:** $(Get-Date -Format "yyyy-MM-dd")

