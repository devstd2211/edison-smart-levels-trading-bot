# PowerShell script to configure all 5 strategy configs
# Each config will have only one strategy enabled

$configsDir = "configs"

# Function to update JSON config
function Update-StrategyConfig {
    param (
        [string]$ConfigFile,
        [string]$Symbol,
        [string]$EnabledStrategy
    )

    Write-Host "Configuring $ConfigFile for $Symbol with $EnabledStrategy..." -ForegroundColor Cyan

    $json = Get-Content $ConfigFile -Raw | ConvertFrom-Json

    # Update symbol
    $json.exchange.symbol = $Symbol

    # Set mode to WHALE (for scalping strategies)
    if (-not $json.PSObject.Properties['mode']) {
        $json | Add-Member -MemberType NoteProperty -Name 'mode' -Value 'WHALE'
    } else {
        $json.mode = 'WHALE'
    }

    # Disable all main strategies
    $json.strategies.trendFollowing.enabled = $false
    $json.strategies.levelBased.enabled = $false
    $json.strategies.counterTrend.enabled = $false

    # Disable whale strategies
    if ($json.PSObject.Properties['whaleHunter']) {
        $json.whaleHunter.enabled = $false
    }
    if ($json.PSObject.Properties['whaleHunterFollow']) {
        $json.whaleHunterFollow.enabled = $false
    }

    # Disable all scalping strategies first
    if ($json.PSObject.Properties['scalpingMicroWall']) {
        $json.scalpingMicroWall.enabled = $false
    }
    if ($json.PSObject.Properties['scalpingLimitOrder']) {
        $json.scalpingLimitOrder.enabled = $false
    }
    if ($json.PSObject.Properties['scalpingLadderTp']) {
        $json.scalpingLadderTp.enabled = $false
    }
    if ($json.PSObject.Properties['scalpingTickDelta']) {
        $json.scalpingTickDelta.enabled = $false
    }
    if ($json.PSObject.Properties['scalpingOrderFlow']) {
        $json.scalpingOrderFlow.enabled = $false
    }

    # Enable the target strategy
    switch ($EnabledStrategy) {
        "scalpingMicroWall" { $json.scalpingMicroWall.enabled = $true }
        "scalpingLimitOrder" { $json.scalpingLimitOrder.enabled = $true }
        "scalpingLadderTp" { $json.scalpingLadderTp.enabled = $true }
        "scalpingTickDelta" { $json.scalpingTickDelta.enabled = $true }
        "scalpingOrderFlow" { $json.scalpingOrderFlow.enabled = $true }
    }

    # Save updated config
    $json | ConvertTo-Json -Depth 100 | Set-Content $ConfigFile

    Write-Host "  ✓ Updated $ConfigFile" -ForegroundColor Green
}

# Configure each strategy
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "Configuring Strategy Configs" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

Update-StrategyConfig -ConfigFile "$configsDir\config-microwall.json" -Symbol "SUIUSDT" -EnabledStrategy "scalpingMicroWall"
Update-StrategyConfig -ConfigFile "$configsDir\config-tickdelta.json" -Symbol "STRKUSDT" -EnabledStrategy "scalpingTickDelta"
Update-StrategyConfig -ConfigFile "$configsDir\config-laddertp.json" -Symbol "HYPEUSDT" -EnabledStrategy "scalpingLadderTp"
Update-StrategyConfig -ConfigFile "$configsDir\config-limitorder.json" -Symbol "ADAUSDT" -EnabledStrategy "scalpingLimitOrder"
Update-StrategyConfig -ConfigFile "$configsDir\config-orderflow.json" -Symbol "XLMUSDT" -EnabledStrategy "scalpingOrderFlow"

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "All configs configured!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Yellow
