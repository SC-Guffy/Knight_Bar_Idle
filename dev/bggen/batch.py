import sys, os
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import gen

ZONES = {
  'meadow':  'Green Meadow: rolling green hills, a few round trees, a tiny distant castle on a far hill',
  'grave':   'Haunted Graveyard: crooked tombstones, a ruined chapel with broken bell tower, dead leafless trees, iron fences, faint purple-gray mist, dim moody night palette',
  'swamp':   'Poison Fog Swamp: murky green bog, twisted mangrove trees with hanging moss, reeds, rotting wooden boardwalk, sickly green-yellow fog patches',
  'volcano': 'Volcanic Cave: jagged dark basalt rocks, distant erupting volcano, glowing orange lava cracks and lava falls, cave stalactite silhouettes, ember red-orange palette',
  'snow':    'Frozen Snowfield: snow-covered pine trees, icy blue mountains, frozen ice spikes, a small snowy wooden cabin, pale blue and white palette',
  'castle':  "Demon Lord's Castle: dark gothic spired castle with red glowing windows, spiked iron walls, purple-black rocks, red banners, ominous palette",
  'abyss':   'Abyssal Rift: floating cracked obsidian shards, glowing cyan void rifts in the ground, alien purple crystals, deep violet and cyan palette',
  'sky':     'Sky Islands: floating grassy islands with small waterfalls, fluffy white cloud banks, a small white temple with columns on an island, bright airy pastel palette',
  'desert':  'Sandstorm Desert: sand dunes, distant pyramids and a sandstone ruin, cacti, animal bones, dusty orange-tan palette',
  'deep':    'Deep Sea Temple: underwater sunken temple ruins with columns, coral reefs, swaying kelp, bubbles, teal and deep blue palette with pink corals',
  'fairy':   'Fairy Forest: giant glowing mushrooms, huge ancient trees, ferns, fireflies, soft magical glow, teal green with lavender and pink accents',
  'ruins':   'Ancient Machine Ruins: crumbling stone pillars fused with giant bronze gears and pipes, a broken colossal robot head, glowing cyan circuitry, brass and stone palette',
  'crystal': 'Crystal Cave: huge purple and pink crystal clusters, glowing gems in dark cave walls, stalagmites, deep indigo palette with bright crystal highlights',
  'storm':   'Storm Peaks: jagged gray mountain crags, lightning rods on cliffs, dark storm clouds hugging the peaks, a lightning bolt, slate gray palette with yellow highlights',
  'cosmos':  "Star's End: alien rocky planet surface, ringed planets and nebula silhouettes low on the horizon, floating star fragments, deep navy and violet palette with gold stars",
}

TPL = '''Hand-made 2D pixel art background strip for a retro side-scrolling idle game, zone "{z}". Side view, very wide panorama.
Style like a hand-pixeled 16-bit SNES/GBA game background drawn by a human pixel artist in Aseprite: SIMPLE, BOLD, READABLE shapes. Exactly three flat parallax layers:
- far layer: one flat silhouette band (a single color plus one highlight color), low contrast, slightly bluish
- middle layer: large simple shapes with 2-3 flat colors each
- near layer: a few big chunky shapes along the bottom, 3-4 colors
Big clean color clusters, clean 1-pixel outlines only where needed, flat cel shading with at most 2 shade steps, NO gradients, NO texture noise, NO tiny scattered details, NO speckles, NO painterly or airbrushed look, NO glow effects, NO photographic lighting. Leave calm empty space between landmarks. Total palette under 16 colors.
Everything sits on the BOTTOM edge of the image; the scenery occupies only the lower 50% of the image height.
The entire sky / upper area must be ONE flat solid pure magenta color (#FF00FF) so it can be keyed out as transparent; any fog or clouds that belong to the scene stay low inside the scenery band.
Left and right edges must match so the strip tiles seamlessly. No characters, no creatures, no text, no UI, no ground strip at the very bottom.'''

def job(k):
    out = f'raw_{k}.png'
    if os.path.exists(out): return
    gen('openai/gpt-5.4-image-2', TPL.format(z=ZONES[k]), out, '21:9')

if __name__ == '__main__':
    with ThreadPoolExecutor(5) as ex:
        list(ex.map(job, ZONES))
