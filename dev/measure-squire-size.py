from PIL import Image
im=Image.open('src/sprites/squire.png').convert('RGBA')
def face(c):
 ps={(x,y) for y in range(52) for x in range(64) if (lambda q:q[3]>128 and q[0]>175 and q[1]>100 and q[2]>60 and q[0]>q[1]*1.15 and q[2]<q[1]*.95)(c.getpixel((x,y)))}; comps=[]
 while ps:
  q=[ps.pop()]; component=[]
  while q:
   x,y=q.pop();component.append((x,y))
   for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if n in ps:ps.remove(n);q.append(n)
  comps.append(component)
 p=max(comps,key=len);return min(x for x,y in p),min(y for x,y in p),max(x for x,y in p)+1,max(y for x,y in p)+1
for row,n in [(0,1),(2,8)]:
 for f in range(n):print(row,f,face(im.crop((f*64,row*64,(f+1)*64,(row+1)*64))))

