import os
import json
from PIL import Image, ImageDraw, ImageFont

# 確定產出的點陣資料夾存在
os.makedirs("assets/pixels", exist_ok=True)

def convert_image_to_json(image_path, output_name):
    """ 將一般圖片縮放並轉成 48x48 色碼陣列 """
    img = Image.open(image_path).convert("RGB")
    img = img.resize((48, 48), Image.Resampling.LANCZOS)
    
    pixel_array = []
    for y in range(48):
        row = []
        for x in range(48):
            r, g, b = img.getpixel((x, y))
            color_int = (r << 16) + (g << 8) + b
            row.append(color_int)
        pixel_array.append(row)
        
    out_path = f"assets/pixels/{output_name}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"type": "pixel", "content": pixel_array}, f)
    print(f"✓ 圖片已轉換: {out_path}")

def convert_text_to_json(text, output_name, font_path=None, font_size=12):
    """ 將中文或特殊符號繪製成 48x48 圖片後轉成色碼陣列 """
    # 建立 48x48 黑色底圖
    img = Image.new("RGB", (48, 48), color=(0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    font = None
    if font_path and os.path.exists(font_path):
        font = ImageFont.truetype(font_path, font_size)
    else:
        candidates = [
            # Windows
            "C:/Windows/Fonts/msjh.ttc",
            "C:/Windows/Fonts/msyh.ttc",
            "C:/Windows/Fonts/mingliu.ttc",
            # macOS
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/STHeiti Medium.ttc",
            # Linux
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        ]
        for path in candidates:
            if os.path.exists(path):
                font = ImageFont.truetype(path, font_size)
                break
    if font is None:
        print("⚠ 找不到中文字型，中文字可能無法正確顯示")
        font = ImageFont.load_default()
        
    # 計算文字位置讓它居中
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (48 - w) // 2
    y = (48 - h) // 2
    
    # 用綠色或白色畫出文字
    draw.text((x, y), text, fill=(0, 255, 0), font=font)
    
    # 轉成色碼陣列
    pixel_array = []
    for py in range(48):
        row = []
        for px in range(48):
            r, g, b = img.getpixel((px, py))
            color_int = (r << 16) + (g << 8) + b
            row.append(color_int)
        pixel_array.append(row)
        
    out_path = f"assets/pixels/{output_name}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"type": "pixel", "content": pixel_array}, f)
    print(f"✓ 文字點陣已產出: {out_path}")

def convert_gif_to_animation_json(gif_path, output_name, max_frames=8):
    """將 GIF 動圖轉成動畫 JSON（每幀 48x48 色碼陣列）"""
    gif = Image.open(gif_path)
    frames = []
    frame_count = 0

    try:
        while True:
            frame = gif.copy().convert("RGB")
            frame = frame.resize((48, 48), Image.Resampling.NEAREST)

            pixel_array = []
            for y in range(48):
                row = []
                for x in range(48):
                    r, g, b = frame.getpixel((x, y))
                    color_int = (r << 16) + (g << 8) + b
                    row.append(color_int)
                pixel_array.append(row)

            frames.append({"type": "pixel", "content": pixel_array})
            frame_count += 1
            if frame_count >= max_frames:
                break
            gif.seek(gif.tell() + 1)
    except EOFError:
        pass

    # 抓 GIF 原始幀間隔（毫秒），轉成秒，最小 1 秒
    duration_ms = gif.info.get("duration", 200)
    interval = max(1, round(duration_ms / 1000))

    out_path = f"assets/pixels/{output_name}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"type": "animation", "frames": frames, "interval": interval}, f)
    print(f"✓ GIF 動畫已轉換: {out_path} ({len(frames)} 幀, 間隔 {interval} 秒)")


# === 使用範例 ===
if __name__ == "__main__":
    # 1. 轉文字/中文/符號
    convert_text_to_json("問問", "text_wenwen", font_size=16)
    convert_text_to_json("離線", "text_offline", font_size=16)
    convert_text_to_json("(✿◡‿◡)", "text_flower_face", font_size=10)

    # 2. 轉一般圖片 (如果有放入圖片)
    if os.path.exists("input_assets/cat.png"):
        convert_image_to_json("input_assets/cat.png", "img_cat")

    # 3. 轉 GIF 動畫
    if os.path.exists("input_assets/clawd_walk.gif"):
        convert_gif_to_animation_json("input_assets/clawd_walk.gif", "anim_clawd_walk", max_frames=8)
