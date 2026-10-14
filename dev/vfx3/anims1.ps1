# ⑤-3 애니메이션 1차 (animate-with-text-v3, 4프레임). 실행: powershell -File dev/vfx3/anims1.ps1
$env:PYTHONIOENCODING = 'utf-8'
Set-Location (Split-Path $PSScriptRoot -Parent | Split-Path -Parent)
$r = 'dev/vfx3/raw'
$jobs = @(
 @('h04', "$r/h04a.png", 3, 'the stuck arrow quivers and vibrates rapidly up and down, small wood splinters fly off and fade away'),
 @('h12', "$r/h12b.png", 3, 'bullet hole impact: the white ring flashes, the shards fly further out to the right and everything fades away'),
 @('h13', "$r/h13a.png", 3, 'the rune circle flashes bright, then the hexagram star breaks into small sparkles that fly outward and fade away'),
 @('h14', "$r/h14a.png", 3, 'the wood splinters and iron shards burst outward and tumble away, fading out completely'),
 @('h24', "$r/h24a.png", 3, 'the sun flare flashes brighter, the ring of flame tongues expands outward, then everything fades away'),
 @('h25', "$r/h25-p7.png", 3, 'the void crack shrinks and collapses inward into its center point and disappears'),
 @('h26', "$r/h26-p4.png", 3, 'the fireball expands, the stone chunks fly further outward, then smoke puffs drift and everything fades away'),
 @('k03', "$r/k03a.png", 3, 'the arrow bundle shakes, the green feathers flutter away outward and fade'),
 @('k17', "$r/k17c.png", 3, 'the white star flash pops bigger, the reticle ring shrinks tight inward, the crack lines spread, then everything fades away'),
 @('k18', "$r/k18a.png", 3, 'the torn metal petals bend further outward, small metal shards fly away, then the hole fades away'),
 @('k19', "$r/k19a.png", 3, 'cyan magic burst: flashes bright and breaks into angular rune fragments that fly apart and fade away'),
 @('k20', "$r/k20a.png", 3, 'the star sparkle twinkles and grows, small star shards bounce outward, then it fades away'),
 @('k21', "$r/k21-p7.png", 3, 'explosion: the fireball expands outward and breaks up into dark smoke puffs that drift outward and fade away'),
 @('k22', "$r/k22a.png", 3, 'the iron shards and sparks spray outward further and fade away'),
 @('k35', "$r/k35-p4.png", 3, 'the white star flashes, the ring of flames expands outward and whips into curling flame tongues, then fades away'),
 @('k36', "$r/k36-p1.png", 3, 'the black hole collapses: the spiral shrinks inward to a tiny point, then a bright thin ring bursts outward and fades'),
 @('k37', "$r/k37-p4.png", 3, 'the huge fireball expands, stone bricks fly outward, the castle crumbles and collapses into rubble, smoke billows and fades'),
 @('e28', "$r/e28-p6.png", 3, 'seamless looping animation: the glowing accretion disk swirls and rotates around the black center sphere'),
 @('e30', "$r/e30-p5.png", 3, 'seamless looping animation: the aurora curtains ripple and sway gently and the stars twinkle'),
 @('e31', "$r/e31-p5.png", 3, 'the mushroom cloud keeps rising and billowing bigger, the fire column dims, then the smoke thins out and fades away'),
 @('f12', "$r/f12-p6.png", 3, 'seamless looping animation: the flame prominences around the sun flicker, curl and wave, the sun pulses slightly'),
 @('f13', "$r/f13-p4.png", 3, 'seamless looping animation: the vortex inside the rift swirls, the magenta edges crackle and the floating shards drift'),
 @('p3', "$r/p3a.png", 3, 'seamless looping animation: the flame tail flickers and waves behind the burning arrow'),
 @('p5', "$r/p5a.png", 3, 'seamless looping animation: the void orb pulses and the dark wisps swirl into it')
)
foreach ($j in $jobs) {
  if (Test-Path "$r/$($j[0])-a$($j[2])-3.png") { continue }
  python -I dev/vfx3/pl3.py anim $j[0] $j[1] $j[2] $j[3]
}
python -I dev/vfx3/pl3.py count
