import sys,json,base64,time,re,urllib.request,os
from mcp import post,session,CTX
sid=session()
def call(name,args):
    r,_=post({'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':name,'arguments':args}},sid)
    return r['result']['content']
src,action,out,n=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4])
b=base64.b64encode(open(src,'rb').read()).decode()
c=call('animate_image',{'first_frame_base64':b,'action':action,'frame_count':n})
t=c[0]['text'];print(t[:600])
jid=re.search(r'[0-9a-f]{8}-[0-9a-f-]{27}',t).group(0)
for i in range(60):
    time.sleep(10)
    c=call('get_image',{'job_id':jid})
    if not re.search(r'processing|pending|queued',c[0]['text'][:200],re.I): break
os.makedirs(out,exist_ok=True)
k=0
for x in c:
    if x['type']=='image':
        open(f'{out}/{k}.png','wb').write(base64.b64decode(x['data']));k+=1
print(c[0]['text'][:800]); print('images',k)
