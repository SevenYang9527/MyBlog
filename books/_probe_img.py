import fitz, glob, os, collections
pdfs = glob.glob(r"H:\技术文档\*.pdf")
out = []
for p in pdfs:
    d = fitz.open(p)
    n_img = 0
    pages_with = 0
    sizes = collections.Counter()
    for page in d:
        imgs = page.get_images(full=True)
        if imgs: pages_with += 1
        n_img += len(imgs)
        for info in imgs:
            try:
                pix = fitz.Pixmap(d, info[0])
                sizes[(pix.width, pix.height)] += 1
            except Exception:
                pass
    out.append(f"{os.path.basename(p)}: pages={d.page_count} pages_with_img={pages_with} images={n_img}")
    out.append("   常见尺寸: " + ", ".join(f"{w}x{h}x{c}" for (w, h), c in sizes.most_common(5)))
open("books/_probe_img.txt", "w", encoding="utf-8").write("\n".join(out))
print("ok")

