# 🔐 Sistema de Autenticación Admin - Documentación

**Estado:** ✅ Implementado  
**Fecha:** Diciembre 2024

---

## 📋 Resumen

El sistema de autenticación protege los endpoints de administración (POST, PUT, DELETE) requiriendo un token Bearer válido de Supabase.

---

## 🔧 Configuración Requerida

Antes de usar el sistema, debes:

1. ✅ **Configurar Supabase Auth** (ver `CONFIGURAR_AUTENTICACION.md`)
2. ✅ **Crear usuario Admin** en Supabase
3. ✅ **Configurar políticas RLS** (opcional pero recomendado)
4. ✅ **Agregar `NEXT_PUBLIC_SUPABASE_ANON_KEY`** a `.env.local`

---

## 📡 Endpoints de Autenticación

### POST /api/auth/login
**Iniciar sesión y obtener token**

#### Request:
```json
{
  "email": "admin@ecommerce.com",
  "password": "tu_password"
}
```

#### Respuesta Exitosa (200):
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@ecommerce.com",
    "role": "user"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": 1234567890,
    "expires_in": 3600
  }
}
```

#### Errores:
- `400`: Datos inválidos (email o password mal formateados)
- `401`: Credenciales inválidas
- `500`: Error del servidor

---

## 🛡️ Protección de Endpoints

### Rutas Protegidas

El middleware protege automáticamente:

- ✅ `/api/products` (POST, PUT, DELETE)
- ✅ `/api/products/[id]` (PUT, DELETE)
- ✅ `/api/categories` (POST, PUT, DELETE)
- ✅ `/api/upload` (POST, DELETE)

### Rutas Públicas (Solo Lectura)

Estas rutas permiten GET sin autenticación:

- ✅ `/api/products` (GET)
- ✅ `/api/products/[id]` (GET)
- ✅ `/api/categories` (GET)

### Endpoints Públicos

Estos endpoints no requieren autenticación:

- ✅ `/api/auth/login` (POST)

---

## 🔑 Cómo Usar la Autenticación

### Paso 1: Iniciar Sesión

```powershell
$body = @{
    email = "admin@ecommerce.com"
    password = "tu_password"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $body -ContentType "application/json"

# Guardar el token
$accessToken = $loginResponse.session.access_token
Write-Host "Token: $accessToken" -ForegroundColor Green
```

### Paso 2: Usar el Token en Requests

```powershell
# Crear producto con autenticación
$body = @{
    name = "Producto Protegido"
    slug = "producto-protegido"
    price = "99.99"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

$product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -Headers $headers
```

---

## 💻 Ejemplos Completos

### Ejemplo 1: Login y Crear Producto

```powershell
# 1. Login
$loginBody = @{
    email = "admin@ecommerce.com"
    password = "tu_password"
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $login.session.access_token

# 2. Crear producto
$productBody = @{
    name = "Producto Test"
    slug = "producto-test"
    price = "50.00"
} | ConvertTo-Json

$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $productBody -Headers $headers
```

### Ejemplo 2: Actualizar Producto

```powershell
$productId = "uuid-del-producto"
$updateBody = @{
    price = "79.99"
    stock = 20
} | ConvertTo-Json

$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$updated = Invoke-RestMethod -Uri "http://localhost:3000/api/products/$productId" -Method PUT -Body $updateBody -Headers $headers
```

### Ejemplo 3: Subir Imagen (Requiere Auth)

```powershell
# Subir imagen con autenticación
$headers = @{ "Authorization" = "Bearer $token" }
$formData = New-Object System.Net.Http.MultipartFormDataContent
# ... agregar archivo ...
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/upload" -Method POST -Headers $headers -Body $formData
```

---

## 🚫 Errores de Autenticación

### Error 401: No autorizado

**Causas:**
- Token no proporcionado
- Token inválido
- Token expirado

**Solución:**
1. Verifica que el header `Authorization: Bearer <token>` esté presente
2. Obtén un nuevo token con `/api/auth/login`
3. Verifica que el token no haya expirado

### Error 401: Token inválido

**Causas:**
- Token mal formateado
- Token de otro proyecto
- Token corrupto

**Solución:**
1. Obtén un nuevo token
2. Verifica que uses el token correcto del proyecto

---

## 🔄 Flujo de Autenticación

```
1. Cliente → POST /api/auth/login (email, password)
2. Servidor → Valida credenciales con Supabase Auth
3. Servidor → Retorna access_token y refresh_token
4. Cliente → Guarda access_token
5. Cliente → Usa token en requests: Authorization: Bearer <token>
6. Middleware → Valida token antes de permitir acceso
7. Endpoint → Procesa request si token es válido
```

---

## 🛠️ Archivos Implementados

1. **`middleware.ts`**
   - Middleware de Next.js que valida tokens
   - Protege rutas automáticamente
   - Permite GET público en rutas específicas

2. **`src/lib/auth.ts`**
   - Funciones de validación de tokens
   - `validateBearerToken()` - Valida token con Supabase
   - `extractBearerToken()` - Extrae token del header
   - `isAdmin()` - Verifica rol de admin

3. **`src/app/api/auth/login/route.ts`**
   - Endpoint de login
   - Valida credenciales
   - Retorna tokens de sesión

---

## ⚙️ Configuración del Middleware

El middleware está configurado para:

- ✅ Proteger métodos: POST, PUT, PATCH, DELETE
- ✅ Permitir GET público en: `/api/products`, `/api/categories`
- ✅ Proteger completamente: `/api/upload`
- ✅ Permitir público: `/api/auth/login`

### Personalizar Rutas Protegidas

Edita `middleware.ts`:

```typescript
// Agregar rutas protegidas
const protectedRoutes = [
  "/api/products",
  "/api/categories",
  "/api/upload",
  "/api/otra-ruta", // Nueva ruta
];

// Agregar rutas de lectura pública
const publicReadRoutes = [
  "/api/products",
  "/api/categories",
];
```

---

## 🔒 Seguridad

### Buenas Prácticas

1. ✅ **Nunca expongas `SUPABASE_SERVICE_ROLE_KEY`** en el frontend
2. ✅ **Usa `NEXT_PUBLIC_SUPABASE_ANON_KEY`** para validar tokens
3. ✅ **Los tokens expiran** - implementa refresh token si es necesario
4. ✅ **HTTPS en producción** - siempre usa HTTPS para tokens
5. ✅ **Políticas RLS** - doble capa de seguridad en la BD

### Tokens

- **Access Token:** Válido por 1 hora (configurable en Supabase)
- **Refresh Token:** Usa para obtener nuevo access token cuando expire
- **Validación:** El middleware valida el token en cada request protegida

---

## 🧪 Pruebas

### Probar sin Token (Debe fallar)

```powershell
# Intentar crear producto sin token
$body = @{ name = "Test"; slug = "test"; price = "10.00" } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
} catch {
    Write-Host "✅ Correctamente bloqueado: $($_.Exception.Message)" -ForegroundColor Green
}
```

### Probar con Token (Debe funcionar)

```powershell
# 1. Login
$login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body (@{email="admin@ecommerce.com";password="tu_password"} | ConvertTo-Json) -ContentType "application/json"
$token = $login.session.access_token

# 2. Crear producto con token
$body = @{ name = "Test"; slug = "test"; price = "10.00" } | ConvertTo-Json
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -Headers $headers
Write-Host "✅ Producto creado: $($product.id)" -ForegroundColor Green
```

---

## 📝 Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # NUEVO
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
DATABASE_URL="postgresql://..."
```

---

## 🎯 Próximas Mejoras (Opcional)

- [ ] Refresh token automático
- [ ] Roles más granulares (admin, editor, viewer)
- [ ] Rate limiting por usuario
- [ ] Logs de auditoría
- [ ] Sesiones persistentes

---

**Última actualización:** Diciembre 2024  
**Estado:** ✅ Funcional y listo para usar

