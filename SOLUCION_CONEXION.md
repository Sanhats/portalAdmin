# 🔧 Solución: Error ENOTFOUND al conectar con Supabase

## ❌ Error Común

```
Error: getaddrinfo ENOTFOUND db.ufbzpcdnqwutlvhwhzts.supabase.co
```

Este error indica que el hostname no se puede resolver. Esto generalmente ocurre cuando se usa una conexión directa que no está disponible o el formato es incorrecto.

---

## ✅ Solución: Usar Connection Pooling

Para `drizzle-kit` y herramientas de migración, es **recomendado usar Connection Pooling** en lugar de conexión directa.

### Paso 1: Obtener Connection Pooling URL desde Supabase

1. Ve a tu proyecto en [app.supabase.com](https://app.supabase.com)
2. Navega a **Settings → Database**
3. Busca la sección **"Connection pooling"**
4. Selecciona la pestaña **"Session mode"** o **"Transaction mode"**
5. Copia la **URI** completa que aparece

### Paso 2: Formato de la URL

La URL de connection pooling tiene este formato:

**Opción A (Recomendada - Session Mode):**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Opción B (Transaction Mode):**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[PROJECT_REF].pooler.supabase.com:6543/postgres
```

**Diferencias importantes:**
- Usa `postgres.[PROJECT_REF]` en lugar de solo `postgres`
- El puerto es **6543** (no 5432)
- El hostname es `pooler.supabase.com` (no `db.[PROJECT_REF].supabase.co`)

### Paso 3: Actualizar .env.local

Reemplaza tu `DATABASE_URL` con la URL de connection pooling:

```env
DATABASE_URL="postgresql://postgres.ufbzpcdnqwutlvhwhzts:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

**Nota:** Reemplaza:
- `TU_PASSWORD` con tu contraseña real
- `us-east-1` con tu región (puede variar: `us-west-1`, `eu-west-1`, etc.)

---

## 🔍 Cómo Encontrar tu Región

1. En Supabase Dashboard, ve a **Settings → General**
2. Busca **"Region"** o **"Project Region"**
3. La región aparecerá como: `us-east-1`, `us-west-1`, `eu-west-1`, etc.

---

## 🧪 Verificar la Conexión

Después de actualizar `.env.local`, prueba:

```bash
npm run db:push
```

Si aún tienes problemas, verifica:

1. **La contraseña está correcta:** No debe tener espacios al inicio o final
2. **Caracteres especiales:** Si tu contraseña tiene caracteres especiales (`@`, `#`, `%`, etc.), pueden necesitar codificación URL
3. **Formato correcto:** Asegúrate de que la URL no tenga espacios ni saltos de línea

---

## 🔄 Alternativa: Usar Connection String Directo (Si Pooling no funciona)

Si connection pooling no funciona, intenta obtener el connection string directo:

1. Ve a **Settings → Database**
2. Busca **"Connection string"** (no pooling)
3. Selecciona **"URI"**
4. Copia la URL completa
5. Asegúrate de que el formato sea: `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`

**Nota:** La conexión directa puede no estar disponible en todos los proyectos de Supabase, especialmente en planes gratuitos.

---

## 📚 Referencias

- [Documentación de Supabase sobre Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Drizzle Kit - Database Connection](https://orm.drizzle.team/docs/get-started-postgresql#drizzle-kit)

