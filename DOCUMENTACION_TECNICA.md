# 📄 Paquete Completo de Documentos Técnicos para el Equipo de Desarrollo

Este archivo contiene **los tres documentos solicitados**, integrados dentro de un único archivo para distribución sencilla al equipo.

---

# 📘 Documento 1: Setup Inicial del Proyecto (Paso a Paso)

## **1. Crear el proyecto Next.js**

Ejecutar:

```
npx create-next-app@latest ecommerce-backend
```

Seleccionar:

* TypeScript: Yes
* App Router: Yes
* Tailwind: No (no necesario para backend)
* ESLint: Yes

---

## **2. Instalar dependencias necesarias**

```
npm install @supabase/supabase-js drizzle-orm drizzle-kit pg zod
npm install -D @types/node
```

---

## **3. Configurar variables de entorno**

Crear `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL="<url del proyecto>"
SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"
DATABASE_URL="postgresql://postgres:<password>@db.<id>.supabase.co:5432/postgres"
```

**IMPORTANTE:** `service_role_key` es solo para el backend.

### **Cómo obtener la DATABASE_URL desde Supabase:**

1. **Accede a tu proyecto en Supabase Dashboard:**
   - Ve a [https://app.supabase.com](https://app.supabase.com)
   - Selecciona tu proyecto

2. **Navega a la sección de Database:**
   - En el menú lateral, haz clic en **"Settings"** (⚙️)
   - Luego selecciona **"Database"**

3. **Encuentra la Connection String:**
   - Busca la sección **"Connection string"** o **"Connection pooling"**
   - Selecciona la pestaña **"URI"** o **"Connection string"**
   - Copia la cadena de conexión que aparece

4. **Formato de la URL:**
   - La URL tiene este formato: `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`
   - Reemplaza `[PASSWORD]` con la contraseña de tu base de datos (la que estableciste al crear el proyecto)
   - El `[PROJECT_REF]` es el ID de tu proyecto (puedes verlo en tu URL de Supabase)

5. **Si olvidaste la contraseña:**
   - Ve a **Settings → Database**
   - Busca la opción **"Reset database password"** o **"Database password"**
   - Puedes resetearla o verla si tienes permisos

**Ejemplo basado en tu configuración:**
Si tu `NEXT_PUBLIC_SUPABASE_URL` es `https://ufbzpcdnqwutlvhwhzts.supabase.co`, entonces:
- Tu `PROJECT_REF` es: `ufbzpcdnqwutlvhwhzts`
- Tu `DATABASE_URL` será: `postgresql://postgres:TU_PASSWORD@db.ufbzpcdnqwutlvhwhzts.supabase.co:5432/postgres`

---

## **4. Configurar Supabase en el backend**

Crear `src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

## **5. Crear estructura de carpetas**

```
src/
 ├─ app/
 │   ├─ api/
 │   │   ├─ categories/
 │   │   ├─ products/
 │   │   ├─ upload/
 │   │   └─ auth/
 ├─ lib/
 ├─ validations/
 └─ db/
```

---

# 📗 Documento 2: Migración Inicial con Drizzle ORM

## **1. Crear archivo de configuración**

`drizzle.config.ts`:

`drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Cargar variables de entorno desde .env.local
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
});
```

**Nota:** También necesitas instalar `dotenv` como dependencia de desarrollo:
```
npm install -D dotenv
```

**Importante:** La sintaxis puede variar según la versión de drizzle-kit:
- Versiones 0.20.x: Usa `driver: "pg"` y `connectionString`
- Versiones más recientes: Pueden usar `dialect: "postgresql"` y `url`

---

## **2. Crear `schema.ts` con todas las tablas**

```ts
import { pgTable, text, uuid, timestamp, numeric, boolean, integer } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  price: numeric("price").notNull(),
  stock: integer("stock").default(0),
  isFeatured: boolean("is_featured").default(false),
  categoryId: uuid("category_id").references(() => categories.id),
  createdAt: timestamp("created_at").defaultNow()
});

export const productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
});

export const variants = pgTable("variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  value: text("value").notNull(),
});
```

---

## **3. Generar migración**

```
npx drizzle-kit generate:pg
```

O usando el script de npm:
```
npm run db:generate
```

## **4. Ejecutar migración en Supabase**

```
npx drizzle-kit push:pg
```

---

# 📙 Documento 3: Endpoint Ejemplo Completo (Categorías)

## **Archivo:** `src/app/api/categories/route.ts`

```ts
import { supabase } from "@/src/lib/supabase";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1)
});

export async function GET() {
  const { data, error } = await supabase.from("categories").select("*");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase.from("categories").insert(parsed.data).select();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
```

---

