# Script: Probar Mercado Pago In-Store API directamente
# Verifica si el access token tiene permisos para crear QR In-Store

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "",
    
    [Parameter(Mandatory=$false)]
    [string]$UserId = "1231202386",
    
    [Parameter(Mandatory=$false)]
    [string]$ExternalPosId = "POS_Toludev"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Probar Mercado Pago In-Store API Directamente" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obtener access token desde .env.local si no se proporciona
if ([string]::IsNullOrEmpty($AccessToken)) {
    $envFile = ".env.local"
    if (Test-Path $envFile) {
        Write-Host "Leyendo Access Token desde .env.local..." -ForegroundColor Gray
        $envLines = Get-Content $envFile
        foreach ($line in $envLines) {
            if ($line -match '^MERCADOPAGO_ACCESS_TOKEN\s*=\s*(.+)$') {
                $AccessToken = $matches[1].Trim()
                if ($AccessToken.StartsWith('"') -and $AccessToken.EndsWith('"')) {
                    $AccessToken = $AccessToken.Substring(1, $AccessToken.Length - 2)
                }
                if ($AccessToken.StartsWith("'") -and $AccessToken.EndsWith("'")) {
                    $AccessToken = $AccessToken.Substring(1, $AccessToken.Length - 2)
                }
                break
            }
        }
    }
}

if ([string]::IsNullOrEmpty($AccessToken)) {
    Write-Host "ERROR: Access Token no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "Configuracion:" -ForegroundColor Yellow
Write-Host "  User ID: $UserId" -ForegroundColor Gray
Write-Host "  External POS ID: $ExternalPosId" -ForegroundColor Gray
Write-Host "  Access Token: $($AccessToken.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

# Crear request body de prueba
$testSaleId = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
$testAmount = 100

$requestBody = @{
    external_reference = $testSaleId
    title = "Test Venta $testSaleId"
    description = "Pago de prueba"
    total_amount = $testAmount
    items = @(
        @{
            sku_number = $testSaleId
            category = "VENTA"
            title = "Test Item"
            description = "Item de prueba"
            unit_price = $testAmount
            quantity = 1
            unit_measure = "unit"
            total_amount = $testAmount
        }
    )
} | ConvertTo-Json -Depth 10

$apiUrl = "https://api.mercadopago.com/instore/orders/qr/seller/collectors/$UserId/pos/$ExternalPosId/qrs"

Write-Host "URL: $apiUrl" -ForegroundColor Gray
Write-Host "Body: $requestBody" -ForegroundColor Gray
Write-Host ""

Write-Host "Enviando request a Mercado Pago..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers -Body $requestBody -ErrorAction Stop
    
    Write-Host "SUCCESS: QR creado exitosamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "ERROR: $statusCode" -ForegroundColor Red
    Write-Host ""
    
    try {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        $errorJson = $errorBody | ConvertFrom-Json
        
        Write-Host "Error details:" -ForegroundColor Yellow
        $errorJson | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
        
        if ($errorJson.message -like "*user not found*") {
            Write-Host ""
            Write-Host "SOLUCION:" -ForegroundColor Cyan
            Write-Host "El access token no tiene permisos para In-Store API" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Pasos para solucionarlo:" -ForegroundColor White
            Write-Host "1. Ve a Mercado Pago Dashboard" -ForegroundColor Gray
            Write-Host "2. Credenciales -> Tu aplicacion" -ForegroundColor Gray
            Write-Host "3. Verifica que el access token tenga permisos de 'In-Store'" -ForegroundColor Gray
            Write-Host "4. Si no los tiene, solicita permisos adicionales o crea un nuevo access token" -ForegroundColor Gray
            Write-Host ""
            Write-Host "O verifica que:" -ForegroundColor White
            Write-Host "- El User ID ($UserId) sea correcto" -ForegroundColor Gray
            Write-Host "- El External POS ID ($ExternalPosId) exista en Mercado Pago" -ForegroundColor Gray
        }
    } catch {
        Write-Host "No se pudo leer el error detallado" -ForegroundColor Yellow
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

