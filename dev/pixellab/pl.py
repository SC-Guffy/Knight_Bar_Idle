# PixelLab v2 최소 클라이언트. 키는 Windows 사용자 환경변수에서 읽고 절대 출력하지 않는다.
import sys, json, os, urllib.request, winreg

def key():
    k = os.environ.get('PIXELLAB_API_KEY')
    if not k:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as h:
            k = winreg.QueryValueEx(h, 'PIXELLAB_API_KEY')[0]
    return k

BASE = 'https://api.pixellab.ai/v2'

def call(method, path, body=None, timeout=300):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + key(), 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:2000]

if __name__ == '__main__':
    m, p = sys.argv[1], sys.argv[2]
    body = json.loads(open(sys.argv[3], encoding='utf-8').read()) if len(sys.argv) > 3 else None
    st, res = call(m, p, body)
    out = json.dumps(res, ensure_ascii=False)
    print(st, out[:3000])
