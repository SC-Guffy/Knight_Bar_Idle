from PIL import Image
im=Image.open('src/sprites/squire.png').convert('RGBA');out=Image.new('RGBA',(9*64,64),'#303946');out.alpha_composite(im.crop((0,0,64,64)),(0,0))
for i in range(8):out.alpha_composite(im.crop((i*64,128,(i+1)*64,192)),((i+1)*64,0))
out.resize((1728,192),Image.Resampling.NEAREST).save('docs/motion-audit/generated/squire-cut-v9/size-check.png')
