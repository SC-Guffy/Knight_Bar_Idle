import base64, http.server, sys, os, re, urllib.parse
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = re.sub(r'[^A-Za-z0-9_-]', '', (q.get('name') or ['shot'])[0]) or 'shot'
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n).decode('ascii')
        if ',' in body: body = body.split(',', 1)[1]
        path = os.path.join(OUT, name + '.png')
        with open(path, 'wb') as f: f.write(base64.b64decode(body))
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(path.encode('utf-8'))
        print('saved', path, flush=True)
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8798), H).serve_forever()
