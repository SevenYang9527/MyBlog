"""从 5 本 PDF 里抽出真正的插图，转成 webp，按书/页码命名。

输出：
  books/img/<slug>/p012_1.webp ...
  books/img/<slug>/index.json   [{page, file, w, h}]

过滤规则（剔除装饰图，只留真正的插图）：
  - 宽 < 180 或 高 < 120：图标、装饰小图
  - 宽高比 > 4 或 < 0.25：横条 / 竖条
  - 在页面上的占位面积 > 页面面积 80%：整页背景
  - 灰度标准差 < 15：纯色或模糊渐变背景
按 xref 去重（同一张图在多页复用只留第一次出现）。
"""
import json
import os
from io import BytesIO

import pymupdf
from PIL import Image, ImageStat

PDF_DIR = r"H:\技术文档"
OUT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img")

BOOKS = [
    ("modular-so", "create-modular-game-architecture-in-unity-with-scriptableobjects.pdf"),
    ("urp", "Introduction_to_the_Universal_Render_Pipeline_for_advanced_Unity_creators_2024.pdf"),
    ("gpp", "Level_up_your_code_with_Game_Programming_Pattern.pdf"),
    ("profiling", "Ultimate_Guide_to_Profiling_Unity_Games.pdf"),
    ("mobile-perf", "Unity_OptimizeYourMobileGamePerformance_Final.pdf"),
]

MIN_W, MIN_H = 180, 120
MAX_W = 1200
MIN_STD = 15.0
MAX_PLACEMENT = 0.80


def normalise(raw: bytes) -> Image.Image:
    img = Image.open(BytesIO(raw))
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")
    return img


def placement_ratio(page, info):
    try:
        rect = page.get_image_bbox(info)
    except Exception:
        return 1.0
    page_area = page.rect.width * page.rect.height
    if rect.is_empty or page_area <= 0:
        return 1.0
    return (rect.width * rect.height) / page_area


def is_full_bleed(page, info):
    """整页出血的横幅/页头大图（宽度接近页宽）不算插图。"""
    try:
        rect = page.get_image_bbox(info)
    except Exception:
        return True
    if rect.is_empty:
        return True
    return rect.width > 0.85 * page.rect.width


def main():
    report = []
    for slug, fname in BOOKS:
        src = os.path.join(PDF_DIR, fname)
        out_dir = os.path.join(OUT_ROOT, slug)
        os.makedirs(out_dir, exist_ok=True)
        for f in os.listdir(out_dir):
            if f.endswith(".webp"):
                os.remove(os.path.join(out_dir, f))

        doc = pymupdf.open(src)
        seen = set()
        entries = []
        for page_no in range(doc.page_count):
            page = doc[page_no]
            seq = 0
            for info in page.get_images(full=True):
                xref, w, h = info[0], info[2], info[3]
                if xref in seen:
                    continue
                if w < MIN_W or h < MIN_H:
                    continue
                if w / h > 4 or h / w > 4:
                    continue
                if placement_ratio(page, info) > MAX_PLACEMENT:
                    continue
                if is_full_bleed(page, info):
                    continue
                try:
                    raw = doc.extract_image(xref)
                    img = normalise(raw["image"])
                except Exception:
                    continue
                if ImageStat.Stat(img.convert("L")).stddev[0] < MIN_STD:
                    continue
                if img.width > MAX_W:
                    img = img.resize((MAX_W, round(img.height * MAX_W / img.width)), Image.LANCZOS)
                seen.add(xref)
                seq += 1
                name = "p%03d_%d.webp" % (page_no + 1, seq)
                img.save(os.path.join(out_dir, name), "WEBP", quality=82, method=6)
                entries.append({"page": page_no + 1, "file": name, "w": img.width, "h": img.height})

        with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as fh:
            json.dump(entries, fh, ensure_ascii=False, indent=1)
        total = sum(os.path.getsize(os.path.join(out_dir, e["file"])) for e in entries)
        report.append("%s: %d 张，%.1f MB" % (slug, len(entries), total / 1048576))

    with open(os.path.join(OUT_ROOT, "report.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(report))


if __name__ == "__main__":
    main()
