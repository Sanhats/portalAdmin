/**
 * Utilidades para respuestas de API consistentes
 */

export interface ApiError {
  error: string;
  details?: any;
  code?: string;
  hint?: string;
}

export interface ApiSuccess<T = any> {
  data?: T;
  message?: string;
  [key: string]: any;
}

/**
 * Crea una respuesta JSON con headers CORS y status code
 */
export function jsonResponse<T>(
  data: T | ApiError | ApiSuccess<T>,
  status: number = 200,
  headers: HeadersInit = {}
): Response {
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...headers,
  };

  return Response.json(data, { status, headers: defaultHeaders });
}

/**
 * Respuesta de error estándar
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: any,
  code?: string,
  hint?: string
): Response {
  const errorData: ApiError = { error };
  if (details) errorData.details = details;
  if (code) errorData.code = code;
  if (hint) errorData.hint = hint;

  return jsonResponse(errorData, status);
}

/**
 * Respuesta de éxito estándar
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  message?: string
): Response {
  const response: ApiSuccess<T> = { data };
  if (message) response.message = message;
  return jsonResponse(response, status);
}

/**
 * Maneja errores inesperados
 */
export function handleUnexpectedError(error: unknown, context: string): Response {
  console.error(`[${context}] Error inesperado:`, error);
  
  const errorMessage = error instanceof Error ? error.message : "Error desconocido";
  const errorStack = error instanceof Error ? error.stack : undefined;

  // En producción, no exponer el stack trace
  const isProduction = process.env.NODE_ENV === "production";

  return errorResponse(
    errorMessage,
    500,
    isProduction ? undefined : { stack: errorStack },
    "UNEXPECTED_ERROR"
  );
}

/**
 * Valida y normaliza parámetros de paginación
 */
export function validatePagination(
  pageParam: string | null,
  limitParam: string | null
): { page: number; limit: number; offset: number } {
  // Validar y normalizar página
  let page = parseInt(pageParam || "1", 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }
  // Límite máximo de 100 para evitar sobrecarga
  const MAX_LIMIT = 100;
  const MIN_LIMIT = 1;

  // Validar y normalizar límite
  let limit = parseInt(limitParam || "10", 10);
  if (isNaN(limit) || limit < MIN_LIMIT) {
    limit = 10;
  }
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

