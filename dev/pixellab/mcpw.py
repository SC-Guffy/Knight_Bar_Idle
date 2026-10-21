# PixelLab MCP 최소 클라이언트. 키는 환경변수 PIXELLAB_API_KEY (Windows 사용자 환경변수) 또는 맥에선 Claude Code 의 MCP 설정
# (~/.claude.json 의 pixellab 서버 Authorization 헤더)에서 읽고 절대 출력하지 않는다.
# 쓰기: python mcpw.py list                      — 도구 목록
#       python mcpw.py call <도구> <args.json|->  — 도구 호출 (args 는 JSON 파일, '-' 면 stdin)
import sys, json, os, ssl, urllib.request, urllib.error
_CTX = ssl.create_default_context()
if not _CTX.get_ca_certs() and os.path.exists('/etc/ssl/cert.pem'):   # python.org 맥 파이썬은 인증서 묶음이 비어 있다
    _CTX = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
try:
    import winreg
except ImportError:
    winreg = None

URL = 'https://api.pixellab.ai/mcp'

def key():
    k = os.environ.get('PIXELLAB_API_KEY')
    if not k and winreg:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as h:
            k = winreg.QueryValueEx(h, 'PIXELLAB_API_KEY')[0]
    if not k:
        try:
            d = json.load(open(os.path.expanduser('~/.claude.json'), encoding='utf-8'))
            srv = [d.get('mcpServers', {})] + [p.get('mcpServers', {}) for p in d.get('projects', {}).values()]
            k = next(s['pixellab']['headers']['Authorization'].split(' ', 1)[-1] for s in srv if 'pixellab' in s)
        except (OSError, ValueError, KeyError, StopIteration):
            k = None
    return k

_sid = None

def rpc(method, params=None, notify=False, timeout=600):
    global _sid
    body = {'jsonrpc': '2.0', 'method': method}
    if params is not None:
        body['params'] = params
    if not notify:
        body['id'] = 1
    h = {'Authorization': 'Bearer ' + key(), 'Content-Type': 'application/json',
         'Accept': 'application/json, text/event-stream'}
    if _sid:
        h['Mcp-Session-Id'] = _sid
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers=h, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
            _sid = r.headers.get('Mcp-Session-Id') or _sid
            raw = r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return {'error': {'code': e.code, 'message': e.read().decode('utf-8', 'replace')[:2000]}}
    if notify or not raw.strip():
        return None
    if raw.lstrip().startswith('{'):
        return json.loads(raw)
    last = None  # SSE: 마지막 data 줄의 JSON
    for line in raw.splitlines():
        if line.startswith('data:'):
            try:
                last = json.loads(line[5:].strip())
            except ValueError:
                pass
    return last

def init():
    r = rpc('initialize', {'protocolVersion': '2025-03-26', 'capabilities': {},
                           'clientInfo': {'name': 'knightbar-mcpw', 'version': '1'}})
    rpc('notifications/initialized', notify=True)
    return r

def show(r, prefix=None):
    """글은 출력하고, 이미지 결과는 <prefix>-<n>.png 로 저장한다."""
    import base64
    if not r or 'result' not in r:
        print(json.dumps(r, ensure_ascii=False)[:4000])
        return
    n = 0
    for c in r['result'].get('content', []):
        if c.get('type') == 'text':
            print(c['text'])
        elif c.get('type') == 'image':
            n += 1
            ext = (c.get('mimeType') or 'image/png').split('/')[-1]
            p = '%s-%d.%s' % (prefix or 'mcp-out', n, ext)
            os.makedirs(os.path.dirname(p) or '.', exist_ok=True)
            open(p, 'wb').write(base64.b64decode(c['data']))
            print('[image saved]', p)
        else:
            print(json.dumps(c, ensure_ascii=False)[:2000])
    if r['result'].get('isError'):
        print('[isError]')

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    init()
    if sys.argv[1] == 'list':
        r = rpc('tools/list')
        for t in (r.get('result') or {}).get('tools', []):
            print('-', t['name'], ':', (t.get('description') or '').split('\n')[0][:160])
        if 'error' in r:
            print(r['error'])
    elif sys.argv[1] == 'schema':
        r = rpc('tools/list')
        for t in (r.get('result') or {}).get('tools', []):
            if t['name'] == sys.argv[2]:
                print(t.get('description'))
                print(json.dumps(t.get('inputSchema'), ensure_ascii=False, indent=1))
    elif sys.argv[1] == 'call':
        src = sys.argv[3]
        args = json.loads(sys.stdin.read() if src == '-' else open(src, encoding='utf-8').read())
        r = rpc('tools/call', {'name': sys.argv[2], 'arguments': args})
        show(r, sys.argv[4] if len(sys.argv) > 4 else None)
    elif sys.argv[1] == 'wb':
        # wb <out 접두어> <argv...> — vfx_workbench 바로 호출. JSON 인자는 그대로 문자열로 넘긴다.
        r = rpc('tools/call', {'name': 'vfx_workbench', 'arguments': {'argv': sys.argv[3:]}})
        show(r, sys.argv[2])
