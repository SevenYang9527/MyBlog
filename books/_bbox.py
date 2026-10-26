import pymupdf
p = r"H:\技术文档\Introduction_to_the_Universal_Render_Pipeline_for_advanced_Unity_creators_2024.pdf"
d = pymupdf.open(p)
for pno in [11,12,14]:
    page = d[pno]
    print("page", pno+1, "rect", page.rect)
    for info in page.get_images(full=True):
        b = page.get_image_bbox(info)
        print("   ", info[2], "x", info[3], "bbox", [round(v) for v in (b.x0,b.y0,b.x1,b.y1)], "w", round(b.width), "h", round(b.height))
