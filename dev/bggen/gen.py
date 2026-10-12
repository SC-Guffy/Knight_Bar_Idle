import os, sys, json, base64, urllib.request, winreg

def key():
    k = os.environ.get('OPENROUTER_API_KEY')
    if k: return k
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as h:
        return winreg.QueryValueEx(h, 'OPENROUTER_API_KEY')[0]

def gen(model, prompt, out, aspect='21:9', ref=None):
    content = [{'type': 'text', 'text': prompt}]
    if ref:
        b = base64.b64encode(open(ref, 'rb').read()).decode()
        content.append({'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,' + b}})
    body = {'model': model, 'modalities': ['image', 'text'],
            'messages': [{'role': 'user', 'content': content}],
            'image_config': {'aspect_ratio': aspect}}
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', json.dumps(body).encode(),
                                 {'Authorization': 'Bearer ' + key(), 'Content-Type': 'application/json'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read()[:600]); return
    msg = r['choices'][0]['message']
    imgs = msg.get('images') or []
    if not imgs:
        print('NO IMAGE', json.dumps(msg)[:500]); return
    url = imgs[0]['image_url']['url']
    open(out, 'wb').write(base64.b64decode(url.split(',', 1)[1]))
    print('saved', out, 'cost', r.get('usage', {}).get('cost'))

if __name__ == '__main__':
    model, out, aspect = sys.argv[1], sys.argv[2], sys.argv[3]
    prompt = open(sys.argv[4], encoding='utf-8').read()
    gen(model, prompt, out, aspect, sys.argv[5] if len(sys.argv) > 5 else None)
