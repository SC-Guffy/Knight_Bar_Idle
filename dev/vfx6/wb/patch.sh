#!/bin/sh
# patch.sh <step> <out> '<patch json list>' [extra]
python - "$1" "$2" "$3" "$4" <<'PY'
import json, sys, subprocess
step, out, patch, extra = sys.argv[1:5]
d = {'patch': json.loads(patch)}
if extra: d.update(json.loads('{' + extra + '}'))
subprocess.run(['python', '../../pixellab/mcpw.py', 'call', 'vfx_workbench', '-', out], input=json.dumps({'argv': [step, 'render', json.dumps(d)]}).encode())
PY
