import { pgTable, text, uuid, timestamp, numeric, boolean, integer, jsonb } from "drizzle-orm/pg-core";

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
  // Posición manual para ordenar productos en la tienda / panel (SPRINT 9)
  position: integer("position").default(0),
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

// Sistema de Ventas: Tabla principal de ventas
export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  status: text("status").notNull().default("draft"), // draft | confirmed | cancelled | paid
  totalAmount: numeric("total_amount").notNull().default("0"),
  paymentMethod: text("payment_method"), // cash | transfer | mercadopago | other (backward compatibility)
  notes: text("notes"),
  createdBy: uuid("created_by").notNull(), // ID del usuario que creó la venta
  paymentStatus: text("payment_status"), // Preparado para Mercado Pago
  externalReference: text("external_reference"), // Preparado para Mercado Pago (vacío por ahora)
  // Campos financieros para snapshot
  paidAmount: numeric("paid_amount").default("0"), // Suma total de pagos confirmados
  balanceAmount: numeric("balance_amount").default("0"), // total_amount - paid_amount
  paymentCompletedAt: timestamp("payment_completed_at"), // Fecha cuando se completó el pago
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sistema de Ventas: Items de venta (productos en la venta)
export const saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }), // Nullable
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price").notNull(),
  subtotal: numeric("subtotal").notNull(),
});

// Sistema de Métodos de Pago: Métodos configurables por comercio
export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  code: text("code").notNull(), // 'cash', 'qr_mp', 'transfer_bbva', etc.
  label: text("label").notNull(), // "Efectivo", "QR Mercado Pago", etc.
  type: text("type").notNull(), // 'cash' | 'transfer' | 'qr' | 'card' | 'gateway' | 'other'
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"), // JSON para datos adicionales (configuración, credenciales, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

// Sistema de Pagos: Pagos de ventas
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "cascade" }).notNull(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  amount: numeric("amount").notNull(),
  method: text("method"), // cash | transfer | mercadopago | qr | card | gateway | other (backward compatibility)
  paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, { onDelete: "set null" }), // FK a payment_methods
  status: text("status").notNull().default("pending"), // pending | confirmed | failed | refunded
  reference: text("reference"), // Nro transferencia, comprobante, etc.
  createdBy: uuid("created_by").notNull(), // ID del usuario que creó el pago
  // Preparación para pasarelas (Mercado Pago, etc.)
  externalReference: text("external_reference"), // ID externo de la pasarela (ej: payment_id de MP)
  gatewayMetadata: jsonb("gateway_metadata"), // Metadata JSON de la pasarela (webhooks, respuestas, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

// Sistema de Auditoría: Eventos de pagos
export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }).notNull(),
  action: text("action").notNull(), // 'created' | 'deleted' | 'status_changed'
  previousState: jsonb("previous_state"), // Estado anterior del pago
  newState: jsonb("new_state"), // Nuevo estado del pago
  createdBy: uuid("created_by").notNull(), // ID del usuario que realizó la acción
  createdAt: timestamp("created_at").defaultNow(),
});

