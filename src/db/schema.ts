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
  // SPRINT A: Estados extendidos: draft | in_progress | confirmed | completed | cancelled | paid | refunded
  status: text("status").notNull().default("draft"), 
  // SPRINT A: Totales persistidos
  subtotal: numeric("subtotal").default("0"), // Subtotal sin impuestos ni descuentos
  taxes: numeric("taxes").default("0"), // Total de impuestos
  discounts: numeric("discounts").default("0"), // Total de descuentos
  totalAmount: numeric("total_amount").notNull().default("0"), // Total final (subtotal + taxes - discounts)
  costAmount: numeric("cost_amount").default("0"), // Costo total para cálculo de margen
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
  // SPRINT A: Snapshot de producto al momento de la venta (inmutable)
  productName: text("product_name"), // Nombre del producto al momento de la venta
  productSku: text("product_sku"), // SKU del producto al momento de la venta
  variantName: text("variant_name"), // Nombre de la variante si aplica
  variantValue: text("variant_value"), // Valor de la variante si aplica
  unitPrice: numeric("unit_price").notNull(), // Precio unitario al momento de la venta
  unitCost: numeric("unit_cost"), // Costo unitario al momento de la venta (para margen)
  unitTax: numeric("unit_tax").default("0"), // Impuesto unitario
  unitDiscount: numeric("unit_discount").default("0"), // Descuento unitario
  subtotal: numeric("subtotal").notNull(), // Subtotal del item (quantity * unitPrice)
  stockImpacted: integer("stock_impacted").notNull().default(0), // Cantidad de stock que se descontó
});

// Sistema de Métodos de Pago: Métodos configurables por comercio
export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  code: text("code").notNull(), // 'cash', 'qr_mp', 'transfer_bbva', etc.
  label: text("label").notNull(), // "Efectivo", "QR Mercado Pago", etc.
  type: text("type").notNull(), // 'cash' | 'transfer' | 'qr' | 'card' | 'gateway' | 'other'
  // SPRINT B/C: Clasificación manual vs gateway vs external
  paymentCategory: text("payment_category").notNull().default("manual"), // 'manual' | 'gateway' | 'external'
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"), // JSON para datos adicionales (configuración, credenciales, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT C: Gateways de pago configurados por tenant
export const paymentGateways = pgTable("payment_gateways", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  provider: text("provider").notNull(), // 'mercadopago' | 'qr' | 'pos' | 'stripe' | etc.
  enabled: boolean("enabled").default(false), // Si el gateway está habilitado
  credentials: jsonb("credentials"), // Credenciales encriptadas (access_token, public_key, etc.)
  config: jsonb("config"), // Configuración adicional (webhook_url, auto_return, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT B: Intenciones de pago para gateways externos
export const paymentIntents = pgTable("payment_intents", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "cascade" }).notNull(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  amount: numeric("amount").notNull(),
  gateway: text("gateway").notNull(), // 'mercadopago', 'stripe', 'generic_qr', etc.
  status: text("status").notNull().default("created"), // 'created' | 'processing' | 'completed' | 'failed'
  expiresAt: timestamp("expires_at"), // Fecha de expiración de la intención
  externalReference: text("external_reference"), // ID externo de la pasarela
  gatewayMetadata: jsonb("gateway_metadata"), // Metadata de la pasarela
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }), // FK al pago creado (si aplica)
  createdBy: uuid("created_by").notNull(), // ID del usuario que creó la intención
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sistema de Pagos: Pagos de ventas
// SPRINT 1: Modelo definitivo de registro de cobros
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "cascade" }).notNull(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  amount: numeric("amount").notNull(),
  // SPRINT 1: Método de pago unificado
  method: text("method"), // cash | transfer | mp_point | qr | card | other
  paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, { onDelete: "set null" }), // FK a payment_methods
  // SPRINT 1: Estado simplificado: pending | confirmed
  status: text("status").notNull(), // pending | confirmed (backward compatibility: processing | failed | refunded)
  // SPRINT 1: Proveedor del pago
  provider: text("provider"), // manual | mercadopago | banco | pos
  reference: text("reference"), // Nro transferencia, comprobante, etc.
  // SPRINT 1: Metadata JSON para información adicional
  metadata: jsonb("metadata"), // JSON para datos adicionales
  // SPRINT 1: Auditoría de confirmación
  confirmedBy: uuid("confirmed_by"), // user_id | null (null = system)
  confirmedAt: timestamp("confirmed_at"), // Fecha de confirmación
  createdBy: uuid("created_by").notNull(), // ID del usuario que creó el pago
  // Preparación para pasarelas (Mercado Pago, etc.)
  externalReference: text("external_reference"), // ID externo de la pasarela (ej: payment_id de MP)
  gatewayMetadata: jsonb("gateway_metadata"), // Metadata JSON de la pasarela (webhooks, respuestas, etc.) - backward compatibility
  // SPRINT B: Idempotencia - Hash único para evitar duplicados por retries
  idempotencyKey: text("idempotency_key"), // Hash único basado en sale_id, amount, method, external_reference
  // SPRINT F: Campos de evidencia de pago (para QR/POS)
  proofType: text("proof_type"), // qr_code | receipt | transfer_screenshot | pos_ticket | other
  proofReference: text("proof_reference"), // Número de transacción, código QR, etc.
  proofFileUrl: text("proof_file_url"), // URL del archivo de evidencia
  // SPRINT F: Campos para POS (opcional)
  terminalId: text("terminal_id"), // ID del terminal POS
  cashRegisterId: text("cash_register_id"), // ID de la caja/turno
  // SPRINT I: Campos para motor de matching
  matchConfidence: numeric("match_confidence").default("0.0"), // 0.0 a 1.0
  matchedTransferId: uuid("matched_transfer_id"), // FK a incoming_transfers
  matchResult: text("match_result").default("no_match"), // 'matched_auto' | 'matched_suggested' | 'no_match'
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT H: Movimientos entrantes (transferencias recibidas)
export const incomingTransfers = pgTable("incoming_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  amount: numeric("amount").notNull(),
  reference: text("reference"), // Referencia única del pago (ej: SALE-8F3A)
  originLabel: text("origin_label"), // "BBVA", "MP", "NaranjaX", "MODO", etc.
  rawDescription: text("raw_description"), // Descripción completa de la transferencia
  source: text("source").notNull().default("manual"), // 'api' | 'csv' | 'manual'
  receivedAt: timestamp("received_at").notNull(), // Fecha/hora cuando se recibió el dinero
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT K: Auditoría de confirmaciones de pagos
export const paymentConfirmations = pgTable("payment_confirmations", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }).notNull(),
  transferId: uuid("transfer_id").references(() => incomingTransfers.id, { onDelete: "set null" }),
  confirmationType: text("confirmation_type").notNull(), // 'auto' | 'assisted' | 'manual'
  confidenceScore: numeric("confidence_score"), // Score de confianza usado para la decisión
  confirmedBy: uuid("confirmed_by"), // ID del usuario que confirmó (NULL si fue automático)
  confirmedAt: timestamp("confirmed_at").defaultNow(),
  reason: text("reason"), // Razón de la confirmación
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

// SPRINT B1: Sistema de Contabilidad Operativa - Cajas Diarias
export const cashBoxes = pgTable("cash_boxes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  date: timestamp("date").notNull(), // Fecha de la caja (solo fecha, sin hora)
  openingBalance: numeric("opening_balance").notNull().default("0"), // Saldo inicial
  closingBalance: numeric("closing_balance"), // Saldo final (calculado al cerrar)
  status: text("status").notNull().default("open"), // 'open' | 'closed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT B1: Sistema de Contabilidad Operativa - Movimientos de Caja
export const cashMovements = pgTable("cash_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  cashBoxId: uuid("cash_box_id").references(() => cashBoxes.id, { onDelete: "cascade" }).notNull(), // OBLIGATORIO
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  type: text("type").notNull(), // 'income' | 'expense'
  amount: numeric("amount").notNull(), // Monto del movimiento
  paymentMethod: text("payment_method").notNull(), // 'cash' | 'transfer'
  reference: text("reference"), // Texto descriptivo libre (ej: "Venta #1234", "Compra insumos")
  // Trazabilidad opcional
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }), // FK opcional a payments
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }), // FK opcional a sales
  createdAt: timestamp("created_at").defaultNow(),
});
