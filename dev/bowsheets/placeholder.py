# 코드 연결 시험용 임시 시트: 기준 그림(ref) 한 장으로 모든 줄을 채운다. 칸·발 기준점·SHEET_ON·cast 연결 확인용 — 커밋하지 않는다.
#   python -I dev/bowsheets/placeholder.py <cls,...> [out_dir]
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import HERE, write_sheet

ORDER = ['idle', 'guard', 'walk', 'atkA', 'atkB', 'cast', 'castUp', 'hurt', 'death', 'sit']
if __name__ == '__main__':
    out = sys.argv[2] if len(sys.argv) > 2 else None
    for cls in sys.argv[1].split(','):
        st = Image.open(os.path.join(HERE, 'ref', f'{cls}.png')).convert('RGBA')
        fi = Image.open(os.path.join(HERE, 'ref', f'{cls}-fight.png')).convert('RGBA')
        A = {
            'idle': dict(frames=[st], fps=6, loop=True), 'guard': dict(frames=[fi], fps=8, loop=True),
            'walk': dict(frames=[st], fps=10, loop=True), 'atkA': dict(frames=[fi, st], fps=14, loop=False, hit=1),
            'atkB': dict(frames=[fi, st], fps=14, loop=False, hit=1),
            'cast': dict(frames=[st, st, st, st], fps=10, loop=True, key='pull', val=[0, 4, 8, 12]),
            'castUp': dict(frames=[st.rotate(20, center=(42, 86)) if cls != 'siegeMaster' else st] * 2, fps=10, loop=True, key='pull', val=[0, 12]),
            'hurt': dict(frames=[st], fps=12, loop=False), 'death': dict(frames=[st], fps=8, loop=False), 'sit': dict(frames=[st], fps=2, loop=True),
        }
        write_sheet(cls, A, ORDER, out)
