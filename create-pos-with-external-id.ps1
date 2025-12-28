# Script: Crear POS con External ID usando la API
# Crea un nuevo POS con external_id asignado desde el inicio

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "",
    
    [Parameter(Mandatory=$false)]
    [string]$PosName = "POS_Toludev",
    
    [Parameter(Mandatory=$false)]
    [string]$ExternalId = "POS_Toludev",
    
    [Parameter(Mandatory=$false)]
    [string]$StoreId = "69325483"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Crear POS con External ID" -ForegroundColor Cyan
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
Write-Host "  Nombre: $PosName" -ForegroundColor Gray
Write-Host "  External ID: $ExternalId" -ForegroundColor Gray
Write-Host "  Store ID: $StoreId" -ForegroundColor Gray
Write-Host ""

# Verificar si ya existe un POS con este external_id
Write-Host "Verificando si existe POS con external_id '$ExternalId'..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    
    $posList = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos" -Method GET -Headers $headers -ErrorAction Stop
    
    $posArray = @()
    if ($posList.results) {
        $posArray = $posList.results
    } elseif ($posList -is [Array]) {
        $posArray = $posList
    }
    
    $existingPos = $posArray | Where-Object { $_.external_id -eq $ExternalId } | Select-Object -First 1
    
    if ($existingPos) {
        Write-Host "POS existente encontrado:" -ForegroundColor Green
        Write-Host "  ID: $($existingPos.id)" -ForegroundColor White
        Write-Host "  Nombre: $($existingPos.name)" -ForegroundColor White
        Write-Host "  External ID: $($existingPos.external_id)" -ForegroundColor White
        Write-Host ""
        Write-Host "Este POS ya existe. Usa este external_id en la configuracion." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "SQL para actualizar:" -ForegroundColor Yellow
        Write-Host "UPDATE payment_gateways" -ForegroundColor DarkGray
        Write-Host "SET config = jsonb_set(" -ForegroundColor DarkGray
        Write-Host "  config," -ForegroundColor DarkGray
        Write-Host "  '{mercadopago_external_pos_id}'," -ForegroundColor DarkGray
        Write-Host "  '\"$ExternalId\"'" -ForegroundColor DarkGray
        Write-Host ")" -ForegroundColor DarkGray
        Write-Host "WHERE provider = 'mercadopago'" -ForegroundColor DarkGray
        Write-Host "  AND tenant_id = '5fc90125-23b9-4200-bd86-c6edba203f16';" -ForegroundColor DarkGray
        exit 0
    }
    
    Write-Host "No existe POS con external_id '$ExternalId'. Creando nuevo..." -ForegroundColor Yellow
    Write-Host ""
    
    # Crear nuevo POS con external_id
    $posBody = @{
        name = $PosName
        fixed_amount = $false
        category = 621102
        external_id = $ExternalId
        store_id = $StoreId
    } | ConvertTo-Json -Depth 10
    
    Write-Host "Body de la solicitud:" -ForegroundColor Gray
    Write-Host $posBody -ForegroundColor DarkGray
    Write-Host ""
    
    $posResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos" `
        -Method POST `
        -Headers $headers `
        -Body $posBody `
        -ErrorAction Stop
    
    Write-Host "POS creado exitosamente" -ForegroundColor Green
    Write-Host "  ID: $($posResponse.id)" -ForegroundColor White
    Write-Host "  Nombre: $($posResponse.name)" -ForegroundColor White
    Write-Host "  External ID: $($posResponse.external_id)" -ForegroundColor White
    Write-Host ""
    
    Write-Host "SQL para actualizar configuracion:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "UPDATE payment_gateways" -ForegroundColor DarkGray
    Write-Host "SET config = jsonb_set(" -ForegroundColor DarkGray
    Write-Host "  config," -ForegroundColor DarkGray
    Write-Host "  '{mercadopago_external_pos_id}'," -ForegroundColor DarkGray
    Write-Host "  '\"$ExternalId\"'" -ForegroundColor DarkGray
    Write-Host ")" -ForegroundColor DarkGray
    Write-Host "WHERE provider = 'mercadopago'" -ForegroundColor DarkGray
    Write-Host "  AND tenant_id = '5fc90125-23b9-4200-bd86-c6edba203f16';" -ForegroundColor DarkGray
    Write-Host ""
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "ERROR: $statusCode" -ForegroundColor Red
    
    try {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        $errorJson = $errorBody | ConvertFrom-Json
        
        Write-Host "Error details:" -ForegroundColor Yellow
        $errorJson | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
        
    } catch {
        Write-Host "No se pudo leer detalles del error" -ForegroundColor Yellow
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}


