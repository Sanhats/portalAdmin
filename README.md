# Ecommerce Backend - Portal Admin

Backend para sistema de ecommerce construido con Next.js, Supabase y Drizzle ORM.

## 🚀 Inicio Rápido

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   - Copiar `env.example` a `.env.local`
   - Completar con tus credenciales de Supabase
   - 📖 Ver `GUIA_VARIABLES_ENTORNO.md` para instrucciones detalladas

3. **Ejecutar migraciones:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```

## 📚 Documentación

- **⭐ `ESTADO_PROYECTO.md`** - **Estado actual del proyecto y próximos pasos** (LEER PRIMERO)
- **⭐ `ENDPOINTS_PRODUCTOS.md`** - **Documentación completa de endpoints CRUD de productos**
- **⭐ `SISTEMA_UPLOAD.md`** - **Sistema de upload de imágenes - Guía completa**
- **⭐ `CONFIGURAR_SUPABASE_STORAGE.md`** - **Configurar bucket y políticas de Storage**
- **⭐ `SISTEMA_AUTENTICACION.md`** - **Sistema de autenticación admin - Documentación completa**
- **⭐ `CONFIGURAR_AUTENTICACION.md`** - **Configurar Supabase Auth y políticas RLS**
- **⭐ `POLITICAS_RLS.sql`** - **Script SQL con todas las políticas RLS**
- **⭐ `RESUMEN_FINAL_PROYECTO.md`** - **Resumen completo de todo el proyecto** (NUEVO)
- `DOCUMENTACION_TECNICA.md` - Documentación técnica completa del proyecto
- `GUIA_VARIABLES_ENTORNO.md` - Guía paso a paso para obtener las variables de entorno de Supabase
- `SOLUCION_CONEXION.md` - Solución para errores de conexión (ENOTFOUND, etc.)
- `OBTENER_CONNECTION_POOLING.md` - Guía paso a paso para obtener Connection Pooling URL
- `CONSTRUIR_DATABASE_URL.md` - Construir DATABASE_URL manualmente si no la encuentras en el dashboard
- `EJEMPLOS_POWERSHELL.md` - Ejemplos de cómo hacer requests HTTP en PowerShell

## 🔧 Herramientas de Verificación

- `verificar-env.js` - Script para verificar el formato de tu DATABASE_URL
- `test-api.ps1` - Script para probar los endpoints de la API
- `test-auth.ps1` - **⭐ Script para probar el sistema de autenticación** (NUEVO)
- `EJEMPLOS_POWERSHELL.md` - Ejemplos de cómo hacer requests HTTP en PowerShell

## 🛠️ Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run start` - Inicia el servidor de producción
- `npm run lint` - Ejecuta el linter
- `npm run db:generate` - Genera migraciones de Drizzle
- `npm run db:push` - Ejecuta migraciones en la base de datos
- `npm run db:studio` - Abre Drizzle Studio para visualizar la BD

## 📁 Estructura del Proyecto

```
src/
 ├─ app/
 │   ├─ api/          # Endpoints de la API
 │   │   ├─ categories/
 │   │   ├─ products/
 │   │   ├─ upload/
 │   │   └─ auth/
 ├─ lib/              # Utilidades y configuraciones
 ├─ validations/      # Esquemas de validación Zod
 └─ db/               # Schema y configuraciones de Drizzle
```

