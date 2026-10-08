"""
產生 Clawd 走路動畫的 48x48 像素幀。
基於 Clawd 的 12x8 格子結構，6 幀循環。
色彩參考 crashchen/cc-gifs 的 Clawd 調色盤。
"""
import json

# Clawd 調色盤（參考 cc-gifs）
CORAL = (227, 126, 82)
HIGHLIGHT = (239, 149, 104)
SHADOW = (214, 112, 74)
EYE = (20, 65, 124)
FEET = (180, 100, 65)
BG = (0, 0, 0)

# 字元對應色
CHAR_COLORS = {
    '.': None,
    'B': CORAL,
    'H': HIGHLIGHT,
    'S': SHADOW,
    'E': EYE,
    'D': FEET,
    'e': SHADOW,      # 閉眼（眨眼用，用暗色代替眼睛）
}

# 6 幀走路循環，每幀 12x8
# 幀 0: 站立
# 幀 1: 重心左移，左腳抬
# 幀 2: 左腳踏出
# 幀 3: 站立（眨眼）
# 幀 4: 重心右移，右腳抬
# 幀 5: 右腳踏出
WALK_FRAMES = [
    # 幀 0: 站立
    [
        "..HBBBBBBB..",
        "..BEBBBBEB..",
        "SBBBBBBBBBBS",
        "SBBBBBBBBBBS",
        "..BBBBBBBB..",
        "..SSBBBBSS..",
        "..B.BB.BB.B.",
        "..D.DD.DD.D.",
    ],
    # 幀 1: 身體微左傾，左腳抬起
    [
        "..HBBBBBBB..",
        "..BEBBBBEB..",
        "SBBBBBBBBBBS",
        "SBBBBBBBBBBS",
        "..BBBBBBBB..",
        "..SSBBBBSS..",
        ".B..BB.BB.B.",
        ".D..DD.DD.D.",
    ],
    # 幀 2: 左腳踏出，微蹲
    [
        "..HBBBBBBB..",
        "..BEBBBBEB..",
        "SBBBBBBBBBBS",
        "SBBBBBBBBBBS",
        "..BBBBBBBB..",
        "..SSBBBBSS..",
        "B...BB.BB.B.",
        "D...DD.DD.D.",
    ],
    # 幀 3: 回中（眨眼）
    [
        "..HBBBBBBB..",
        "..BeBBBBeB..",
        "SBBBBBBBBBBS",
        "SBBBBBBBBBBS",
        "..BBBBBBBB..",
        "..SSBBBBSS..",
        "..B.BB.BB.B.",
        "..D.DD.DD.D.",
    ],
    # 幀 4: 身體微右傾，右腳抬起
    [
        "..HBBBBBBB..",
        "..BEBBBBEB..",
        "SBBBBBBBBBBS",
        "SBBBBBBBBBBS",
        "..BBBBBBBB..",
        "..SSBBBBSS..",
        "..B.BB.BB..B",
        "..D.DD.DD..D",
    ],
    # 幀 5: 右腳踏出
    [
        "..HBBBBBBB..",
        "..BEBBBBEB..",
        "SBBBBBBBBBBS",
        "SBBBBBBBBBBS",
        "..BBBBBBBB..",
        "..SSBBBBSS..",
        "..B.BB..BBB.",
        "..D.DD..DDD.",
    ],
]


def sprite_to_48x48(sprite_rows):
    """將 12~13 cols x 8 rows 的字元 sprite 轉成 48x48 像素陣列"""
    canvas = [[0] * 48 for _ in range(48)]

    block_w = 4   # 48 / 12
    block_h = 6   # 48 / 8

    for row_i, row_str in enumerate(sprite_rows):
        for col_i, ch in enumerate(row_str):
            color_tuple = CHAR_COLORS.get(ch)
            if color_tuple is None:
                continue

            r, g, b = color_tuple
            color = (r << 16) + (g << 8) + b

            for py in range(block_h):
                for px in range(block_w):
                    x = col_i * block_w + px
                    y = row_i * block_h + py
                    if 0 <= x < 48 and 0 <= y < 48:
                        canvas[y][x] = color

    return canvas


frames = []
for sprite in WALK_FRAMES:
    pixels = sprite_to_48x48(sprite)
    frames.append({"type": "pixel", "content": pixels})

animation = {
    "type": "animation",
    "frames": frames,
    "interval": 1
}

out_path = "assets/pixels/anim_clawd_walk.json"
with open(out_path, "w") as f:
    json.dump(animation, f)

print(f"Clawd 走路動畫已產出: {out_path} ({len(frames)} 幀)")
