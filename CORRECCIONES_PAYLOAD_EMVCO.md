# 🔧 Correcciones Aplicadas al Payload EMVCo

## 📋 Resumen de Cambios

Se han corregido los problemas identificados en el payload EMVCo para mejorar la compatibilidad con todas las billeteras digitales argentinas.

---

## ✅ Cambios Implementados

### 1. Point of Initiation Method Corregido

**Problema:** Se estaba usando `"11"` (dynamic QR) cuando debería ser `"12"` (static QR).

**Solución:**
- Cambiado a `"12"` (static) para todos los QR interoperables
- Esto mejora la compatibilidad con todas las billeteras

**Código:**
```typescript
// Antes:
payload += "01" + padLength(params.type === "fixed" ? "11" : "12", 2);

// Ahora:
payload += "01" + padLength("12", 2); // Siempre static para interoperable
```

**Motivo:** Los QR estáticos son más compatibles porque contienen toda la información necesaria y no requieren comunicación adicional con el servidor.

---

### 2. Merchant Category Code Mejorado

**Problema:** Se estaba usando `"0000"` (sin categoría específica), que algunas billeteras pueden rechazar.

**Solución:**
- Cambiado a `"5492"` (Retail - Comercio Minorista) por defecto
- Configurable desde base de datos o variables de entorno

**Configuración:**

**Opción 1: Base de Datos**
```sql
UPDATE payment_gateways
SET config = jsonb_set(
  config,
  '{merchant_category_code}',
  '"5492"'
)
WHERE provider = 'interoperable_qr' 
  AND tenant_id = 'TU_TENANT_ID';
```

**Opción 2: Variable de Entorno**
```env
MERCHANT_CATEGORY_CODE=5492
```

**Códigos Comunes:**
- `5492` - Retail (Comercio Minorista) - **Recomendado**
- `5411` - Supermercados
- `5812` - Restaurantes
- `5999` - Otros comercios

---

### 3. ⚠️ **CRÍTICO**: Terminal ID Fijo en Campo 26

**Problema:** El subcampo 02 del campo 26 estaba usando la referencia de pago (variable), cuando debe ser un **Terminal ID FIJO**.

**Impacto:** Este error impedía el escaneo correcto en la mayoría de las billeteras (MODO, Naranja X, bancos).

**Solución:**
- Cambiar el subcampo 02 del campo 26 para usar un Terminal ID fijo (`"TERMINAL01"`)
- La referencia de pago (variable) se mantiene correctamente en el campo 62

**Código:**
```typescript
// ❌ ANTES (INCORRECTO):
const normalizedReference = params.reference.substring(0, 25);
const accountInfo = 
  "00" + padLength("AR", 2) +
  "01" + padLength(normalizedCBU, 2) +
  "02" + padLength(normalizedReference, 2); // ❌ Variable

// ✅ AHORA (CORRECTO):
const terminalId = "TERMINAL01"; // ✅ Fijo
const accountInfo = 
  "00" + padLength("AR", 2) +
  "01" + padLength(normalizedCBU, 2) +
  "02" + padLength(terminalId, 2); // ✅ Siempre el mismo
```

**Estructura correcta:**
- **Campo 26, subcampo 02**: Terminal ID FIJO (identifica el punto de venta)
- **Campo 62, subcampo 05**: Reference VARIABLE (identifica la transacción)

**Fecha de corrección:** 4 de enero de 2026

---

### 4. Validación y Normalización de Merchant Account Information

**Problema:** No había validación del formato del CBU/CVU ni del tamaño del campo 26.

**Solución:**
- Validación de que CBU/CVU tenga exactamente 22 dígitos
- Normalización (remueve caracteres no numéricos)
- Validación de que el campo 26 no exceda 99 caracteres

**Código:**
```typescript
// Validar y normalizar CBU/CVU
const normalizedCBU = params.cbu.replace(/\D/g, "");
if (normalizedCBU.length !== 22) {
  throw new Error(`CBU/CVU debe tener exactamente 22 dígitos`);
}

// Validar tamaño del campo 26
if (accountInfo.length > 99) {
  throw new Error(`Merchant Account Information excede 99 caracteres`);
}
```

---

### 5. Formato de Transaction Amount Corregido

**Problema:** El formato del monto podría no estar siguiendo exactamente la especificación EMVCo.

**Solución:**
- Formato correcto: monto sin decimales (ej: 1000.00 → "100000")
- Validación de que no exceda 13 dígitos
- Solo se incluye si es monto fijo y mayor a 0

**Código:**
```typescript
// Formato EMVCo: monto sin decimales
const amountStr = Math.round(params.amount * 100).toString();
if (amountStr.length > 13) {
  throw new Error(`Transaction Amount excede 13 dígitos`);
}
payload += "54" + padLength(amountStr, 2);
```

---

## 🧪 Pruebas Recomendadas

### 1. Verificar Payload Generado

Ejecuta el script de prueba:
```powershell
.\test-qr-interoperable.ps1
```

### 2. Validar con Script de Análisis

Usa un script de análisis EMVCo para verificar:
- Point of Initiation Method = `12` ✅
- Merchant Category Code = `5492` ✅
- Merchant Account Information tiene formato correcto ✅
- Transaction Amount tiene formato correcto ✅

### 3. Probar con Billeteras Reales

Escanea el QR con:
- MODO
- Naranja X
- Mercado Pago
- Billeteras bancarias

Verifica que:
- Aparezca el monto correcto
- Aparezca el nombre del comercio
- Se pueda realizar el pago sin errores

---

## 📊 Estructura del Payload Corregido

```
00 02 01                    # Payload Format Indicator: "01"
01 02 12                    # Point of Initiation: "12" (static) ✅ CORREGIDO
26 43 0002AR0122...020A...  # Merchant Account Information
   ├─ 00 02 AR             # GUI: Argentina
   ├─ 01 22 0110343...     # CBU/CVU (22 dígitos)
   └─ 02 0A TERMINAL01     # Terminal ID FIJO ✅ CORREGIDO
52 04 5492                  # Merchant Category Code: "5492" ✅ CORREGIDO
53 03 032                   # Transaction Currency: "032" (ARS)
54 XX 100000                # Transaction Amount (formato corregido) ✅
58 02 AR                    # Country Code: "AR"
59 XX Toludev shop          # Merchant Name
60 XX Argentina             # Merchant City
62 XX 05XX...               # Additional Data Field Template
   └─ 05 XX SALE-EC08FEBC  # Reference Label VARIABLE ✅
63 04 XXXX                  # CRC
```

---

## 🔍 Verificación Post-Corrección

### Campos Verificados

| Campo | Antes | Ahora | Estado |
|-------|-------|-------|--------|
| Point of Initiation | `11` (dynamic) | `12` (static) | ✅ Corregido |
| Merchant Category Code | `0000` | `5492` | ✅ Corregido |
| **Terminal ID (Campo 26-02)** | **Variable** | **FIJO** | ✅ **CRÍTICO** |
| CBU/CVU Validation | Sin validación | Validado (22 dígitos) | ✅ Agregado |
| Transaction Amount | Formato dudoso | Formato correcto | ✅ Corregido |
| Field 26 Size | Sin validación | Validado (≤99 chars) | ✅ Agregado |

---

## 📝 Notas Técnicas

### Point of Initiation Method

- **`11`** = Dynamic QR: Requiere comunicación con servidor para obtener información adicional
- **`12`** = Static QR: Contiene toda la información necesaria en el QR mismo

Para QR interoperable, siempre usamos `12` (static) porque:
- Es más compatible con todas las billeteras
- No requiere configuración adicional
- Funciona offline (el QR contiene toda la info)

### Merchant Category Code

El código `5492` (Retail) es ampliamente aceptado por todas las billeteras. Si tu comercio tiene una categoría específica, puedes configurarlo usando:

```sql
-- Ejemplo: Supermercado
UPDATE payment_gateways
SET config = jsonb_set(config, '{merchant_category_code}', '"5411"')
WHERE provider = 'interoperable_qr';
```

---

## 🚀 Próximos Pasos

1. ✅ Ejecutar script de prueba
2. ✅ Verificar payload generado
3. ✅ Probar con billeteras reales
4. ✅ Documentar resultados

---

**Última actualización:** 4 de enero de 2026
**Versión:** 1.2.0 - **Corrección crítica del Terminal ID aplicada**

