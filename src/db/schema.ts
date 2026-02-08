import { pgTable, text, uuid, timestamp, numeric, boolean, integer, jsonb } from "drizzle-orm/pg-core";

// SPRINT 6: Tabla de stores (tiendas) para multi-tenant
export const stores = pgTable("stores", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

// SPRINT 12: Tabla de branches (sucursales)
export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  address: text("address"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
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
  cost: numeric("cost"), // SPRINT ERP: Costo base del producto (nullable inicialmente)
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
  // SPRINT 1: Campos requeridos para núcleo comercial
  barcode: text("barcode"), // Código de barras (opcional)
  isWeighted: boolean("is_weighted").default(false), // Producto a granel
  unit: text("unit").default("unit"), // unit, kg, g
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

// SPRINT 1: Tabla de stock por producto
export const productStock = pgTable("product_stock", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull().unique(),
  stockCurrent: integer("stock_current").notNull().default(0),
  stockMin: integer("stock_min").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT 1: Tabla para registrar movimientos de stock (auditables)
export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }), // SPRINT 12: Sucursal
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // purchase, sale, adjustment, cancelation
  quantity: integer("quantity").notNull(), // + / -
  referenceId: uuid("reference_id"), // Opcional: referencia a purchase, sale, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT 1: Tabla de precios por lista (4 listas fijas)
export const productPrices = pgTable("product_prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  priceListId: integer("price_list_id").notNull(), // 1, 2, 3, 4
  price: numeric("price").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT 4: Clientes
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  document: text("document"), // DNI / CUIT (opcional, único por tenant)
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  active: boolean("active").default(true), // Soft delete
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT 2: Vendedores
export const sellers = pgTable("sellers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sistema de Ventas: Tabla principal de ventas
export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }), // SPRINT 12: Sucursal
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }), // SPRINT 4: Cliente (nullable → venta mostrador)
  sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "restrict" }), // SPRINT 2: Vendedor (backward compatibility)
  // SPRINT 4: Campos específicos
  date: timestamp("date").notNull().defaultNow(), // SPRINT 4: Fecha de venta
  subtotal: numeric("subtotal").notNull().default("0"), // SPRINT 4: Suma de ítems
  discountPercentage: numeric("discount_percentage").default("0"), // SPRINT 4: Porcentaje de descuento
  discountAmount: numeric("discount_amount").default("0"), // SPRINT 4: Monto de descuento (calculado)
  total: numeric("total").notNull().default("0"), // SPRINT 4: subtotal - discount_amount
  status: text("status").notNull().default("draft"), // SPRINT 4: draft | confirmed | cancelled
  // SPRINT 2: Campos adicionales (backward compatibility)
  discountTotal: numeric("discount_total").default("0"), // Alias de discount_amount
  paymentMethod: text("payment_method"), // cash, card, transfer, mixed
  cashReceived: numeric("cash_received"), // Efectivo recibido (nullable)
  changeGiven: numeric("change_given"), // Vuelto dado (nullable)
  taxes: numeric("taxes").default("0"), // Total de impuestos
  discounts: numeric("discounts").default("0"), // Total de descuentos (alias)
  totalAmount: numeric("total_amount").default("0"), // Total final (alias de total)
  costAmount: numeric("cost_amount").default("0"), // Costo total para cálculo de margen
  notes: text("notes"),
  createdBy: uuid("created_by"), // ID del usuario que creó la venta (backward compatibility)
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
  // SPRINT 4: Campos requeridos
  quantity: numeric("quantity").notNull(), // NUMERIC para soportar pesables
  unitPrice: numeric("unit_price").notNull(), // Precio unitario al momento de la venta
  totalPrice: numeric("total_price").notNull(), // SPRINT 4: quantity * unit_price
  // SPRINT A: Snapshot de producto al momento de la venta (inmutable)
  productName: text("product_name"), // Nombre del producto al momento de la venta
  productSku: text("product_sku"), // SKU del producto al momento de la venta
  variantName: text("variant_name"), // Nombre de la variante si aplica
  variantValue: text("variant_value"), // Valor de la variante si aplica
  unitCost: numeric("unit_cost"), // Costo unitario al momento de la venta (para margen)
  unitTax: numeric("unit_tax").default("0"), // Impuesto unitario
  unitDiscount: numeric("unit_discount").default("0"), // Descuento unitario
  subtotal: numeric("subtotal"), // Backward compatibility (alias de total_price)
  total: numeric("total"), // Backward compatibility (alias de total_price)
  stockImpacted: numeric("stock_impacted").default("0"), // Cantidad de stock que se descontó (NUMERIC para pesables)
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
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }), // SPRINT 12: Sucursal
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

// SPRINT 2: Sistema de Caja - Sesiones de Caja
export const cashSessions = pgTable("cash_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "restrict" }).notNull(),
  openingAmount: numeric("opening_amount").notNull().default("0"),
  closingAmount: numeric("closing_amount"), // Nullable hasta que se cierre
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"), // Nullable hasta que se cierre
  status: text("status").notNull().default("open"), // 'open' | 'closed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT 2: Movimientos de Caja
export const cashMovements = pgTable("cash_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  cashSessionId: uuid("cash_session_id").references(() => cashSessions.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // 'sale', 'refund', 'manual'
  amount: numeric("amount").notNull(),
  referenceId: uuid("reference_id"), // FK a sales.id si es sale/refund
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT B1: Sistema de Contabilidad Operativa - Cajas Diarias (backward compatibility)
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

// SPRINT B1: Sistema de Contabilidad Operativa - Movimientos de Caja (backward compatibility)
// Nota: Esta tabla se mantiene para compatibilidad, pero el Sprint 2 usa cash_movements con cashSessionId
export const cashBoxMovements = pgTable("cash_box_movements", {
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
  purchaseId: uuid("purchase_id"), // SPRINT ERP: FK opcional a purchases (para compras)
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT ERP: Sistema de Proveedores
// SPRINT 3: Proveedores
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  name: text("name").notNull(),
  contactName: text("contact_name"), // SPRINT 3: Nombre de contacto opcional
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"), // Notas adicionales sobre el proveedor
  isActive: boolean("is_active").default(true), // SPRINT 3: Soft delete con is_active
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Backward compatibility
});

// SPRINT 3: Sistema de Compras
export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(), // Multi-tenant
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }), // SPRINT 12: Sucursal
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "restrict" }).notNull(),
  invoiceNumber: text("invoice_number"), // SPRINT 3: Número de factura opcional
  purchaseDate: timestamp("purchase_date").notNull(), // SPRINT 3: Fecha de compra
  totalAmount: numeric("total_amount").notNull().default("0"), // SPRINT 3: Total de la compra
  notes: text("notes"), // Notas sobre la compra
  createdAt: timestamp("created_at").defaultNow(),
  // SPRINT 3: Campos adicionales para backward compatibility
  status: text("status").default("confirmed"), // Backward compatibility
  subtotal: numeric("subtotal").default("0"), // Backward compatibility
  totalCost: numeric("total_cost").default("0"), // Backward compatibility (alias de total_amount)
  createdBy: uuid("created_by"), // Backward compatibility
  confirmedAt: timestamp("confirmed_at"), // Backward compatibility
  receivedAt: timestamp("received_at"), // Backward compatibility
  cancelledAt: timestamp("cancelled_at"), // Backward compatibility
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT 3: Items de Compra
export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id").references(() => purchases.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
  variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }), // Nullable
  quantity: numeric("quantity").notNull(), // SPRINT 3: NUMERIC para soportar decimales
  unitCost: numeric("unit_cost").notNull(), // Costo unitario de compra
  subtotal: numeric("subtotal").notNull(), // SPRINT 3: quantity * unit_cost
  totalCost: numeric("total_cost"), // Backward compatibility (alias de subtotal)
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT: Rentabilidad real & egresos mínimos
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // alquiler, servicios, proveedores, otros
  amount: numeric("amount").notNull(),
  date: timestamp("date").notNull(),
  isRecurring: boolean("is_recurring").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT 5: Cuentas Corrientes
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  entityType: text("entity_type").notNull().default("customer"), // Solo 'customer' en este sprint
  entityId: uuid("entity_id").notNull(), // FK a customers (o futuras entidades)
  balance: numeric("balance").notNull().default("0"), // Solo informativo (cache)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SPRINT 5: Movimientos de Cuenta
export const accountMovements = pgTable("account_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // 'debit' | 'credit'
  amount: numeric("amount").notNull(),
  referenceType: text("reference_type").notNull(), // 'sale' | 'payment' | 'adjustment' | 'sale_cancelation'
  referenceId: uuid("reference_id"), // FK a sales, payments, etc.
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT 5: Pagos (versión simplificada para cuentas corrientes)
export const paymentsSprint5 = pgTable("payments_sprint5", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }), // SPRINT 12: Sucursal
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }).notNull(),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }), // Opcional
  amount: numeric("amount").notNull(),
  method: text("method").notNull(), // 'cash' | 'transfer' | 'card' | 'other'
  notes: text("notes"),
  // SPRINT 6: Campos de caja
  cashRegisterId: uuid("cash_register_id").references(() => cashRegisters.id, { onDelete: "restrict" }), // SPRINT 6: Caja asociada
  sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "restrict" }), // SPRINT 6: Vendedor
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT 6: Caja (Cash Registers)
export const cashRegisters = pgTable("cash_registers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }), // SPRINT 12: Sucursal
  sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "restrict" }).notNull(),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"), // Nullable, se establece al cerrar
  openingAmount: numeric("opening_amount").notNull().default("0"), // Monto inicial
  closingAmount: numeric("closing_amount"), // Monto declarado al cerrar
  status: text("status").notNull().default("open"), // 'open' | 'closed'
  createdAt: timestamp("created_at").defaultNow(),
});

// SPRINT 6: Cierres de Caja (Cash Closures)
export const cashClosures = pgTable("cash_closures", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  cashRegisterId: uuid("cash_register_id").references(() => cashRegisters.id, { onDelete: "cascade" }).notNull(),
  totalCash: numeric("total_cash").notNull().default("0"), // Total en efectivo
  totalTransfer: numeric("total_transfer").notNull().default("0"), // Total en transferencias
  totalCard: numeric("total_card").notNull().default("0"), // Total en tarjetas
  totalOther: numeric("total_other").notNull().default("0"), // Total en otros métodos
  totalIncome: numeric("total_income").notNull().default("0"), // Total de ingresos (suma de todos)
  difference: numeric("difference").notNull().default("0"), // closing_amount - total_income
  createdAt: timestamp("created_at").defaultNow(),
});