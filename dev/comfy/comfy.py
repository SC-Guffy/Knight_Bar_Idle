# ComfyUI 로컬 API 호출 (http://127.0.0.1:8188). 모델은 C:\AI\ComfyUI\models (저장소 밖).
# 사용: from comfy import gen; gen('sdxl', prompt, seed=1) -> PIL.Image 목록 (+ 걸린 초)
#  모델 'sdxl' = sd_xl_base_1.0 + pixel-art-xl LoRA, 'zimg' = Z-Image Turbo + 픽셀아트 LoRA
#  init=PIL.Image 를 주면 img2img (denoise < 1)
import io, json, time, uuid, urllib.request, urllib.parse
from PIL import Image

HOST = 'http://127.0.0.1:8188'


def _req(path, data=None, ctype='application/json'):
    r = urllib.request.Request(HOST + path, data=data, headers={'Content-Type': ctype} if data else {})
    with urllib.request.urlopen(r, timeout=600) as f:
        return f.read()


def upload(im, name):
    """PIL 이미지를 ComfyUI input 폴더로 올린다. 올린 이름을 돌려준다."""
    buf = io.BytesIO(); im.convert('RGB').save(buf, 'PNG')
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\n'
            f'Content-Type: image/png\r\n\r\n').encode() + buf.getvalue() + \
           f'\r\n--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{b}--\r\n'.encode()
    return json.loads(_req('/upload/image', body, f'multipart/form-data; boundary={b}'))['name']


def _graph(model, pos, neg, seed, w, h, steps, cfg, denoise, init_name, lora_w, batch):
    g = {}
    if model == 'sdxl':
        g['ck'] = {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': 'sd_xl_base_1.0.safetensors'}}
        g['vae'] = {'class_type': 'VAELoader', 'inputs': {'vae_name': 'sdxl_vae_fp16fix.safetensors'}}
        g['lo'] = {'class_type': 'LoraLoader', 'inputs': {'model': ['ck', 0], 'clip': ['ck', 1], 'lora_name': 'pixel-art-xl.safetensors',
                                                           'strength_model': lora_w, 'strength_clip': lora_w}}
        m, clip = ['lo', 0], ['lo', 1]
        empty = 'EmptyLatentImage'
        steps = steps or 25; cfg = cfg or 6.0; sampler, sched = 'dpmpp_2m', 'karras'
    else:
        g['un'] = {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_bf16.safetensors', 'weight_dtype': 'default'}}
        g['te'] = {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b_fp8_mixed.safetensors', 'type': 'lumina2', 'device': 'default'}}
        g['vae'] = {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}}
        g['lo'] = {'class_type': 'LoraLoader', 'inputs': {'model': ['un', 0], 'clip': ['te', 0], 'lora_name': 'pixel_art_style_z_image_turbo.safetensors',
                                                           'strength_model': lora_w, 'strength_clip': lora_w}}
        g['ms'] = {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['lo', 0], 'shift': 3.0}}
        m, clip = ['ms', 0], ['lo', 1]
        empty = 'EmptySD3LatentImage'
        steps = steps or 8; cfg = cfg or 1.0; sampler, sched = 'res_multistep', 'simple'
    g['p'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': clip, 'text': pos}}
    g['n'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': clip, 'text': neg}}
    if init_name:
        g['li'] = {'class_type': 'LoadImage', 'inputs': {'image': init_name}}
        g['enc'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['li', 0], 'vae': ['vae', 0]}}
        lat = ['enc', 0]
        if batch > 1:
            g['rb'] = {'class_type': 'RepeatLatentBatch', 'inputs': {'samples': lat, 'amount': batch}}
            lat = ['rb', 0]
    else:
        g['lat'] = {'class_type': empty, 'inputs': {'width': w, 'height': h, 'batch_size': batch}}
        lat = ['lat', 0]
    g['ks'] = {'class_type': 'KSampler', 'inputs': {'model': m, 'seed': seed, 'steps': steps, 'cfg': cfg, 'sampler_name': sampler,
                                                     'scheduler': sched, 'positive': ['p', 0], 'negative': ['n', 0],
                                                     'latent_image': lat, 'denoise': denoise}}
    g['dec'] = {'class_type': 'VAEDecode', 'inputs': {'samples': ['ks', 0], 'vae': ['vae', 0]}}
    g['out'] = {'class_type': 'SaveImage', 'inputs': {'images': ['dec', 0], 'filename_prefix': 'kb'}}
    return g


def gen(model, pos, neg='', seed=1, w=1024, h=1024, steps=None, cfg=None, denoise=1.0, init=None, lora_w=1.0, batch=1):
    """생성해서 (이미지 목록, 걸린 초) 를 돌려준다."""
    init_name = upload(init, f'init_{uuid.uuid4().hex[:8]}.png') if init is not None else None
    g = _graph(model, pos, neg, seed, w, h, steps, cfg, denoise, init_name, lora_w, batch)
    t0 = time.time()
    pid = json.loads(_req('/prompt', json.dumps({'prompt': g, 'client_id': 'kb'}).encode()))['prompt_id']
    while True:
        h_ = json.loads(_req('/history/' + pid))
        if pid in h_:
            st = h_[pid].get('status', {})
            if st.get('status_str') == 'error':
                raise RuntimeError(json.dumps(st.get('messages', []))[:2000])
            if st.get('completed'):
                break
        time.sleep(0.2)
    dt = time.time() - t0
    ims = []
    for img in h_[pid]['outputs']['out']['images']:
        q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
        ims.append(Image.open(io.BytesIO(_req('/view?' + q))).convert('RGB'))
    return ims, dt
