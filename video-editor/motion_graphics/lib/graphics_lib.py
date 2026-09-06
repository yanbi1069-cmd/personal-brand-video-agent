# Thư viện primitives dùng chung để vẽ motion graphics bằng Pillow, học theo kỹ thuật
# (không sao chép nội dung) từ nhi-finance-editorial-training-pack: vẽ từng frame RGBA
# rồi pipe thẳng raw bytes vào ffmpeg qua stdin — cho phép animation chính xác theo frame,
# không cần render ảnh ra đĩa từng frame một.

import math
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_DIR = "C:/Windows/Fonts"
FONT_EXTRABOLD = f"{FONT_DIR}/Montserrat-ExtraBold.ttf"
FONT_BOLD = f"{FONT_DIR}/Montserrat-Bold.ttf"
FONT_SEMIBOLD = f"{FONT_DIR}/Montserrat-SemiBold.ttf"
FONT_MEDIUM = f"{FONT_DIR}/Montserrat-Medium.ttf"
FONT_REGULAR = f"{FONT_DIR}/Montserrat-Regular.ttf"

_font_cache = {}


def load_font(path, size):
    key = (path, size)
    f = _font_cache.get(key)
    if f is None:
        f = ImageFont.truetype(path, size)
        _font_cache[key] = f
    return f


def hex_to_rgb(hexstr):
    hexstr = hexstr.lstrip("#")
    return tuple(int(hexstr[i:i + 2], 16) for i in (0, 2, 4))


def clamp01(t):
    return max(0.0, min(1.0, t))


def lerp(a, b, t):
    return a + (b - a) * t


def ease_out(t):
    t = clamp01(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp01(t)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def beat_progress(t, start, dur):
    """Tiến độ 0..1 của 1 đoạn animation con bắt đầu tại `start`, kéo dài `dur` giây."""
    if dur <= 0:
        return 1.0
    return clamp01((t - start) / dur)


def fit_text(draw, text, font_path, max_width, start_size, min_size=28, step=2):
    """Tự giảm cỡ chữ tới khi vừa max_width — tránh tràn viền với câu dài/từ dài."""
    size = start_size
    while size > min_size:
        font = load_font(font_path, size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            return font
        size -= step
    return load_font(font_path, min_size)


def wrap_text_to_width(draw, text, font_path, size, max_width):
    """Bọc dòng theo pixel-width thật (khác với captions.js — ở đây đo bằng font thật)."""
    font = load_font(font_path, size)
    words = text.split()
    lines, line = [], ""
    for w in words:
        candidate = f"{line} {w}".strip()
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if line and (bbox[2] - bbox[0]) > max_width:
            lines.append(line)
            line = w
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines, font


def fit_text_block(draw, text, font_path, max_width, max_height, start_size, min_size=32, max_lines=6, step=2, line_gap=1.25):
    """Tự giảm cỡ chữ tới khi khối text (đã bọc dòng) vừa CẢ max_width lẫn max_height.
    Nếu chạm min_size mà vẫn không vừa, cắt bớt dòng cuối + thêm "…" — đảm bảo KHÔNG BAO
    GIỜ tràn khung hình dù nội dung câu dài bao nhiêu (khác lỗi ban đầu: chỉ fit theo bề
    ngang nên câu dài tự động tràn xuống dưới/đè lên phần tử khác)."""
    size = start_size
    while size > min_size:
        lines, font = wrap_text_to_width(draw, text, font_path, size, max_width)
        line_h = text_size(draw, "Ag", font)[1] * line_gap
        if len(lines) <= max_lines and line_h * len(lines) <= max_height:
            return lines, font, line_h
        size -= step

    font = load_font(font_path, min_size)
    lines, _ = wrap_text_to_width(draw, text, font_path, min_size, max_width)
    line_h = text_size(draw, "Ag", font)[1] * line_gap
    allowed_lines = max(1, min(len(lines), max_lines, int(max_height // line_h) or 1))
    if len(lines) > allowed_lines:
        lines = lines[:allowed_lines]
        last = lines[-1]
        while last and draw.textbbox((0, 0), last + "…", font=font)[2] > max_width:
            last = last[:-1].rstrip()
        lines[-1] = (last.rstrip() + "…") if last else "…"
    return lines, font, line_h


def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_centered_text(draw, text, font, cx, cy, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - w / 2 - bbox[0], cy - h / 2 - bbox[1]), text, font=font, fill=fill)


def draw_multiline_centered(draw, lines, font, cx, cy, fill, line_gap=1.25):
    sizes = [text_size(draw, ln, font) for ln in lines]
    line_h = max(h for _, h in sizes) * line_gap
    total_h = line_h * len(lines)
    y = cy - total_h / 2
    for ln, (w, h) in zip(lines, sizes):
        draw_centered_text(draw, ln, font, cx, y + line_h / 2, fill)
        y += line_h


def rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def glow_line(img, xy, color, glow_radius=18, width=6, glow_alpha=140):
    """Vẽ 1 đường có quầng sáng mờ phía sau + đường nét thật sắc phía trên — dùng cho
    gạch chân/motif xuyên suốt video (học kỹ thuật từ glow_line của reference pack)."""
    glow_color = (*color[:3], glow_alpha)
    glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow_layer)
    gdraw.line(xy, fill=glow_color, width=width)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(glow_radius))
    img.alpha_composite(glow_layer)
    draw = ImageDraw.Draw(img)
    draw.line(xy, fill=(*color[:3], 255), width=max(2, width // 2))


def glow_dot(img, center, radius, color, glow_radius=22, glow_alpha=160):
    cx, cy = center
    glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow_layer)
    gdraw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(*color[:3], glow_alpha))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(glow_radius))
    img.alpha_composite(glow_layer)
    draw = ImageDraw.Draw(img)
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(*color[:3], 255))


def base_frame(width, height, bg_top=(14, 16, 22), bg_bottom=(24, 27, 36), grid=True, grid_alpha=14):
    """Nền gradient dọc tối + lưới mờ nhẹ — motif nền dùng chung cho mọi scene, mọi ngành
    (chỉ khác nhau ở accent color của nội dung vẽ đè lên trên)."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    column = Image.new("RGBA", (1, height))
    for y in range(height):
        t = y / max(height - 1, 1)
        r = int(lerp(bg_top[0], bg_bottom[0], t))
        g = int(lerp(bg_top[1], bg_bottom[1], t))
        b = int(lerp(bg_top[2], bg_bottom[2], t))
        column.putpixel((0, y), (r, g, b, 255))
    img.alpha_composite(column.resize((width, height)))
    if grid:
        draw = ImageDraw.Draw(img)
        step = 64
        color = (255, 255, 255, grid_alpha)
        for x in range(0, width, step):
            draw.line([(x, 0), (x, height)], fill=color, width=1)
        for y in range(0, height, step):
            draw.line([(0, y), (width, y)], fill=color, width=1)
    return img


def pill_label(draw, text, cx, top_y, accent_rgb, font_path=FONT_SEMIBOLD, size=28, pad_x=28, pad_y=14):
    """Nhãn nhỏ dạng viên thuốc (kicker) — dùng để gắn nhãn ngành/loại nội dung phía trên headline."""
    font = load_font(font_path, size)
    w, h = text_size(draw, text.upper(), font)
    x0 = cx - w / 2 - pad_x
    x1 = cx + w / 2 + pad_x
    y0, y1 = top_y, top_y + h + pad_y * 2
    rounded_rect(draw, [x0, y0, x1, y1], radius=(y1 - y0) / 2, fill=(*accent_rgb, 235))
    draw_centered_text(draw, text.upper(), font, cx, (y0 + y1) / 2, fill=(10, 10, 12, 255))
    return y1


def render_frames_to_video(frame_fn, duration, fps, width, height, out_path, audio_path=None, ass_path=None):
    """Vẽ từng frame bằng frame_fn(t) -> PIL RGBA Image, pipe raw bytes vào ffmpeg.
    Nếu có ass_path, burn phụ đề luôn trong cùng 1 lượt encode (dùng đúng file .ass
    đã được video-generator dựng sẵn — không tính toán lại timing phụ đề ở đây)."""
    n_frames = max(1, int(round(duration * fps)))
    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{width}x{height}", "-r", str(fps),
        "-i", "-",
    ]
    if audio_path:
        cmd += ["-i", audio_path]

    vf_parts = ["format=yuv420p"]
    if ass_path:
        ass_filter_path = ass_path.replace("\\", "/").replace(":", "\\:")
        vf_parts.append(f"subtitles='{ass_filter_path}'")
    cmd += ["-vf", ",".join(vf_parts)]

    if audio_path:
        cmd += ["-c:a", "aac", "-shortest"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", out_path]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for i in range(n_frames):
            t = i / fps
            frame = frame_fn(t)
            if frame.mode != "RGBA":
                frame = frame.convert("RGBA")
            proc.stdin.write(frame.tobytes())
    finally:
        proc.stdin.close()
        ret = proc.wait()
    if ret != 0:
        raise RuntimeError(f"ffmpeg thoát với mã lỗi {ret}")
