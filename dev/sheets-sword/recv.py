# 브라우저 캔버스(dataURL)를 받아 저장: python -I recv.py <폴더> [포트=8891]
import sys, os, base64, http.server, urllib.parse
D = sys.argv[1]; P = int(sys.argv[2]) if len(sys.argv) > 2 else 8891
os.makedirs(D, exist_ok=True)
class H(http.server.BaseHTTPRequestHandler):
    def _c(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*')
    def do_OPTIONS(self):
        self.send_response(204); self._c(); self.end_headers()
    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = os.path.basename(q.get('name', ['shot'])[0])
        b = self.rfile.read(int(self.headers['Content-Length'])).decode()
        p = os.path.join(D, name + '.png'); open(p, 'wb').write(base64.b64decode(b.split(',', 1)[1]))
        self.send_response(200); self._c(); self.end_headers(); self.wfile.write(p.encode())
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', P), H).serve_forever()
