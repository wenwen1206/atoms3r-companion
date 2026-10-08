"""
產生 CJK 點陣字型資料供 CF Workers 使用。
用 PIL + 文泉驛字型把每個常用中文字渲染成 16x16 bitmap，
輸出成 ES module (font_cjk.js)。
"""
import json
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
FONT_SIZE = 14
OUTPUT_PATH = "font_cjk.js"

# 最常用的中文字 + 標點 + 注音符號（約 800 字，覆蓋日常 95%+）
COMMON_CHARS = (
    # 高頻字
    "的一是不了人我在有他這中大來上個國到說們為子和你地出會也時要就可以對生能而"
    "那得於著下自之年過發後作裡用道行所然家種事成方多經麼去法學如都同現當沒動面"
    "起看定天分還進好小部其些主樣理心她本前開但因只從想實日軍者意無力它與長把機"
    "十民第公此已工使情明性知全三又關點正業外將兩高間由問很最重並物手應表回什最"
    "美起見像把比世真合次又真你起反進口比那期氣感裝先吧式球變才老向道邊根打被已"
    # 情緒/日常用語
    "嗎呢啊吧哦喔欸嘻哈嘿唉呀噢嗯啦囉耶哇喂咦嘛呵哼唷"
    "愛恨怕累餓渴困難開心快樂幸福傷悲哭笑怒驚嚇煩憂鬱寂寞孤獨溫暖冷熱痛苦甜"
    "想念記忘夢醒睡吃喝玩走跑飛坐站躺趴滾跳抱握牽摸拍撲搖推拉扯丟撿拿放送接"
    # 稱呼
    "膽海豚問媽爸哥姐弟妹寶貝朋友老師同學先生小姐太太爺奶叔嬸"
    # 時間/數字
    "今明昨天日月年早午晚夜分秒鐘點半零二四五六七八九十百千萬億"
    # 動物/自然
    "貓狗兔鳥魚蝶花草樹星雲雨雪風山水河海石火土光影色彩虹"
    # 食物
    "飯麵茶酒湯菜肉蛋奶糖鹽油醬餅乾果汁咖啡牛豬雞魚蝦蟹豆腐米粉麻辣燙烤炸煮蒸"
    # 身體
    "頭臉眼耳鼻嘴唇齒舌頸肩臂手指甲背胸肚腰腿腳趾皮骨血肉心肝肺胃腸腦"
    # 居家/物品
    "家門窗桌椅床燈書筆紙包袋衣褲鞋襪帽巾被枕碗盤杯刀叉勺筷瓶罐箱盒鍵鎖鏡屏"
    # 科技
    "電腦網路手機程式碼資料庫伺服器螢幕按鈕連線訊息通知更新版本功檔案"
    # 形容詞
    "好壞大中新舊長短粗細深淺高低胖瘦美醜亮暗響靜遠近快慢強弱軟硬乾濕"
    "清楚模糊簡單複雜容易困厲害特別普通正常奇怪有趣無聊認真隨便"
    # 常見詞組用字
    "謝謝對起抱歉沒關係不客氣請問什麼為怎樣多少哪裡誰何時候"
    "因為所以但雖然如果就算即使只要除非不管無論是否已經正還將剛才終於突居總算"
    # 語氣助詞/常見網路用語
    "超很太好棒讚酷帥潮萌暈崩裂炸翻傻呆蠢笨威猛狂瘋癲狠兇狼狽慘扯誇張離譜絕"
)

# 去重
chars = list(dict.fromkeys(COMMON_CHARS))
print(f"準備渲染 {len(chars)} 個字元")

font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
font_data = {}

for ch in chars:
    img = Image.new("1", (16, 16), 0)
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), ch, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (16 - w) // 2 - bbox[0]
    y = (16 - h) // 2 - bbox[1]
    draw.text((x, y), ch, fill=1, font=font)

    rows = []
    for row_y in range(16):
        val = 0
        for col_x in range(16):
            if img.getpixel((col_x, row_y)):
                val |= 1 << (15 - col_x)
        rows.append(val)

    hex_str = "".join(f"{r:04x}" for r in rows)
    font_data[ch] = hex_str

# 輸出成 ES module
lines = ["// Auto-generated CJK bitmap font data (16x16 per glyph)", "export default {"]
for ch, hex_str in font_data.items():
    lines.append(f'  "{ch}":"{hex_str}",')
lines.append("};")

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"已產出 {OUTPUT_PATH}，共 {len(font_data)} 個字元")
