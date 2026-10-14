# ⑤-4 검사 계열 PixelLab 생성 도우미. 키는 dev/pixellab/pl.py 가 Windows 사용자 환경변수에서 읽는다 (출력·기록하지 않는다).
#  python -I pl4.py key <이름> [seed]        키 그림 (create-image-pixen, 1회) → raw/<이름>-s<seed>-0.png
#  python -I pl4.py anim <이름> <키 png> [seed] [frames]   애니메이션 (animate-with-text-v3, 1회) → raw/<이름>-anim-<n>.png
#  호출마다 usage.txt 에 한 줄 (호출 수 = PixelLab 사용 횟수)
import sys, os, json, base64, time, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw'); REQ = os.path.join(HERE, 'req')
os.makedirs(RAW, exist_ok=True); os.makedirs(REQ, exist_ok=True)
GEN = os.path.join(HERE, '..', 'pixellab', 'gen.py')

PRE = 'isolated pixel art VFX sprite on empty transparent background: '
NO = ', nothing else, no character, no background shape'
# 이름: (가로, 세로, 설명, 애니 동작)
T = {
  # W 평타 궤적 (키 그림 한 장 + 코드 재생)
  'w1a': (32, 32, PRE + 'sword swing smear trail, a wide curved crescent arc sweeping from top to bottom on the right side like a quarter moon, thin bright white leading edge, pale blue body, several tiny four-pointed stars and single dots sprinkled along and behind the arc like a constellation trail' + NO + ', no sword', None),
  'w3': (32, 32, PRE + 'twin blade slash trail, two thin parallel curved slash arcs very close together sweeping from top to bottom on the right side, sharp needle thin pointed tips, bright white edges with red glow' + NO + ', no sword', None),
  'w3a': (32, 32, PRE + 'moonlight slash trail, two thin hairline crescent arcs nested one inside the other sweeping on the right side, empty transparent gap between them, sharp pointed tips, bright white edge with soft pink glow, three tiny cherry blossom petals trailing behind' + NO + ', no sword, no filled moon', None),
  'w4': (48, 32, PRE + 'abstract motion blur swoosh, one very thick curved crescent band of wind and speed lines like a quarter moon on the right side, bright white outer rim, pale grey body fading and breaking into chunky fragments at the tail end' + NO + ', no sword, no blade, no metal object, no hilt', None),
  'w4a': (48, 32, PRE + 'giant blade swing smear trail, one very thick wide band arc curving downward on the right side, its outer edge broken into glowing cracked fiery fissures, small embers flying off, dark core with bright orange and white rim' + NO + ', no sword', None),
  # H 평타 명중 (직업마다)
  'h06': (32, 32, PRE + 'small holy hit mark, a compact golden plus shaped cross brand glowing with a bright white center and four short rays, two tiny sparkles' + NO + ', no circle, no star', 'holy hit: the golden cross flashes brighter and slightly bigger, the rays extend, then the cross fades into tiny rising sparkles and disappears completely'),
  'h07': (32, 32, PRE + 'twin blade hit mark, two thin crossing slash cuts forming a sharp X, bright white cores with red glow, three tiny red droplets' + NO + ', no circle, no star', 'twin slash hit: the two crossing cuts flash bright and lengthen, the red droplets spray outward, then the X thins and fades out completely'),
  'h08': (32, 32, PRE + 'heavy blunt hit impact, a wide flat horizontal shockwave burst squashed sideways like a flattened oval of force, three small chunky metal shards flying, white core and grey steel' + NO + ', no circle, no star', 'heavy impact: the flat shockwave expands sideways wider, the metal shards fly out and tumble, then everything fades away completely'),
  'h18': (32, 32, PRE + 'star knight hit mark, one bold four pointed star with long sharp rays and a bright white center, pale blue glow, around it five tiny stars connected to it by thin dotted lines like a constellation diagram' + NO + ', no circle', 'star hit: the star cross flashes bigger, the constellation dots light up one by one along the lines, then everything twinkles and fades away completely'),
  'h19': (32, 32, PRE + 'moon blade hit mark, two strongly curved thin crescent moon arcs facing each other like a pair of parentheses overlapping at their tips, no straight lines, white with pink glow, four small cherry blossom petals scattered around' + NO + ', no circle, no star, no X', 'moon slash hit: the two crescents flash and slide apart, the petals scatter and spin outward, then everything fades away completely'),
  'h20': (32, 32, PRE + 'greatsword hit impact, a heavy vertical cleave mark splitting into jagged burning cracks spreading outward, bright orange and white hot core, small embers' + NO + ', no circle, no star', 'cleave impact: the burning cracks spread wider and glow, embers burst upward, then the cracks dim and fade away completely'),
  # 심판의 일격
  'e05': (32, 64, 'pixel art game sprite on empty transparent background: a holy longsword pointing straight down, perfectly vertical, golden crossguard and golden hilt at the top, long bright white blade with glowing pale gold edge, sharp tip at the bottom, nothing else, no character, no background', None),
  'e06': (64, 64, 'pixel art game sprite on empty transparent background: a giant archangel knight made entirely of golden light, side view facing right, armored body, two huge feathered wings spread wide behind, both hands holding a long sword raised high above the head, a halo ring above the head, glowing, nothing else, no background', 'the archangel swings the sword down in a heavy powerful chop toward the right, wings sweep forward, the sword ends pointing forward and down'),
  'k05': (32, 48, PRE + 'holy judgment impact on the ground: a bright golden cross brand mark on the floor at the bottom, a short narrow vertical beam of light landing on it from above, small sparks' + NO, 'holy impact: the light beam slams down and flashes, the cross brand glows brighter and spreads, sparks burst outward, then the beam fades and the cross dims away completely'),
  'e44': (32, 64, PRE + 'a wide straight vertical beam of holy light filling most of the image width, coming down from the very top edge to the ground at the bottom edge, blinding white center stripe, golden edges made of thin vertical rays, small sparkles at the base' + NO + ', no orb, no ball, no lamp', 'holy light pillar: flares brighter and wider, sparkles rise up, then the column thins out and fades away completely'),
  # 성역
  'e07': (64, 32, PRE + 'a flat holy sigil drawn on the ground seen from a low side angle, a wide very flat thin ellipse ring with a cross and small rune marks inside, golden glow' + NO + ', no pillars', None),
  'e07b': (64, 32, PRE + 'a fence of thin vertical pillars of holy light standing in a wide flat ellipse on the ground seen from a low side angle, about eight slim glowing posts of light of equal height, golden' + NO + ', no dome, no building', 'the light pillars shimmer and pulse softly in a seamless loop, flickering light travels up each pillar'),
  'e08': (64, 64, 'pixel art game sprite on empty transparent background: a glowing golden cathedral made of light, front view, three pointed spires with the tallest in the middle, a round rose window and an arched door, translucent holy light, nothing else, no character, no background', None),
  'k06': (32, 32, PRE + 'golden holy shockwave bouncing off an invisible wall, a curved vertical arc of light rippling outward with small sparkles' + NO + ', no circle', 'holy ripple: the arc of light pulses outward and bends, sparkles bounce away, then it fades away completely'),
  # 질풍난무
  'e09': (64, 32, PRE + 'one long thin perfectly horizontal straight red slash line frozen in mid air going from the left edge to the right edge, sharp tapered pointed ends, white hot core, small hairline cracks along it' + NO, 'the frozen slash line cracks along its length and shatters into many small red shards that fly apart and fade away'),
  'k07': (32, 32, PRE + 'fierce X slash hit effect only: two long crossing sharp red slash cuts with white hot cores forming a big X, a second fainter thinner red X slightly offset behind it like an echo, a few small red droplets' + NO + ', no creature, no face, no eyes, no horns, no body, no circle', 'X slash hit: the cuts flash and stretch, the echo X follows a moment later, droplets spray out, then everything fades away completely'),
  # 일섬
  'e10': (48, 48, 'pixel art game sprite on empty transparent background: a huge blood red full moon, perfectly round, dark red craters, pale bright red rim light on one side, nothing else, no background, no clouds', None),
  'e11': (64, 32, PRE + 'a long perfectly horizontal razor thin slash of light going from the left edge to the right edge, thickest in the middle and tapering to needle points at both ends, white core with red glow, a few tiny speed sparks' + NO + ', no sword, no hilt, no crossguard', 'razor slash: the line flashes bright white, then thins into a hairline and fades away from both ends'),
  'k08': (64, 32, PRE + 'horizontal splitting cut hit: a thin horizontal gap opening wider in the middle with red light leaking out, small red droplets flying up and down' + NO, 'splitting cut: the gap opens wider and glows, droplets spray, then the gap closes and fades away completely'),
  # 대검 횡참
  'e12': (48, 32, PRE + 'one heavy crescent shaped slash wave flying to the right, very thick, bright orange and white hot leading edge on the right, dark red tail, flat and wide' + NO, 'the slash wave surges forward to the right, stretches thinner, then breaks into embers and fades away'),
  'e13': (32, 80, 'pixel art game sprite on empty transparent background: a giant heavy greatsword pointing straight down, perfectly vertical, very wide thick steel blade with a dark center groove, big crossguard and long hilt at the top, nothing else, no character, no background', None),
  'k09': (48, 32, PRE + 'heavy horizontal cleave impact, a wide flat sideways slash shock burst, steel shards and orange sparks flying' + NO + ', no circle', 'cleave impact: the flat shock bursts wider sideways, shards fly out, then it fades away completely'),
  # 돌진 격돌
  'e14': (64, 32, PRE + 'a deep gouge furrow plowed into the ground, side view, a long low trench with dirt clods and small rocks heaped up and kicked up along its edges, brown earth' + NO, 'dirt clods and rocks burst up out of the trench and fall back down, dust settles'),
  'k10': (32, 32, PRE + 'abstract impact effect only: a cone shaped burst of force widening toward the right like a megaphone shape, bright white core at the narrow left point, orange shock rim, brown dust puffs and small dirt chunks flying right' + NO + ', no person, no human, no body, no fist, no circle', 'tackle impact: the cone shockwave blasts outward to the right, dirt chunks fly, then dust fades away completely'),
  # 성좌 강림
  'f01': (240, 100, 'pixel art game background: night sky, deep navy blue getting lighter toward the bottom, many tiny twinkling stars, a faint milky way band diagonally, no ground, no moon, no characters, no text', None),
  'f02': (64, 64, PRE + 'a constellation shaped like a knight holding a sword raised high, made of bright white stars connected by thin glowing lines, pale blue' + NO, 'the constellation stars twinkle and the lines glow brighter, the sword arm of the constellation swings down'),
  'f03': (64, 100, PRE + 'a wide vertical pillar of genesis light pouring down from the top to the ground, blinding white core, pale blue edges, radiant thin rays and sparkles' + NO, 'the pillar of light flares wider and brighter with pulsing rays, then narrows and fades into sparkles'),
  'f02s': (16, 16, PRE + 'one tiny four pointed twinkling star, long thin vertical and horizontal rays, bright white center, pale blue tips' + NO + ', no circle', 'the star twinkles in a seamless loop: rays shrink, then flash longer and brighter, then shrink back'),
  'k29': (64, 64, PRE + 'star explosion: a big bright four pointed star burst in the center with a ring of smaller stars scattering outward, pale blue and white' + NO + ', no circle', 'star explosion: the big star flashes and expands, small stars scatter outward in a ring, then everything twinkles out completely'),
  # 천검
  'f04': (64, 32, PRE + 'a long perfectly horizontal razor thin slash of light going from the left edge to the right edge, thickest in the middle and tapering to needle points at both ends, white core with pink glow, three small cherry blossom petals floating near it' + NO + ', no sword, no hilt, no crossguard', 'the slash line flashes, splits open into two thin lines and releases the petals that drift away, then fades'),
  'k30': (64, 64, PRE + 'a burst of dozens of thin straight pink slash lines radiating from the center in all directions like a starburst, white cores, a few cherry blossom petals' + NO + ', no circle', 'the slash lines shoot outward and flash, petals scatter, then the lines break apart and fade away completely'),
  # 파천참
  'f05': (240, 100, 'pixel art game background: blood red burning sky, dark smoky clouds drifting in layers, small glowing embers floating, darker at the top, no ground, no characters, no text', None),
  'f06': (32, 96, 'pixel art game sprite on empty transparent background: a giant dark greatsword pointing straight down, perfectly vertical, black blade with a thin glowing orange red edge line, heavy crossguard and hilt at the top, nothing else, no character, no background', None),
  'f07': (32, 100, PRE + 'a narrow vertical crack of blinding white light splitting the world from top to bottom, glowing orange edges, small sparks' + NO, 'the vertical crack of light opens wider and blazes, sparks fly, then it narrows and closes into a thin line'),
  'k31': (32, 100, PRE + 'a tall narrow vertical tear of glowing orange light splitting the air from the top edge down to the ground, jagged bright white core, flames and rock debris bursting outward at the bottom' + NO + ', no sword, no blade, no hilt, no weapon', 'the vertical slash flashes, flames and debris burst at the bottom, then everything fades away completely'),
  'f22': (64, 32, PRE + 'side view of flat ground cut by one perfectly straight horizontal glowing orange slit running from the left edge to the right edge at the bottom of the image, a row of small evenly spaced fire flames licking up from the slit' + NO + ', no log, no wood, no sword, no smoke cloud', 'the flames along the cut flicker and lick upward in a seamless loop'),
}


def run(args, kind, name, extra):
    # 429 (동시 작업 한도 — 다른 세션과 공유) 이면 기다렸다 다시. 성공한 호출만 usage.txt 에 적는다
    for i in range(80):
        r = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')
        out = (r.stdout or '') + (r.stderr or '')
        if 'HTTP 429' in out: time.sleep(12); continue
        print(name, out.strip()[-300:], flush=True)
        if r.returncode == 0 and 'saved' in out: log(kind, name, extra)
        return
    print(name, 'GAVE UP (429)', flush=True)


def log(kind, name, extra=''):
    with open(os.path.join(HERE, 'usage.txt'), 'a', encoding='utf-8') as f:
        f.write(f'{time.strftime("%H:%M:%S")} {kind} {name} {extra}\n')


def key(name, seed=7):
    w, h, desc, _ = T[name]
    body = {'image_size': {'width': w, 'height': h}, 'outline': 'selective outline', 'detail': 'medium detail', 'view': 'side',
            'no_background': True, 'background_removal_task': 'remove_complex_background', 'description': desc, 'seed': seed}
    if w >= 200: body.pop('no_background'); body.pop('background_removal_task')     # 배경은 바탕을 지우지 않는다
    rq = os.path.join(REQ, f'{name}-s{seed}-key.json'); json.dump(body, open(rq, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    run([sys.executable, '-I', GEN, '/create-image-pixen', rq, os.path.join(RAW, f'{name}-s{seed}')], 'key', name, f'seed {seed}')


def anim(name, png, seed=9, frames=4):
    act = T[name][3]
    b64 = base64.b64encode(open(png, 'rb').read()).decode()
    body = {'first_frame': {'type': 'base64', 'base64': b64}, 'action': act, 'frame_count': frames, 'seed': seed, 'no_background': True}
    rq = os.path.join(REQ, f'{name}-anim.json'); json.dump(body, open(rq, 'w', encoding='utf-8'))
    run([sys.executable, '-I', GEN, '/animate-with-text-v3', rq, os.path.join(RAW, f'{name}-anim')], 'anim', name, f'seed {seed} from {os.path.basename(png)}')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'key':
        for n in sys.argv[2].split(','): key(n, int(sys.argv[3]) if len(sys.argv) > 3 else 7)
    elif cmd == 'anim':
        anim(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 9, int(sys.argv[5]) if len(sys.argv) > 5 else 4)
