import { pgTable, text, uuid, timestamp, numeric, boolean, integer } from "drizzle-orm/pg-core";

// SPRINT 6: Tabla de stores (tiendas) para multi-tenant
export const stores = pgTable("stores", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }), // SPRINT 6: Multi-tenant
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // SPRINT 6: Soft delete
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }), // SPRINT 6: Multi-tenant
  sku: text("sku").notNull(), // SPRINT 6: Ya no es único global, solo por store
  nameInternal: text("name_internal").notNull(),
  price: numeric("price").notNull(),
  stock: integer("stock").default(0),
  categoryId: uuid("category_id").references(() => categories.id),
  isActive: boolean("is_active").default(true),
  isVisible: boolean("is_visible").default(false), // SPRINT 2: false por defecto (no publicado)
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // SPRINT 6: Soft delete
  // Campos adicionales (opcionales, para compatibilidad futura)
  name: text("name"),
  slug: text("slug"),
  description: text("description"),
  isFeatured: boolean("is_featured").default(false),
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

// SPRINT 3: Tabla para datos públicos del producto
export const productPublicData = pgTable("product_public_data", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT 5: Tabla para registrar movimientos de stock (opcional, para ventas futuras)
export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  difference: integer("difference").notNull(), // positivo = entrada, negativo = salida
  reason: text("reason"), // "venta", "ajuste", "compra", etc.
  createdAt: timestamp("created_at").defaultNow(),
});

