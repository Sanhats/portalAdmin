# Script específico para asignar rol 'manager' al usuario test3@toludev.com
# Usa Supabase Admin API directamente (no requiere usuario admin existente)
# ID: d313f235-0b29-46fa-9e34-6396c1ae991d

$UserId = "d313f235-0b29-46fa-9e34-6396c1ae991d"
$Role = "manager"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Asignar Rol a test3@toludev.com" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usuario: test3@toludev.com" -ForegroundColor Yellow
Write-Host "ID: $UserId" -ForegroundColor Gray
Write-Host "Rol a asignar: $Role" -ForegroundColor Yellow
Write-Host ""

# Cargar variables de entorno desde .env.local
if (Test-Path ".env.local") {
    Write-Host "Cargando credenciales desde .env.local..." -ForegroundColor Gray
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
} else {
    Write-Host "⚠️  No se encontró .env.local" -ForegroundColor Yellow
}

# Obtener credenciales y limpiar comillas
$SupabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY

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
    Write-Host "O proporciona las credenciales manualmente:" -ForegroundColor Yellow
    if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
        $SupabaseUrl = Read-Host "Supabase URL"
        $SupabaseUrl = $SupabaseUrl.Trim('"', "'", ' ')
    }
    if ([string]::IsNullOrWhiteSpace($ServiceRoleKey)) {
        $ServiceRoleKey = Read-Host "Service Role Key"
        $ServiceRoleKey = $ServiceRoleKey.Trim('"', "'", ' ')
    }
}

if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($ServiceRoleKey)) {
    Write-Host "❌ Credenciales requeridas" -ForegroundColor Red
    exit 1
}

Write-Host "Supabase URL: $SupabaseUrl" -ForegroundColor Gray
if ($ServiceRoleKey) {
    Write-Host "Service Role Key: $($ServiceRoleKey.Substring(0, [Math]::Min(20, $ServiceRoleKey.Length)))..." -ForegroundColor Gray
}
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
    Write-Host "1. El usuario test3@toludev.com debe hacer LOGOUT" -ForegroundColor Yellow
    Write-Host "2. Luego hacer LOGIN nuevamente" -ForegroundColor Yellow
    Write-Host "3. El nuevo token JWT incluirá el rol '$Role'" -ForegroundColor Yellow
    Write-Host "4. Ahora podrá confirmar pagos en /api/payments/:id/confirm" -ForegroundColor Green
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
        Write-Host "     → Obtén la key desde: Supabase Dashboard → Settings → API → service_role (secret)" -ForegroundColor Gray
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

