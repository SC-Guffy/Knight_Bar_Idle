# ⑤-3 시안 프롬프트 (ComfyUI). id = 스펙 텍스처 번호. (설명, 도트 크기, 생성 해상도)
# 게임은 시트를 밝기만 남겨 직업 색 램프로 다시 칠한다 → 색보다 "밝은 심 · 어두운 테두리" 명암 구조가 중요하다.
DRAFT = {
    'f12': ('a huge blazing pixel sun disc with a bright white hot core, orange and yellow concentric bands, '
            'several curling solar prominence flame loops arching off its rim, round, centered', (96, 96), (1024, 1024)),
    'f13': ('a jagged vertical dimensional rift tear in space with a swirling black hole vortex in its middle, '
            'magenta glowing cracked edges, shards of broken space floating around, centered', (64, 64), (1024, 1024)),
    'f14': ('a dark purple void background, a warped glowing magenta perspective grid of thin lines bending and '
            'sinking into one point in the middle like a funnel, faint stars, wide panorama', (240, 100), (1536, 640)),
    'e28': ('a magical singularity, a small perfectly black sphere in the center surrounded by a tilted thin glowing '
            'cyan accretion ring disc and spiral streaks of light being sucked inward, centered', (64, 64), (1024, 1024)),
    'e31': ('a mushroom cloud explosion, a thick rising fire column with a big rolling round smoke and fire cap on top, '
            'bright orange fire core, dark grey smoke billows outlined, ground dust skirt at the bottom', (48, 64), (768, 1024)),
    'e25': ('a sniper scope sight overlay, a thick round scope ring with crosshair lines and small tick marks, '
            'a cracked glass spider web fracture radiating from the center, yellow and white', (64, 64), (1024, 1024)),
    'e30': ('a small patch of night sky, deep navy blue with twinkling white stars and a flowing green cyan aurora ribbon '
            'across it, soft ragged edges fading out on every side', (96, 48), (1344, 672)),
    'k21': ('a cartoon fire explosion burst, a round puffy fireball with a bright white yellow core, orange flames and '
            'a ring of dark grey smoke puffs around it, a few flying sparks', (48, 48), (1024, 1024)),
    'k37': ('a gigantic castle destroying explosion, a huge fireball blast with flying stone bricks and rock chunks, '
            'thick smoke clouds billowing outward, bright white core', (64, 64), (1024, 1024)),
    'k35': ('a solar flare explosion, a white hot star burst with long curling orange flame prominences whipping outward '
            'in a ring, sun fire', (64, 64), (1024, 1024)),
    'k36': ('a black hole implosion, a dark sphere collapsing with magenta energy streaks spiraling inward and a '
            'bright ring shockwave bursting out, space distortion', (64, 64), (1024, 1024)),
    # 작은 명중·본체 (PixelLab 직접 생성이 빗나간 것)
    'h12': ('a tiny bullet impact hit spark, a small round bright white hole ring in the middle with short sharp grey debris '
            'fragments and sparks spraying out to the right in a narrow cone', (16, 16), (1024, 1024)),
    'h25': ('a small void rift hit, a short jagged black crack tear in space with thin bright magenta glowing edges, '
            'a few tiny purple specks being sucked into it', (24, 24), (1024, 1024)),
    'h26': ('a small cannon shell explosion hit, a compact orange fireball burst with a white core, a few square grey stone '
            'brick chunks flying outward and small grey smoke puffs, no face', (32, 32), (1024, 1024)),
    'e03': ('one glowing green arrow on the left splitting into three green arrows that fan out to the right like a trident, '
            'a small bright green flash at the split point, short wind streaks', (24, 24), (1024, 1024)),
    'e26': ('a long thick straight piercing energy beam shooting horizontally to the right, a twisted spiral white hot core '
            'with golden yellow edges, small sharp metal shards peeling off along the beam', (64, 16), (1536, 384)),
}
