# 애니 프레임(raw/<id>-a<seed>-0..4.png) → src/vfx/<id>.png 시트 (fix.py sheet) + 미리보기 dev/vfx3/view-<id>.png
#   powershell -File dev/vfx3/build.ps1 h04 h12 ...      (seed 3, 작은 덩어리 3칸 미만 지움)
param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $ids)
Set-Location (Split-Path $PSScriptRoot -Parent | Split-Path -Parent)
$r = 'dev/vfx3/raw'
foreach ($id in $ids) {
  $fr = 0..4 | ForEach-Object { "$r/$id-a3-$_.png" } | Where-Object { Test-Path $_ }
  if ($fr.Count -lt 5) { "skip $id ($($fr.Count) frames)"; continue }
  python -I dev/vfx3/fix.py sheet "src/vfx/$id.png" --min 3 @fr
  python -I dev/pixellab/sheet-view.py "dev/vfx3/view-$id.png" 4 "src/vfx/$id.png"
}
