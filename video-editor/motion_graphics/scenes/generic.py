# Bộ scene "generic" — dùng chung cho cả 3 ngành (spa, bất động sản, coach). Mỗi ngành
# tự khác nhau qua accent_color_rgb + label + nội dung script thật (từ script-writer),
# KHÔNG hardcode nội dung/hình ảnh riêng cho 1 ngách cụ thể nào — vì kịch bản được sinh
# động mỗi lần chạy, scene phải render được với BẤT KỲ text nào trong ngành đó.
#
# Nguyên tắc học từ nhi-finance-editorial-training-pack (không sao chép nội dung):
# - Hook/CTA: full-screen, chữ lớn, animation vào rõ ràng.
# - Nội dung chính: mỗi luận điểm giữ đủ lâu (>=0.9s) để đọc được — hiện MỘT luận điểm
#   full-screen tại 1 thời điểm (không nhồi cả đoạn dài vào 1 danh sách — thử đầu tiên
#   làm vậy đã tràn khung hình vì noidung là văn nói liên tục, không phải bullet ngắn).
# - Mọi khối chữ đều dùng fit_text_block để CHẮC CHẮN vừa khung hình (tự giảm cỡ chữ +
#   cắt "…" nếu cần) — không bao giờ để chữ tràn ra ngoài hay đè lên phần tử khác.
# - Có motif xuyên suốt (thanh glow ngang, dot tiến trình) nối các scene lại thành 1 hệ
#   thống nhất quán.

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
from graphics_lib import (  # noqa: E402
    base_frame, fit_text_block, draw_multiline_centered,
    rounded_rect, glow_line, ease_out, ease_in_out, beat_progress,
    pill_label, FONT_EXTRABOLD, FONT_BOLD, FONT_SEMIBOLD,
)
from PIL import ImageDraw, Image

# Vùng an toàn: caption .ass burn ở sát đáy (MarginV=160 trên khung 720x1280) — mọi khối
# chữ lớn của motion graphics phải dừng lại phía TRÊN vùng này để không đè lên phụ đề.
CAPTION_SAFE_TOP_RATIO = 0.82
SIDE_MARGIN = 70


def _fade_scale_composite(img, draw_fn, width, height, in_p):
    """Vẽ nội dung lên 1 layer riêng rồi fade+scale-in layer đó — dùng cho hiệu ứng
    animation vào của cả 1 khối (thay vì chỉnh alpha từng nét vẽ)."""
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    draw_fn(ldraw)
    scale = 0.88 + 0.12 * in_p
    if scale != 1.0:
        new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
        layer = layer.resize(new_size).resize((width, height))
    if in_p < 1.0:
        alpha = layer.split()[3].point(lambda a: int(a * in_p))
        layer.putalpha(alpha)
    img.alpha_composite(layer)


def hook_scene(t, width, height, beat_t, beat_dur, accent_rgb, label, headline):
    img = base_frame(width, height)
    draw = ImageDraw.Draw(img)
    in_p = ease_out(beat_progress(t, 0, 0.45))

    cx = width / 2
    pill_bottom = height * 0.16
    if label:
        pill_bottom = pill_label(draw, label, cx, height * 0.10, accent_rgb) + 40

    zone_top = pill_bottom + 20
    zone_bottom = height * CAPTION_SAFE_TOP_RATIO
    zone_h = zone_bottom - zone_top
    max_w = width - SIDE_MARGIN * 2

    lines, font, line_h = fit_text_block(draw, headline, FONT_EXTRABOLD, max_w, zone_h, start_size=80, min_size=42, max_lines=6)
    cy = zone_top + zone_h / 2

    def draw_content(d):
        draw_multiline_centered(d, lines, font, cx, cy, (255, 255, 255, 255))

    _fade_scale_composite(img, draw_content, width, height, in_p)

    block_bottom = cy + (line_h * len(lines)) / 2
    line_p = ease_out(beat_progress(t, 0.25, 0.4))
    line_w = (width * 0.28) * line_p
    if line_w > 1:
        y = min(block_bottom + 36, zone_bottom - 10)
        glow_line(img, (cx - line_w / 2, y, cx + line_w / 2, y), accent_rgb, width=6)

    return img


def point_scene(t, width, height, beat_t, beat_dur, accent_rgb, label, index, total, headline):
    """1 luận điểm/câu trong phần nội dung chính — full-screen, hiện đúng lúc câu đó
    đang được đọc. Có dot tiến trình phía dưới để người xem biết đang ở đâu trong bài."""
    img = base_frame(width, height)
    draw = ImageDraw.Draw(img)
    in_p = ease_out(beat_progress(t, 0, 0.35))

    cx = width / 2
    tag = f"{label} · {index + 1:02d}/{total:02d}" if label else f"{index + 1:02d}/{total:02d}"
    pill_bottom = pill_label(draw, tag, cx, height * 0.10, accent_rgb) + 40

    dot_y = height * 0.76
    zone_top = pill_bottom + 20
    zone_bottom = dot_y - 60
    zone_h = zone_bottom - zone_top
    max_w = width - SIDE_MARGIN * 2

    lines, font, line_h = fit_text_block(draw, headline, FONT_BOLD, max_w, zone_h, start_size=64, min_size=36, max_lines=7)
    cy = zone_top + zone_h / 2

    def draw_content(d):
        draw_multiline_centered(d, lines, font, cx, cy, (255, 255, 255, 255))

    _fade_scale_composite(img, draw_content, width, height, in_p)

    if total > 1:
        gap = min(34, (width - 160) / max(total - 1, 1))
        total_w = gap * (total - 1)
        start_x = cx - total_w / 2
        for i in range(total):
            dx = start_x + i * gap
            r = 7 if i != index else 11
            color = (*accent_rgb, 255) if i <= index else (255, 255, 255, 70)
            draw.ellipse([dx - r, dot_y - r, dx + r, dot_y + r], fill=color)

    return img


def cta_scene(t, width, height, beat_t, beat_dur, accent_rgb, headline, subtext):
    img = base_frame(width, height)
    draw = ImageDraw.Draw(img)
    in_p = ease_out(beat_progress(t, 0, 0.4))
    cx = width / 2

    btn_w = min(width - 160, 620)
    btn_h = 118
    by = height * 0.60

    zone_top = height * 0.08
    zone_bottom = by - 40
    zone_h = zone_bottom - zone_top
    max_w = width - SIDE_MARGIN * 2

    lines, font, line_h = fit_text_block(draw, headline, FONT_EXTRABOLD, max_w, zone_h, start_size=70, min_size=38, max_lines=6)
    cy = zone_top + zone_h / 2

    def draw_content(d):
        draw_multiline_centered(d, lines, font, cx, cy, (255, 255, 255, 255))

    _fade_scale_composite(img, draw_content, width, height, in_p)

    pulse = 0.5 + 0.5 * ease_in_out((t % 1.2) / 1.2)
    glow_alpha = int(70 + 60 * pulse)
    box = [cx - btn_w / 2, by, cx + btn_w / 2, by + btn_h]
    rounded_rect(draw, box, radius=btn_h / 2, fill=(*accent_rgb, min(255, glow_alpha + 140)))
    sub_lines, sub_font, _ = fit_text_block(draw, subtext, FONT_SEMIBOLD, btn_w - 80, btn_h - 20, start_size=40, min_size=24, max_lines=2)
    draw_multiline_centered(draw, sub_lines, sub_font, cx, by + btn_h / 2, (12, 12, 14, 255))

    return img
