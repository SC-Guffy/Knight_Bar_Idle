# 공용 dev/sheets-common/qa_char.py 를 부른다 (출력 기본값만 dev/sheets-sword/qa/<id>)
import os, sys, runpy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
from qa_char import run
if __name__ == '__main__':
    if '--out' not in sys.argv and '--id' in sys.argv: sys.argv += ['--out', os.path.join(HERE, 'qa', sys.argv[sys.argv.index('--id') + 1])]
    runpy.run_path(os.path.join(HERE, '..', 'sheets-common', 'qa_char.py'), run_name='__main__')
