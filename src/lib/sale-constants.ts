/**
 * Constantes y tipos para el sistema de ventas
 * SPRINT A: Consolidación de Ventas Internas
 */

// Estados válidos de venta
export const SALE_STATUSES = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  PAID: "paid",
  REFUNDED: "refunded",
} as const;

export type SaleStatus = typeof SALE_STATUSES[keyof typeof SALE_STATUSES];

// Estados que permiten edición
export const EDITABLE_STATUSES: SaleStatus[] = [
  SALE_STATUSES.DRAFT,
];

// Estados que permiten confirmación
export const CONFIRMABLE_STATUSES: SaleStatus[] = [
  SALE_STATUSES.DRAFT,
  SALE_STATUSES.IN_PROGRESS,
];

// Estados que permiten cancelación
export const CANCELLABLE_STATUSES: SaleStatus[] = [
  SALE_STATUSES.DRAFT,
  SALE_STATUSES.IN_PROGRESS,
  SALE_STATUSES.CONFIRMED,
];

// Estados que descuentan stock
export const STOCK_DEDUCTING_STATUSES: SaleStatus[] = [
  SALE_STATUSES.CONFIRMED,
  SALE_STATUSES.COMPLETED,
  SALE_STATUSES.PAID,
];

// Estados que permiten pagos
export const PAYMENT_ALLOWED_STATUSES: SaleStatus[] = [
  SALE_STATUSES.IN_PROGRESS,
  SALE_STATUSES.CONFIRMED,
  SALE_STATUSES.COMPLETED,
];

// Validar si un estado es válido
export function isValidSaleStatus(status: string): status is SaleStatus {
  return Object.values(SALE_STATUSES).includes(status as SaleStatus);
}

// Validar si un estado permite edición
export function isEditableStatus(status: SaleStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

// Validar si un estado permite confirmación
export function isConfirmableStatus(status: SaleStatus): boolean {
  return CONFIRMABLE_STATUSES.includes(status);
}

// Validar si un estado permite cancelación
export function isCancellableStatus(status: SaleStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

// Validar si un estado descuenta stock
export function isStockDeductingStatus(status: SaleStatus): boolean {
  return STOCK_DEDUCTING_STATUSES.includes(status);
}

// Validar si un estado permite pagos
export function isPaymentAllowedStatus(status: SaleStatus): boolean {
  return PAYMENT_ALLOWED_STATUSES.includes(status);
}

