param(
  [string]$OutputDirectory = "dist"
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$outputRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
$version = (Get-Content -LiteralPath (Join-Path $projectRoot "VERSION") -Raw).Trim()
$packageName = "attribute-shogi-$version-itch"
$stage = [System.IO.Path]::GetFullPath((Join-Path $outputRoot $packageName))
$archive = [System.IO.Path]::GetFullPath((Join-Path $outputRoot "$packageName.zip"))

if (!$outputRoot.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar)) {
  throw "Output directory must remain inside the project."
}

$packageFiles = @(
  "index.html",
  "styles.css",
  "app.js",
  "game-core.js",
  "attributes.json",
  "service-worker.js",
  "manifest.webmanifest",
  "app-icon.svg",
  "icon-192.png",
  "icon-512.png",
  "fire-realistic-v1.png",
  "water-realistic-v1.png",
  "wind-realistic-v1.png",
  "RULES.md",
  "RULES_EN.md",
  "PRIVACY.md",
  "PRIVACY_EN.md",
  "LICENSE",
  "LICENSES.md",
  "BETA_TEST_GUIDE.md",
  "BETA_TEST_GUIDE_EN.md"
)

foreach ($relativePath in $packageFiles) {
  if (!(Test-Path -LiteralPath (Join-Path $projectRoot $relativePath))) {
    throw "Missing package file: $relativePath"
  }
}

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
if (Test-Path -LiteralPath $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}
if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}
New-Item -ItemType Directory -Path $stage | Out-Null

foreach ($relativePath in $packageFiles) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $relativePath) -Destination (Join-Path $stage $relativePath)
}

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $archive -CompressionLevel Optimal
Remove-Item -LiteralPath $stage -Recurse -Force

$archiveItem = Get-Item -LiteralPath $archive
Write-Output "Created: $($archiveItem.FullName)"
Write-Output "Size: $($archiveItem.Length) bytes"
