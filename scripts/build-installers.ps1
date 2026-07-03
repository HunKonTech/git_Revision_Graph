<#
.SYNOPSIS
    Elkészíti a Git Revision Graph összes telepítőjét.

.DESCRIPTION
    Egyetlen szkript, amely az összes platformra előállítja a csomagokat:

      1. VS Code .vsix          (standard, VS Code 1.85+)
      2. Visual Studio 2022 VSIX
      3. Visual Studio 2026 VSIX

    A közös web renderert (packages/graph-webview) egyszer buildeli, majd
    minden host becsomagolja a saját igényei szerint.

    A kimenet a dist\installers\ mappába kerül.

    Előfeltételek (Visual Studio VSIX-hez):
      - Windows 10/11
      - Visual Studio 2022 vagy 2026 az „Extension development" workload-dal
      - Node.js 18+ a PATH-on
      - Git a PATH-on

.PARAMETER Configuration
    MSBuild build-konfiguráció a VS projektekhez. Alap: Release.

.PARAMETER VSCodeOnly
    Csak a VS Code .vsix csomagokat állítja elő (átugorja a VS VSIX-eket).

.PARAMETER SkipVSCode
    Átugorja a VS Code csomagokat; csak a Visual Studio VSIX-eket gyártja.

.EXAMPLE
    # Összes csomag egyszerre
    pwsh scripts\build-installers.ps1

    # Csak a VS Code variánsok (platformfüggetlen gépen is futtatható)
    pwsh scripts\build-installers.ps1 -VSCodeOnly

    # Csak Visual Studio VSIX (2022 + 2026)
    pwsh scripts\build-installers.ps1 -SkipVSCode
#>
[CmdletBinding()]
param(
    [string]$Configuration  = "Release",
    [switch]$VSCodeOnly,
    [switch]$SkipVSCode
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)    { Write-Host "    [OK]  $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "    [--]  $msg" -ForegroundColor Yellow }
function Fail($msg)  { Write-Host "    [!!]  $msg" -ForegroundColor Red; throw $msg }

$installers = Join-Path $root "dist\installers"
New-Item -ItemType Directory -Force -Path $installers | Out-Null

# ---------------------------------------------------------------------------
# 1. Közös alapok: npm + shared web renderer
# ---------------------------------------------------------------------------
Step "npm install"
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install sikertelen." }

Step "Közös web renderer + asset másolás"
npm run build:core
npm run build:webview
npm run build:vscode        # VS Code extension bundle
npm run build:vs-assets       # -> vs\webview\
npm run build:jetbrains-assets # -> jetbrains\common\src\main\resources\webview\
if ($LASTEXITCODE -ne 0) { Fail "Build sikertelen." }

# ---------------------------------------------------------------------------
# 2. VS Code .vsix (standard, engine ^1.85)
# ---------------------------------------------------------------------------
if (-not $SkipVSCode) {
    Step "VS Code extension csomagolása (standard)"
    # A shared renderert fentebb (build:webview) már felépítettük, ezért a
    # package-vscode.mjs ne fordítsa újra — egy felesleges esbuild-spawn-nal
    # kevesebb a memóriaszűkös runneren (lásd 0xC0000409 összeomlás).
    $env:REV_GRAPH_SKIP_WEBVIEW_BUILD = "1"
    try {
        node scripts\package-vscode.mjs
    } finally {
        Remove-Item Env:\REV_GRAPH_SKIP_WEBVIEW_BUILD -ErrorAction SilentlyContinue
    }
    if ($LASTEXITCODE -ne 0) { Fail "VS Code csomag előállítása sikertelen." }
    $vsixFile = Get-ChildItem "$installers\rev-graph-vscode-*.vsix" |
                Where-Object { $_.Name -notmatch "vs2026" } |
                Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Ok "VS Code (standard): $($vsixFile.Name)"
}

if ($VSCodeOnly) {
    Step "Kész — csak VS Code csomagok."
    Get-ChildItem $installers | Format-Table Name, @{L="Méret (KB)";E={[math]::Round($_.Length/1KB,1)}}
    return
}

# ---------------------------------------------------------------------------
# 3. Visual Studio VSIX (2022 + 2026) MSBuild-del
# ---------------------------------------------------------------------------
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$csproj   = Join-Path $root "vs\RevisionGraph.csproj"

function Build-VSIX {
    param(
        [string]$VersionRange,
        [string]$Label,
        [switch]$Prerelease
    )
    $vsArgs = @(
        "-version",  $VersionRange,
        "-latest",
        "-requires", "Microsoft.VisualStudio.Workload.VisualStudioExtension",
        "-property", "installationPath"
    )
    if ($Prerelease) { $vsArgs += "-prerelease" }

    $installPath = & $vswhere @vsArgs
    if (-not $installPath) {
        Warn "Visual Studio $Label ($VersionRange) nem található — kihagyva."
        return
    }

    $msbuild = Join-Path $installPath "MSBuild\Current\Bin\MSBuild.exe"
    if (-not (Test-Path $msbuild)) {
        Warn "MSBuild nem található $Label telepítőjénél: $msbuild"
        return
    }

    Step "Visual Studio $Label VSIX fordítása ($installPath)"
    & $msbuild $csproj /t:Restore,Rebuild `
        /p:Configuration=$Configuration `
        /p:Platform=AnyCPU `
        /p:DeployExtension=false `
        /v:minimal
    if ($LASTEXITCODE -ne 0) { Fail "MSBuild sikertelen ($Label, kilépési kód: $LASTEXITCODE)." }

    # Az MSBuild a bin\<Configuration>\ mappába rakja a .vsix fájlt.
    $built = Join-Path $root "vs\bin\$Configuration\RevisionGraph.vsix"
    if (-not (Test-Path $built)) {
        Warn "VSIX nem keletkezett $Label-hez: $built"
        return
    }

    $dest = Join-Path $installers "RevisionGraph-$Label.vsix"
    Copy-Item $built $dest -Force
    Ok "Visual Studio $Label VSIX: $($dest | Split-Path -Leaf)"
}

if (-not (Test-Path $vswhere)) {
    Warn "vswhere.exe nem található. VS VSIX fordítás kihagyva."
    Warn "Telepítsd a Visual Studio 2022/2026-ot 'Visual Studio extension development' workload-dal."
} else {
    Build-VSIX -VersionRange "[17.0,18.0)" -Label "vs2022"
    Build-VSIX -VersionRange "[18.0,19.0)" -Label "vs2026" -Prerelease
}

# ---------------------------------------------------------------------------
# 4. JetBrains-family pluginok (IntelliJ Platform / Gradle)
#    Egy multi-project (jetbrains/) HÁROM ZIP-et gyárt a közös kódból:
#    :deveco (DevEco Studio), :intellij (IntelliJ IDEA / JetBrains IDE-k) és
#    :androidstudio (Android Studio). A `buildPlugin` mindhárom al-projektre
#    lefut. A Marketplace-publikálás az :intellij/:androidstudio flavoroknál
#    külön, opcionális lépés (lásd jetbrains/BUILD.md).
# ---------------------------------------------------------------------------
$jetbrainsDir = Join-Path $root "jetbrains"
$gradlew   = if ($IsWindows) { Join-Path $jetbrainsDir "gradlew.bat" } else { Join-Path $jetbrainsDir "gradlew" }
$gradleCmd = if (Test-Path $gradlew) { $gradlew } elseif (Get-Command gradle -ErrorAction SilentlyContinue) { "gradle" } else { $null }

if (-not $gradleCmd) {
    Warn "Sem jetbrains/gradlew, sem rendszer-Gradle nem található — JetBrains pluginok kihagyva."
    Warn "Lásd jetbrains/BUILD.md: 'gradle wrapper --gradle-version 8.9' a jetbrains/ mappában."
} elseif (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Warn "JDK nem található a PATH-on — JetBrains pluginok kihagyva."
} else {
    Step "JetBrains pluginok fordítása (Gradle, mindkét flavor)"
    Push-Location $jetbrainsDir
    try {
        & $gradleCmd buildPlugin --no-daemon
        if ($LASTEXITCODE -ne 0) { Fail "JetBrains plugin build sikertelen." }
    } finally {
        Pop-Location
    }
    $flavors = @(
        @{ Dir = "deveco";        Asset = "RevisionGraph-deveco.zip"        },
        @{ Dir = "intellij";      Asset = "RevisionGraph-jetbrains.zip"      },
        @{ Dir = "androidstudio"; Asset = "RevisionGraph-androidstudio.zip" }
    )
    foreach ($f in $flavors) {
        $builtZip = Get-ChildItem "$jetbrainsDir\$($f.Dir)\build\distributions\*.zip" -ErrorAction SilentlyContinue |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($builtZip) {
            $dest = Join-Path $installers $f.Asset
            Copy-Item $builtZip.FullName $dest -Force
            Ok "JetBrains plugin ($($f.Dir)): $($dest | Split-Path -Leaf)"
        } else {
            Warn "Nem található a build kimenete: $jetbrainsDir\$($f.Dir)\build\distributions\*.zip"
        }
    }
}

# ---------------------------------------------------------------------------
# 5. Apache NetBeans plugin (NetBeans module / Maven + nbm-maven-plugin)
#    Kotlin modul, ami a közös git/DTO Kotlint a JetBrains hostból húzza be
#    (jetbrains/common/.../git + model) — csak a NetBeans platform-glue saját.
#    A `mvn package` egy sideloadolható .nbm-et gyárt. A Plugin Portal listázás
#    egyszeri kézi lépés (lásd netbeans/BUILD.md).
# ---------------------------------------------------------------------------
$netbeansPom = Join-Path $root "netbeans\pom.xml"
$mvnCmd = if (Get-Command mvn -ErrorAction SilentlyContinue) { "mvn" } else { $null }

if (-not (Test-Path $netbeansPom)) {
    Warn "netbeans/pom.xml nem található — NetBeans plugin kihagyva."
} elseif (-not $mvnCmd) {
    Warn "Maven (mvn) nem található a PATH-on — NetBeans plugin kihagyva. Lásd netbeans/BUILD.md."
} elseif (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Warn "JDK nem található a PATH-on — NetBeans plugin kihagyva."
} else {
    Step "NetBeans plugin fordítása (Maven, nbm-maven-plugin)"
    & $mvnCmd -B -f $netbeansPom -DskipTests clean package
    if ($LASTEXITCODE -ne 0) { Fail "NetBeans plugin build sikertelen." }
    $builtNbm = Get-ChildItem (Join-Path $root "netbeans\target\*.nbm") -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($builtNbm) {
        $dest = Join-Path $installers "RevisionGraph-netbeans.nbm"
        Copy-Item $builtNbm.FullName $dest -Force
        Ok "NetBeans plugin: $($dest | Split-Path -Leaf)"
    } else {
        Warn "Nem található a build kimenete: netbeans\target\*.nbm"
    }
}

# ---------------------------------------------------------------------------
# Összefoglaló
# ---------------------------------------------------------------------------
Step "Kész. Telepítők:"
Get-ChildItem "$installers\*" -Include "*.vsix", "*.zip", "*.nbm" -File |
    Sort-Object Name |
    Format-Table Name, @{L="Méret (KB)";E={[math]::Round($_.Length/1KB,1)}}
