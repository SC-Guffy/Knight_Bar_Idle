#!/bin/sh
# render.sh <step id> <recipe.json> <out prefix> [extra json args e.g. ,"zoom":4]
python - "$1" "$2" "$3" "$4" <<'PY'
import json, sys, subprocess
step, rf, out, extra = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
d = json.load(open(rf, encoding='utf-8'))
if extra: d.update(json.loads('{' + extra.lstrip(',') + '}'))
args = {'argv': [step, 'render', json.dumps(d)]}
subprocess.run(['python', '../../pixellab/mcpw.py', 'call', 'vfx_workbench', '-', out], input=json.dumps(args).encode())
PY
