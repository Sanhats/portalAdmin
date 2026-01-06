# Script específico para asignar rol 'manager' al usuario test3@toludev.com
# ID: d313f235-0b29-46fa-9e34-6396c1ae991d
# Este script usa un token predefinido

$BaseUrl = "http://localhost:3000"
$UserId = "d313f235-0b29-46fa-9e34-6396c1ae991d"
$Role = "manager"

# Token proporcionado (pero este es del usuario test3, necesitamos uno de admin)
$providedToken = "eyJhbGciOiJIUzI1NiIsImtpZCI6IitsTFI5akw3MjJLNXFXTFIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3VmYnpwY2RucXd1dGx2aHdoenRzLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJkMzEzZjIzNS0wYjI5LTQ2ZmEtOWUzNC02Mzk2YzFhZTk5MWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY3Njc0NDI0LCJpYXQiOjE3Njc2NzA4MjQsImVtYWlsIjoidGVzdDNAdG9sdWRldi5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2NzY3MDgyNH1dLCJzZXNzaW9uX2lkIjoiNjFmOTdkMjItNDNiNi00MDYxLWIzYTktNjRlZWQ3YjkyMzM3IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.GJDbQikTel7Boi7ul92MaywNgiuiISqfAtII9pAtd2s"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Asignar Rol a Usuario" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usuario: test3@toludev.com" -ForegroundColor Yellow
Write-Host "ID: $UserId" -ForegroundColor Gray
Write-Host "Rol a asignar: $Role" -ForegroundColor Yellow
Write-Host ""

# Limpiar el token
$adminToken = $providedToken -replace "[\x00-\x1F\x7F]", ""
$adminToken = $adminToken.Trim()

Write-Host "⚠️  IMPORTANTE: El token proporcionado es del usuario test3@toludev.com" -ForegroundColor Yellow
Write-Host "   Para asignar roles, necesitas un token de un usuario ADMIN" -ForegroundColor Yellow
Write-Host ""
Write-Host "¿Deseas continuar con este token? (probablemente fallará con error 403)" -ForegroundColor Cyan
Write-Host "O mejor, ingresa un token de admin:" -ForegroundColor Cyan
Write-Host ""
$useProvidedToken = Read-Host "Usar token proporcionado? (S/N, o ingresa nuevo token de admin)"

if ($useProvidedToken -ne "S" -and $useProvidedToken -ne "s" -and $useProvidedToken -ne "Y" -and $useProvidedToken -ne "y") {
    if ($useProvidedToken -and $useProvidedToken.Length -gt 50) {
        # Parece un token nuevo
        $adminToken = $useProvidedToken -replace "[\x00-\x1F\x7F]", ""
        $adminToken = $adminToken.Trim()
        Write-Host "✅ Usando el nuevo token proporcionado" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Para obtener un token de admin, ejecuta:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host '$loginResponse = Invoke-RestMethod -Uri "' -NoNewline -ForegroundColor Gray
        Write-Host "$BaseUrl/api/auth/login" -NoNewline -ForegroundColor White
        Write-Host '" -Method POST -ContentType "application/json" -Body ''{"email":"admin@example.com","password":"tu_password"}''' -ForegroundColor Gray
        Write-Host '$adminToken = $loginResponse.session.access_token' -ForegroundColor Gray
        Write-Host ""
        Write-Host "Luego ejecuta este script nuevamente con el token de admin" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "⚠️  Usando el token proporcionado (puede fallar si no es de admin)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "PASO 2: Asignando rol '$Role' al usuario..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

$body = @{
    role = $Role
} | ConvertTo-Json -Compress

try {
    # Validar que el servidor esté disponible
    Write-Host "Verificando conexión con el servidor..." -ForegroundColor Gray
    $testConnection = try {
        Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method OPTIONS -TimeoutSec 5 -ErrorAction Stop
        $true
    } catch {
        $false
    }
    
    if (-not $testConnection) {
        Write-Host "⚠️  No se pudo conectar con el servidor en $BaseUrl" -ForegroundColor Yellow
        Write-Host "   ¿Está el servidor corriendo?" -ForegroundColor Yellow
    }
    
    Write-Host "Enviando solicitud..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/admin/users/$UserId/role" -Method PATCH -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host ""
    Write-Host "✅ ¡Rol asignado correctamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usuario:" -ForegroundColor Cyan
    Write-Host "  ID: $($response.user.id)" -ForegroundColor Gray
    Write-Host "  Email: test3@toludev.com" -ForegroundColor Gray
    Write-Host "  Rol: $($response.user.role)" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  IMPORTANTE - Próximos Pasos" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. El usuario test3@toludev.com debe hacer LOGOUT" -ForegroundColor Yellow
    Write-Host "2. Luego hacer LOGIN nuevamente" -ForegroundColor Yellow
    Write-Host "3. El nuevo token JWT incluirá el rol 'manager'" -ForegroundColor Yellow
    Write-Host "4. Ahora podrá confirmar pagos en /api/payments/:id/confirm" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Error al asignar rol:" -ForegroundColor Red
    Write-Host ""
    
    # Intentar obtener detalles del error
    $errorMessage = $_.Exception.Message
    $statusCode = $null
    
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode.value__
        Write-Host "  Código de estado: $statusCode" -ForegroundColor Red
    }
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "  Error: $($errorDetails.error)" -ForegroundColor Red
            if ($errorDetails.details) {
                Write-Host "  Detalles: $($errorDetails.details)" -ForegroundColor Red
            }
            if ($errorDetails.message) {
                Write-Host "  Mensaje: $($errorDetails.message)" -ForegroundColor Red
            }
        } catch {
            Write-Host "  $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "  $errorMessage" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Posibles causas:" -ForegroundColor Yellow
    
    if ($statusCode -eq 401) {
        Write-Host "  ❌ Token inválido o expirado" -ForegroundColor Red
        Write-Host "     → Haz login nuevamente para obtener un token fresco" -ForegroundColor Gray
    } elseif ($statusCode -eq 403) {
        Write-Host "  ❌ El usuario del token NO tiene permisos de admin" -ForegroundColor Red
        Write-Host "     → El token proporcionado es de test3@toludev.com, no de un admin" -ForegroundColor Red
        Write-Host "     → Necesitas un token de un usuario con rol 'admin' o 'super_admin'" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Para obtener un token de admin:" -ForegroundColor Cyan
        Write-Host '    $loginResponse = Invoke-RestMethod -Uri "' -NoNewline -ForegroundColor Gray
        Write-Host "$BaseUrl/api/auth/login" -NoNewline -ForegroundColor White
        Write-Host '" -Method POST -ContentType "application/json" -Body ''{"email":"admin@example.com","password":"tu_password"}''' -ForegroundColor Gray
        Write-Host '    $adminToken = $loginResponse.session.access_token' -ForegroundColor Gray
        Write-Host '    Write-Host $adminToken' -ForegroundColor Gray
    } elseif ($statusCode -eq 404) {
        Write-Host "  ❌ Usuario no encontrado" -ForegroundColor Red
        Write-Host "     → Verifica que el userId sea correcto: $UserId" -ForegroundColor Gray
    } elseif ($statusCode -eq 400) {
        Write-Host "  ❌ Datos inválidos" -ForegroundColor Red
        Write-Host "     → Verifica que el rol sea válido: $Role" -ForegroundColor Gray
    } elseif ($null -eq $statusCode) {
        Write-Host "  ❌ No se pudo conectar con el servidor" -ForegroundColor Red
        Write-Host "     → Verifica que el servidor esté corriendo en $BaseUrl" -ForegroundColor Gray
    }
    
    Write-Host ""
    exit 1
}

