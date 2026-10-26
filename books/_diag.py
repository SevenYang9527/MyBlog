import pymupdf, os
from PIL import Image, ImageStat
from io import BytesIO
p = r"H:\技术文档\Introduction_to_the_Universal_Render_Pipeline_for_advanced_Unity_creators_2024.pdf"
d = pymupdf.open(p)
print("page size", d[0].rect)
seen=set(); stats={'total':0,'size':0,'aspect':0,'area':0,'std':0}
for pno in range(d.page_count):
    page=d[pno]; area=page.rect.width*page.rect.height
    for info in page.get_images(full=True):
        x=d.extract_image(info[0]); w,h=info[2],info[3]
        stats['total']+=1
        if w<180 or h<120: continue
        stats['size']+=1
        if w/h>4 or h/w>4: continue
        stats['aspect']+=1
        if w*h>0.55*area: continue
        stats['area']+=1
        try:
            img=Image.open(BytesIO(x["image"])).convert("L")
            if ImageStat.Stat(img).stddev[0]<20: continue
        except Exception: continue
        stats['std']+=1
print(stats)
