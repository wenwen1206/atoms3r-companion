"""
產生 Clawd 走路動畫的 48x48 像素幀。
基於 Clawd 的 12x8 格子結構，4 幀循環。
"""
import json

CORAL = (227, 126, 82)
DARK = (180, 100, 65)
EYE = (20, 65, 124)
BG = (0, 0, 0)

# Clawd 基礎造型 (12 cols x 8 rows)
# . = 空, B = 身體, E = 眼睛, D = 暗色(腳底)
BASE_SPRITE = [
    "..BBBBBBBB..",  # R0 頭頂
    "..BEBBBBEB..",  # R1 眼睛
    "BBBBBBBBBBBB",  # R2 身體+手
    "BBBBBBBBBBBB",  # R3 身體+手
    "..BBBBBBBB..",  # R4 下半身
    "..BBBBBBBB..",  # R5 下半身
    "..B.BB.BB.B.",  # R6 腳       ← 本來是 B.B..B.B 但調整成更可愛的比例
    "..D.DD.DD.D.",  # R7 腳底
]

# 走路動畫：4 幀，主要改腳的位置
WALK_FRAMES = [
    # 幀 0: 站立
    [
        "..BBBBBBBB..",
        "..BEBBBBEB..",
        "BBBBBBBBBBBB",
        "BBBBBBBBBBBB",
        "..BBBBBBBB..",
        "..BBBBBBBB..",
        "..B.BB.BB.B.",
        "..D.DD.DD.D.",
    ],
    # 幀 1: 左腳前右腳後
    [
        "..BBBBBBBB..",
        "..BEBBBBEB..",
        "BBBBBBBBBBBB",
        "BBBBBBBBBBBB",
        "..BBBBBBBB..",
        "..BBBBBBBB..",
        ".B..BB.BB..B",
        ".D..DD.DD..D",
    ],
    # 幀 2: 站立（微蹲）
    [
        "..BBBBBBBB..",
        "..BEBBBBEB..",
        "BBBBBBBBBBBB",
        "BBBBBBBBBBBB",
        "..BBBBBBBB..",
        "..BBBBBBBB..",
        "..BBBB.BBBB.",
        "..DDDD.DDDD.",
    ],
    # 幀 3: 右腳前左腳後
    [
        "..BBBBBBBB..",
        "..BEBBBBEB..",
        "BBBBBBBBBBBB",
        "BBBBBBBBBBBB",
        "..BBBBBBBB..",
        "..BBBBBBBB..",
        "..B.BB.BB.B.",
        "..D.DD.DD.D.",
    ],
]

def sprite_to_48x48(sprite_rows):
    """將 12x8 的字元 sprite 轉成 48x48 像素陣列"""
    canvas = [[0] * 48 for _ in range(48)]

    block_w = 48 // 12  # 4px per block
    block_h = 48 // 8   # 6px per block

    for row_i, row_str in enumerate(sprite_rows):
        for col_i, ch in enumerate(row_str):
            if ch == '.':
                continue

            if ch == 'E':
                r, g, b = EYE
            elif ch == 'D':
                r, g, b = DARK
            else:
                r, g, b = CORAL

            color = (r << 16) + (g << 8) + b

            for py in range(block_h):
                for px in range(block_w):
                    x = col_i * block_w + px
                    y = row_i * block_h + py
                    if x < 48 and y < 48:
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
