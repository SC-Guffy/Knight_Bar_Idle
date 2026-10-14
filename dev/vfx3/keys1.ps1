# ⑤-3 기준 그림 1차 (create-image-pixen). 실행: powershell -File dev/vfx3/keys1.ps1
$env:PYTHONIOENCODING = 'utf-8'
Set-Location (Split-Path $PSScriptRoot -Parent | Split-Path -Parent)
$jobs = @(
 @('p2','b',16,24,24,'a single long slender arrow alone flying horizontally pointing right, long thin straight dark shaft, long needle sharp steel arrowhead on the right, small white feather fletching at the left end, a thin pale speed streak trailing behind, no bow, just the arrow'),
 @('h12','a',31,16,16,'a tiny sniper bullet impact, a small round puncture hole ring with a bright white rim, a few sharp debris fragments spraying backward to the right'),
 @('h13','a',32,24,24,'a small magic rune hit, a thin glowing cyan hexagram six pointed star inside a thin ring, breaking apart into small sparkles'),
 @('h14','a',33,24,24,'a heavy crossbow bolt impact, splintering wood shards and small grey iron fragments bursting outward from one point, a short flat horizontal shock flash'),
 @('h24','a',34,24,24,'a small sun flash hit, a bright white yellow round flare with a thin ring of curling orange solar flame tongues around it'),
 @('h25','a',35,24,24,'a small void rift hit, a jagged dark purple crack in space with bright magenta glowing edges, tiny specks being sucked inward toward the center'),
 @('h26','a',36,32,32,'a small cannon shell explosion hit, an orange fireball puff with a few square grey stone brick chunks flying outward and a little grey smoke'),
 @('e03','a',41,24,24,'a green glowing arrow splitting into three arrows that fan out to the right, a small bright green flash at the split point, short wind streaks'),
 @('e26','a',42,32,32,'a thick straight armor piercing energy beam shooting to the right, twisted spiral white hot core with yellow edges, small metal shards peeling off along it'),
 @('e27','a',43,16,16,'a small homing magic bolt, a bright cyan glowing orb with a curved comet tail of sparkles trailing behind on the left'),
 @('e29','a',44,32,32,'a falling star arrow streaking diagonally downward to the right, a glowing five pointed star at its tip with a long sparkling tail behind it'),
 @('e32','a',45,24,24,'a single heavy crossbow bolt stuck vertically into the ground pointing down, thick wooden shaft with leather fins on top, small dirt clods at the base'),
 @('k03','a',51,24,24,'several arrows stuck into one spot in a tight bundle, green feathers flying off, a small green wind sparkle burst'),
 @('k17','a',52,32,32,'a headshot impact, a bright white flash star with a thin targeting reticle ring around it and cracked glass lines radiating outward'),
 @('k18','a',53,32,32,'an armor piercing hole, a round punched hole in a steel plate with jagged torn metal petals curling outward and small metal shards flying'),
 @('k19','a',54,24,24,'a cyan magic bolt burst, a small explosion of cyan light with angular glowing rune fragments flying apart'),
 @('k20','a',55,24,24,'a star landing sparkle, a twinkling four pointed star flash touching the ground with small star shards bouncing out'),
 @('k22','a',56,24,24,'multiple crossbow bolt impacts, a cluster of small grey iron shards and sparks spraying out from several hit points'),
 @('f15','a',57,16,16,'a round black iron cannonball with a burning orange fuse spark and a short fire trail behind it')
)
foreach ($j in $jobs) {
  if (Test-Path "dev/vfx3/raw/$($j[0])$($j[1]).png") { continue }
  python -I dev/vfx3/pl3.py key $j[0] $j[1] $j[2] $j[3] $j[4] $j[5]
}
python -I dev/vfx3/pl3.py count
