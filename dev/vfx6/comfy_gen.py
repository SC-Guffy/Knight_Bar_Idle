# ComfyUI 시안 (무료): python dev/vfx6/comfy_gen.py <이름> <w> <h> <seeds 쉼표> "<프롬프트>"
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'comfy'))
from comfy import gen
name, w, h, seeds, prompt = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
out = os.path.join(os.path.dirname(__file__), 'comfy')
for s in seeds.split(','):
    ims, sec = gen('zimg', prompt, neg='text, watermark, outline, border, frame', seed=int(s), w=w, h=h)
    p = os.path.join(out, '%s-%s.png' % (name, s)); ims[0].save(p); print(p, round(sec, 1), 's')
