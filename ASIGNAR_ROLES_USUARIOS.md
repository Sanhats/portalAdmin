# 👤 Asignar Roles a Usuarios - Guía Completa

**Fecha:** Diciembre 2024  
**Estado:** ✅ **IMPLEMENTADO**

---

## 🎯 Problema Resuelto

Los usuarios nuevos en Supabase tienen el rol por defecto `'authenticated'`, pero el sistema requiere roles específicos como `admin`, `manager` o `cashier` para ciertas operaciones (como confirmar pagos).

---

## ✅ Solución Implementada

### 1. **Endpoint Administrativo para Asignar Roles**

#### **PATCH /api/admin/users/:id/role**

**Descripción:** Asigna un rol a un usuario (solo administradores)

**Autenticación:** Requerida (Token Bearer de admin)

**Request:**
```json
{
  "role": "manager"
}
```

**Roles disponibles:**
- `admin` - Administrador completo
- `super_admin` - Super administrador
- `manager` - Gerente (puede confirmar pagos)
- `cashier` - Cajero (puede confirmar pagos)
- `user` - Usuario básico (sin permisos especiales)

**Response 200:**
```json
{
  "success": true,
  "message": "Rol actualizado correctamente a 'manager'",
  "user": {
    "id": "d313f235-0b29-46fa-9e34-6396c1ae991d",
    "role": "manager"
  }
}
```

**Errores:**
- `401`: No autorizado (token inválido)
- `403`: No autorizado (no es admin)
- `404`: Usuario no encontrado
- `400`: Datos inválidos

---

#### **GET /api/admin/users/:id/role**

**Descripción:** Obtiene el rol actual de un usuario (solo administradores)

**Response 200:**
```json
{
  "user": {
    "id": "d313f235-0b29-46fa-9e34-6396c1ae991d",
    "role": "manager"
  }
}
```

---

### 2. **Script PowerShell para Asignar Roles**

**Archivo:** `assign-user-role.ps1`

**Uso:**
```powershell
.\assign-user-role.ps1 -UserId "d313f235-0b29-46fa-9e34-6396c1ae991d" -Role "manager"
```

**Parámetros:**
- `-UserId` (requerido): ID del usuario en Supabase
- `-Role` (requerido): Rol a asignar (`admin`, `super_admin`, `manager`, `cashier`, `user`)
- `-BaseUrl` (opcional): URL base del API (default: `http://localhost:3000`)

**Ejemplo completo:**
```powershell
# 1. Primero, haz login como admin para obtener el token
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"tu_password"}'

$adminToken = $loginResponse.session.access_token

# 2. Asignar rol usando el script
.\assign-user-role.ps1 -UserId "d313f235-0b29-46fa-9e34-6396c1ae991d" -Role "manager"
# El script te pedirá el token del admin
```

---

## 🔧 Cómo Asignar Rol al Usuario Específico

### **Opción 1: Usando el Script PowerShell (Recomendado)**

```powershell
# Asignar rol 'manager' al usuario test3@toludev.com
.\assign-user-role.ps1 -UserId "d313f235-0b29-46fa-9e34-6396c1ae991d" -Role "manager"
```

### **Opción 2: Usando el Endpoint Directamente**

```powershell
# 1. Login como admin
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"tu_password"}'

$adminToken = $loginResponse.session.access_token

# 2. Asignar rol
$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

$body = @{
    role = "manager"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/users/d313f235-0b29-46fa-9e34-6396c1ae991d/role" `
  -Method PATCH `
  -Headers $headers `
  -Body $body

Write-Host "Rol asignado: $($response.user.role)"
```

### **Opción 3: Usando Supabase Admin API Directamente (Recomendado si no tienes admin)**

**Ventaja:** No necesitas tener un usuario admin existente. Usa `service_role_key` directamente.

```powershell
# Script específico para test3@toludev.com
.\asignar-rol-test3-directo.ps1
```

O usando el script genérico:

```powershell
.\asignar-rol-directo-supabase.ps1 -UserId "d313f235-0b29-46fa-9e34-6396c1ae991d" -Role "manager"
```

**Requisitos:**
- Tener `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`
- O proporcionar las credenciales como parámetros

**Nota:** Este método usa la API de Supabase Admin directamente, por lo que no requiere autenticación de usuario.

---

### **Opción 4: Desde Supabase Dashboard (Puede tener limitaciones)**

**⚠️ Nota:** El dashboard de Supabase puede no permitir editar `user_metadata.role` directamente. Si esto ocurre, usa la Opción 3 (Supabase Admin API).

Si el dashboard te permite editar:

1. Ve a **Authentication → Users** en Supabase Dashboard
2. Busca el usuario `test3@toludev.com`
3. Haz clic en el usuario para editarlo
4. En **User Metadata**, agrega:
   ```json
   {
     "role": "manager"
   }
   ```
5. Guarda los cambios

**Nota:** Si usas esta opción, el usuario debe hacer logout y login nuevamente para que el rol se refleje en el token JWT.

---

## ⚠️ Importante: Actualizar Token JWT

**Después de asignar un rol, el usuario debe:**

1. **Hacer logout** de la aplicación
2. **Hacer login nuevamente** para obtener un nuevo token JWT con el rol actualizado

El token JWT contiene el rol en el momento del login, por lo que no se actualiza automáticamente.

---

## 📋 Roles y Permisos

| Rol | Confirmar Pagos | Asignar Roles | Gestión Completa |
|-----|----------------|---------------|------------------|
| `admin` | ✅ | ✅ | ✅ |
| `super_admin` | ✅ | ✅ | ✅ |
| `manager` | ✅ | ❌ | ❌ |
| `cashier` | ✅ | ❌ | ❌ |
| `user` | ❌ | ❌ | ❌ |

---

## 🔍 Verificar Rol Actual

### **Usando el Endpoint:**

```powershell
$headers = @{
    "Authorization" = "Bearer $adminToken"
}

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/users/d313f235-0b29-46fa-9e34-6396c1ae991d/role" `
  -Method GET `
  -Headers $headers

Write-Host "Rol actual: $($response.user.role)"
```

### **Desde el Token JWT:**

El rol está en `user_metadata.role` o `app_metadata.role` del token JWT decodificado.

---

## 🛠️ Funciones Helper Disponibles

### **`updateUserRole(userId, role)`**

Actualiza el rol de un usuario en Supabase.

```typescript
import { updateUserRole } from "@/lib/user-roles";

const result = await updateUserRole("user-id", "manager");
if (result.success) {
  console.log("Rol actualizado");
} else {
  console.error(result.error);
}
```

### **`getUserRoleById(userId)`**

Obtiene el rol actual de un usuario.

```typescript
import { getUserRoleById } from "@/lib/user-roles";

const { role, error } = await getUserRoleById("user-id");
if (role) {
  console.log(`Rol: ${role}`);
}
```

---

## 📝 Ejemplo Completo: Solucionar el Problema Reportado

**Problema:** Usuario `test3@toludev.com` (ID: `d313f235-0b29-46fa-9e34-6396c1ae991d`) tiene rol `'authenticated'` pero necesita `'manager'` para confirmar pagos.

**Solución:**

```powershell
# 1. Asignar rol 'manager'
.\assign-user-role.ps1 -UserId "d313f235-0b29-46fa-9e34-6396c1ae991d" -Role "manager"

# 2. El usuario debe hacer logout y login nuevamente
# 3. Ahora el token JWT incluirá role: 'manager'
# 4. El endpoint /payments/:id/confirm funcionará correctamente
```

---

## 🆘 Solución de Problemas

### **Error: "No autorizado. Solo administradores pueden asignar roles"**

**Solución:** Asegúrate de estar usando un token de un usuario con rol `admin` o `super_admin`.

### **Error: "Usuario no encontrado"**

**Solución:** Verifica que el `userId` sea correcto. Puedes encontrarlo en Supabase Dashboard → Authentication → Users.

### **El rol se asignó pero el usuario sigue sin permisos**

**Solución:** El usuario debe hacer logout y login nuevamente para obtener un nuevo token JWT con el rol actualizado.

### **Error: "Token inválido o expirado"**

**Solución:** El token del admin expiró. Haz login nuevamente para obtener un nuevo token.

---

## 📚 Archivos Creados/Modificados

### **Archivos Creados:**
- ✅ `src/lib/user-roles.ts` - Funciones helper para manejar roles
- ✅ `src/app/api/admin/users/[id]/role/route.ts` - Endpoint para asignar/obtener roles
- ✅ `assign-user-role.ps1` - Script PowerShell para facilitar asignación
- ✅ `ASIGNAR_ROLES_USUARIOS.md` - Esta documentación

### **Archivos Modificados:**
- ✅ `src/lib/auth.ts` - Agregado cliente admin `supabaseAdmin`

---

**Estado Final:** ✅ **IMPLEMENTADO Y LISTO PARA USAR**

