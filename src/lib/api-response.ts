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
 * @param pageParam - Parámetro de página
 * @param limitParam - Parámetro de límite (puede ser número o "all")
 * @param isAdmin - Si el usuario es admin (permite limit=all y límites más altos)
 * @returns Objeto con page, limit (número o "all"), offset, y si es modo "all"
 */
export function validatePagination(
  pageParam: string | null,
  limitParam: string | null,
  isAdmin: boolean = false
): { page: number; limit: number | "all"; offset: number; isAllMode: boolean } {
  // Validar y normalizar página
  let page = parseInt(pageParam || "1", 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  // Límites configurables
  const DEFAULT_LIMIT = 50;
  const MAX_LIMIT_NORMAL = 100; // Límite máximo para usuarios no admin
  const MAX_LIMIT_ADMIN = 10000; // Límite máximo para admin
  const MIN_LIMIT = 1;

  // Verificar si se solicita "all"
  const isAllMode = limitParam?.toLowerCase() === "all";

  // Si se solicita "all" pero no es admin, rechazar
  if (isAllMode && !isAdmin) {
    throw new Error("limit=all solo está disponible para administradores");
  }

  let limit: number | "all";
  let offset: number;

  if (isAllMode) {
    // Modo "all": devolver todos los registros
    limit = "all";
    offset = 0;
    page = 1; // En modo "all", siempre es página 1
  } else {
    // Validar y normalizar límite numérico
    let limitNum = parseInt(limitParam || String(DEFAULT_LIMIT), 10);
    if (isNaN(limitNum) || limitNum < MIN_LIMIT) {
      limitNum = DEFAULT_LIMIT;
    }

    // Aplicar límite máximo según rol
    const maxLimit = isAdmin ? MAX_LIMIT_ADMIN : MAX_LIMIT_NORMAL;
    if (limitNum > maxLimit) {
      limitNum = maxLimit;
    }

    limit = limitNum;
    offset = (page - 1) * limit;
  }

  return { page, limit, offset, isAllMode };
}




