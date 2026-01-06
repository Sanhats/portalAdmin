# Script para asignar rol directamente usando Supabase Admin API
# No requiere tener un usuario admin existente - usa service_role_key
# Uso: .\asignar-rol-directo-supabase.ps1 -UserId "d313f235-0b29-46fa-9e34-6396c1ae991d" -Role "manager"

param(
    [Parameter(Mandatory=$true)]
    [string]$UserId,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("admin", "super_admin", "manager", "cashier", "user")]
    [string]$Role,
    
    [string]$SupabaseUrl = "",
    [string]$ServiceRoleKey = ""
)

# Cargar variables de entorno desde .env.local si existe
if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local"
    foreach ($line in $envContent) {
        if ($line -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Limpiar comillas dobles, simples y espacios
            $value = $value.Trim('"', "'", ' ')
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Obtener credenciales de Supabase
if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
    $SupabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
}

if ([string]::IsNullOrWhiteSpace($ServiceRoleKey)) {
    $ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
}

# Limpiar comillas dobles y simples que puedan estar en las variables
if ($SupabaseUrl) {
    $SupabaseUrl = $SupabaseUrl.Trim('"', "'", ' ')
}
if ($ServiceRoleKey) {
    $ServiceRoleKey = $ServiceRoleKey.Trim('"', "'", ' ')
}

if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($ServiceRoleKey)) {
    Write-Host "❌ Error: Faltan credenciales de Supabase" -ForegroundColor Red
    Write-Host ""
    Write-Host "Asegúrate de tener en .env.local:" -ForegroundColor Yellow
    Write-Host "  NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co" -ForegroundColor Gray
    Write-Host "  SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key" -ForegroundColor Gray
    Write-Host ""
    Write-Host "O proporciona los parámetros:" -ForegroundColor Yellow
    Write-Host "  .\asignar-rol-directo-supabase.ps1 -UserId `"$UserId`" -Role `"$Role`" -SupabaseUrl `"https://...`" -ServiceRoleKey `"...`"" -ForegroundColor Gray
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Asignar Rol Directamente (Supabase Admin API)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usuario ID: $UserId" -ForegroundColor Yellow
Write-Host "Rol a asignar: $Role" -ForegroundColor Yellow
Write-Host "Supabase URL: $SupabaseUrl" -ForegroundColor Gray
Write-Host ""

# Construir URL de la API de Supabase Admin
$adminApiUrl = "$SupabaseUrl/auth/v1/admin/users/$UserId"

Write-Host "Actualizando usuario en Supabase..." -ForegroundColor Cyan

# Headers para Supabase Admin API
$headers = @{
    "Authorization" = "Bearer $ServiceRoleKey"
    "Content-Type" = "application/json"
    "apikey" = $ServiceRoleKey
}

# Body con user_metadata y app_metadata
$body = @{
    user_metadata = @{
        role = $Role
    }
    app_metadata = @{
        role = $Role
    }
} | ConvertTo-Json -Depth 3

try {
    Write-Host "Enviando solicitud a Supabase Admin API..." -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri $adminApiUrl -Method PUT -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host ""
    Write-Host "✅ ¡Rol asignado correctamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usuario actualizado:" -ForegroundColor Cyan
    Write-Host "  ID: $($response.id)" -ForegroundColor Gray
    Write-Host "  Email: $($response.email)" -ForegroundColor Gray
    Write-Host "  User Metadata Role: $($response.user_metadata.role)" -ForegroundColor Green
    Write-Host "  App Metadata Role: $($response.app_metadata.role)" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  IMPORTANTE - Próximos Pasos" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. El usuario debe hacer LOGOUT de la aplicación" -ForegroundColor Yellow
    Write-Host "2. Luego hacer LOGIN nuevamente" -ForegroundColor Yellow
    Write-Host "3. El nuevo token JWT incluirá el rol '$Role'" -ForegroundColor Yellow
    Write-Host "4. Ahora podrá usar los endpoints que requieren ese rol" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Error al asignar rol:" -ForegroundColor Red
    Write-Host ""
    
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
        Write-Host "  ❌ Service Role Key inválido" -ForegroundColor Red
        Write-Host "     → Verifica SUPABASE_SERVICE_ROLE_KEY en .env.local" -ForegroundColor Gray
    } elseif ($statusCode -eq 404) {
        Write-Host "  ❌ Usuario no encontrado" -ForegroundColor Red
        Write-Host "     → Verifica que el userId sea correcto: $UserId" -ForegroundColor Gray
    } elseif ($statusCode -eq 400) {
        Write-Host "  ❌ Datos inválidos" -ForegroundColor Red
        Write-Host "     → Verifica que el rol sea válido: $Role" -ForegroundColor Gray
    } elseif ($null -eq $statusCode) {
        Write-Host "  ❌ No se pudo conectar con Supabase" -ForegroundColor Red
        Write-Host "     → Verifica NEXT_PUBLIC_SUPABASE_URL en .env.local" -ForegroundColor Gray
    }
    
    Write-Host ""
    exit 1
}

