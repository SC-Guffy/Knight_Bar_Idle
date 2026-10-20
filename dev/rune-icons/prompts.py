# 룬 아이콘 프롬프트 (docs/specs/rune-icons.md "규칙"). 틀 셋: 판석(범용) · 육각 결정(모양) · 금테 메달(전설)
FRAME = {
    'slab': 'a single ancient rune stone icon, rounded grey-blue carved stone tablet seen from the front, chipped edges, '
            'a big bold glowing {col} pictogram carved into its face that fills most of the stone: {glyph}, simple readable silhouette, NO circle, NO ring, NO round border around the symbol, glowing {col} light, '
            'fantasy RPG inventory item icon, centered, fills the frame, high contrast, clean shapes',
    'crystal': 'a single large tall hexagonal rune crystal icon standing upright, filling the entire frame from top edge to bottom edge, faceted dark stone crystal with sharp pointed top and bottom, '
               'a glowing {col} magic symbol inside it: {glyph}, bright {col} glow and light facets, '
               'fantasy RPG inventory item icon, centered, fills the frame, high contrast, clean shapes',
    'legend': 'a single legendary rune amulet icon, round dark stone medallion inside an ornate golden frame with small gold spikes and a gem at the top, '
              'a large radiant {col} emblem in the center: {glyph}, intense {col} glow, golden highlights, '
              'epic fantasy RPG inventory item icon, centered, fills the frame, high contrast, clean shapes',
}
RUNES = {
    # 범용 (판석)
    'exec': ('slab', 'crimson red', 'a skull with an executioner axe blade above it'),
    'boss': ('slab', 'amber gold', 'a big crown with a crack down its middle'),
    'first': ('slab', 'pale yellow', 'a large triangular war banner flag waving on a pole'),
    'solo': ('slab', 'silver white', 'a single upright sword inside a ring'),
    'crowd': ('slab', 'orange', 'a big wildfire of three tall flame tongues side by side'),
    'dot': ('slab', 'bright crimson red', 'one large teardrop shaped blood drop filling the stone, bright red with a white shine, no flame'),
    'double': ('slab', 'electric yellow', 'a big thick zigzag lightning bolt from top to bottom'),
    'stack': ('slab', 'teal', 'three chevron arrows stacked pointing upward'),
    'vuln': ('slab', 'bright magenta pink', 'a big kite shield split in half by a jagged crack, bright white core lines, much brighter than the stone'),
    'refund': ('slab', 'sky blue', 'an hourglass with a curved return arrow'),
    'haste': ('slab', 'bright mint green', 'a fast arrow flying right with three thick speed lines behind it'),
    'chain': ('slab', 'pale gold', 'two big interlocked oval chain links diagonal'),
    'range': ('slab', 'bright cyan', 'a small square in the center with four bold arrows pointing AWAY from the center toward the four edges'),
    'overkill': ('slab', 'bright lavender', 'a single long thick arrow going diagonally from bottom left to top right, passing through a round target hole and coming out the other side'),
    # 모양 (결정)
    'twin': ('crystal', 'white', 'two crossed swords with clear hilts and crossguards'),
    'after': ('crystal', 'indigo blue', 'a ghostly afterimage silhouette of a slashing swordsman'),
    'burst': ('crystal', 'orange', 'a star-shaped explosion burst'),
    'more': ('crystal', 'icy pale blue', 'a whirling tornado of small blades'),
    # 전설 (금테 메달) — RUNE_LEG
    'L-blade': ('legend', 'silver white', 'an hourglass with a sword through it'),
    'L-frenzy': ('legend', 'fiery red', 'a burning clenched fist'),
    'L-endless': ('legend', 'golden yellow', 'an infinity symbol'),
    'L-echo': ('legend', 'dusky purple', 'two overlapping human silhouettes, one solid and one faded ghost copy behind it'),
    'L-myriad': ('legend', 'ice blue', 'a fan of many swords spread in a half circle'),
    'L-reach': ('legend', 'moonlight blue', 'a crescent moon with a long sword reach line'),
    'L-zen': ('legend', 'pearl white', 'a yin yang symbol'),
}
def prompt(rid):
    f, col, glyph = RUNES[rid]
    return FRAME[f].format(col=col, glyph=glyph)
