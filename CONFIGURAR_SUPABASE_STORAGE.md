# 📦 Configurar Supabase Storage para Upload de Imágenes

Esta guía te ayudará a configurar Supabase Storage para subir imágenes de productos.

---

## 📍 Paso 1: Crear el Bucket

1. **Accede a tu proyecto en Supabase Dashboard:**
   - Ve a [https://app.supabase.com](https://app.supabase.com)
   - Selecciona tu proyecto

2. **Navega a Storage:**
   - En el menú lateral, haz clic en **"Storage"** (📦)

3. **Crear nuevo bucket:**
   - Haz clic en **"New bucket"** o **"Crear bucket"**
   - Nombre del bucket: `product-images`
   - **IMPORTANTE:** Marca la opción **"Public bucket"** (para que las imágenes sean accesibles públicamente)
   - Haz clic en **"Create bucket"**

---

## 🔒 Paso 2: Configurar Políticas (Policies)

Las políticas controlan quién puede leer, escribir y eliminar archivos.

### 2.1 Política de Lectura (Pública)

1. En la página del bucket `product-images`, ve a la pestaña **"Policies"**
2. Haz clic en **"New Policy"** o **"Crear política"**
3. Selecciona **"For full customization"** o **"Personalizada"**
4. Configura:

**Nombre:** `Public Read Access`

**Política SQL:**
```sql
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
```

**Descripción:** Permite que cualquier persona pueda leer/ver las imágenes (necesario para mostrar productos en el frontend)

5. Haz clic en **"Review"** y luego **"Save policy"**

---

### 2.2 Política de Escritura (Solo Server-Side)

1. Haz clic en **"New Policy"** nuevamente
2. Selecciona **"For full customization"**

**Nombre:** `Server-Side Upload Only`

**Política SQL:**
```sql
CREATE POLICY "Server-Side Upload Only"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' AND
  auth.role() = 'service_role'
);
```

**Descripción:** Solo permite subir archivos desde el servidor (usando service_role_key)

3. Haz clic en **"Review"** y luego **"Save policy"**

---

### 2.3 Política de Eliminación (Solo Server-Side)

1. Haz clic en **"New Policy"** nuevamente
2. Selecciona **"For full customization"**

**Nombre:** `Server-Side Delete Only`

**Política SQL:**
```sql
CREATE POLICY "Server-Side Delete Only"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' AND
  auth.role() = 'service_role'
);
```

**Descripción:** Solo permite eliminar archivos desde el servidor

3. Haz clic en **"Review"** y luego **"Save policy"**

---

## ✅ Paso 3: Verificar Configuración

Tu bucket `product-images` debería tener:

- ✅ **Public bucket:** Habilitado
- ✅ **Policies:**
  - Public Read Access (SELECT)
  - Server-Side Upload Only (INSERT)
  - Server-Side Delete Only (DELETE)

---

## 🔧 Paso 4: Configurar CORS (Si es necesario)

Si planeas subir imágenes directamente desde el frontend (no recomendado para producción), necesitarás configurar CORS:

1. Ve a **Settings → API** en Supabase
2. Busca la sección **"CORS"** o **"Storage CORS"**
3. Agrega tu dominio frontend a la lista de orígenes permitidos

**Nota:** Para este proyecto, como usamos `service_role_key` en el backend, no necesitamos CORS para el upload desde el servidor.

---

## 📝 Resumen de Configuración

| Configuración | Valor |
|---------------|-------|
| Bucket Name | `product-images` |
| Public | ✅ Sí |
| Read Policy | Público (todos pueden leer) |
| Write Policy | Solo service_role (servidor) |
| Delete Policy | Solo service_role (servidor) |

---

## 🧪 Probar la Configuración

Después de configurar, puedes probar subiendo una imagen desde el endpoint `/api/upload` que crearemos.

---

## 🆘 Solución de Problemas

### Error: "new row violates row-level security policy"
**Solución:** Verifica que las políticas estén creadas correctamente y que uses `service_role_key` en el backend.

### Error: "Bucket not found"
**Solución:** Verifica que el nombre del bucket sea exactamente `product-images` (case-sensitive).

### Las imágenes no se muestran públicamente
**Solución:** Verifica que el bucket esté marcado como "Public" y que la política de lectura esté activa.

---

## 📚 Referencias

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)

---

**Una vez completada esta configuración, los endpoints de upload funcionarán correctamente.**

