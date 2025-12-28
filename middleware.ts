import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractBearerToken, validateBearerToken } from "./src/lib/auth";

/**
 * Rutas que requieren autenticación
 */
const protectedRoutes = [
  "/api/products",
  "/api/categories",
  "/api/upload",
  "/api/sales",
  "/api/payments",
  "/api/payment-methods",
];

/**
 * Rutas que son públicas (no requieren autenticación para GET)
 */
const publicReadRoutes = [
  "/api/products",
  "/api/categories",
];

/**
 * Métodos HTTP que requieren autenticación (incluso en rutas públicas)
 */
const protectedMethods = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Rutas públicas que no requieren autenticación
 */
const publicRoutes = [
  "/api/auth/login",
];

/**
 * Middleware de autenticación
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // Si es una ruta pública, permitir acceso sin verificación
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Verificar si la ruta está protegida
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Si no es una ruta protegida, permitir acceso
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Verificar si es una ruta de lectura pública
  const isPublicReadRoute = publicReadRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Si es GET en ruta pública de lectura, permitir acceso
  if (isPublicReadRoute && method === "GET") {
    return NextResponse.next();
  }

  // Si es un método protegido o no es GET en ruta pública, requerir autenticación
  if (protectedMethods.includes(method) || !isPublicReadRoute) {
    // Extraer token del header Authorization
    const authHeader = request.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: "No autorizado. Token Bearer requerido." },
        { 
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          }
        }
      );
    }

    // Validar token
    const user = await validateBearerToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Token inválido o expirado." },
        { 
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          }
        }
      );
    }

    // Token válido, continuar con la request
    // Agregar información del usuario a los headers para uso en los endpoints
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-email", user.email || "");

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Permitir acceso por defecto
  return NextResponse.next();
}

/**
 * Configuración de rutas donde se aplica el middleware
 */
export const config = {
  matcher: [
    /*
     * Match todas las rutas de API excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (favicon)
     * - api/auth/login (endpoint de login público)
     */
    "/api/((?!auth/login|_next/static|_next/image|favicon.ico).*)",
  ],
};

