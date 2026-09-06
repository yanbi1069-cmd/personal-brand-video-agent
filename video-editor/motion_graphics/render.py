# Orchestrator dựng video motion-graphics theo ngành — nhận video/audio + phụ đề ĐÃ CÓ
# từ video-generator (B1 hoặc B2, không quan trọng nguồn giọng), thay nền đơn sắc bằng
# đồ hoạ chuyển động theo ngành, rồi burn lại đúng file phụ đề .ass đã được kiểm chứng.
#
# Đây là 1 PHONG CÁCH DỰNG THAY THẾ (không thay thế edit_video.js dùng B-roll thật) —
# dùng khi muốn video "editorial" chuyên nghiệp hơn thay vì nền B-roll từ Pexels/Pixabay.
#
# Usage: python render.py <industry> [đường-dẫn-metadata-video-generator.json]
#   industry: spa | bat-dong-san | coach (khớp key trong industry-profiles.json)

import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scenes"))
from graphics_lib import render_frames_to_video, hex_to_rgb  # noqa: E402
import generic as scenes  # noqa: E402

WIDTH, HEIGHT, FPS = 720, 1280, 25
VIDEO_GENERATOR_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "video-generator", "output")
INDUSTRY_PROFILES_PATH = os.path.join(os.path.dirname(__file__), "..", "industry-profiles.json")
MIN_BEAT_SECONDS = 0.9  # mỗi luận điểm giữ tối thiểu ~1s để đọc kịp (nguyên tắc từ reference pack)


def find_latest_noface_metadata():
    candidates = [
        f for f in os.listdir(VIDEO_GENERATOR_OUTPUT_DIR)
        if re.match(r"^noface(_heygen)?_\d+\.json$", f)
    ]
    if not candidates:
        raise SystemExit(f"Không tìm thấy metadata no-face nào trong {VIDEO_GENERATOR_OUTPUT_DIR}. Hãy chạy video-generator trước.")
    candidates.sort(key=lambda f: os.path.getmtime(os.path.join(VIDEO_GENERATOR_OUTPUT_DIR, f)), reverse=True)
    return os.path.join(VIDEO_GENERATOR_OUTPUT_DIR, candidates[0])


def split_sentences(text):
    cleaned = re.sub(r"\s+", " ", text.replace("\r", "")).strip()
    if not cleaned:
        return []
    parts = re.findall(r"[^.!?…]+[.!?…]*", cleaned)
    return [p.strip() for p in parts if p.strip()]


TARGET_ITEM_CHARS = 90  # ~1 câu ngắn/1 mệnh đề — đủ để hiện full-screen mà không tràn khung
MAX_ITEM_CHARS = 150    # ngưỡng buộc ngắt sang luận điểm mới dù câu gốc chưa hết


def group_into_items(sentences):
    """Gom câu thành các luận điểm NGẮN (~1 câu/mệnh đề mỗi luận điểm), để mỗi luận điểm
    hiện FULL-SCREEN vừa khung hình (dùng fit_text_block phía scene để tự co chữ, nhưng
    vẫn cần đầu vào đủ ngắn — nhồi cả đoạn noidung dài vào 1 khối sẽ buộc chữ nhỏ tới mức
    không đọc được hoặc bị cắt quá nhiều). Số lượng luận điểm KHÔNG cố định — tỉ lệ theo
    độ dài kịch bản thật, để tổng quát hoá cho bất kỳ script nào (ngắn hay dài)."""
    items, current, current_len = [], [], 0
    for s in sentences:
        if current and current_len + len(s) > MAX_ITEM_CHARS:
            items.append(" ".join(current))
            current, current_len = [], 0
        current.append(s)
        current_len += len(s)
        if current_len >= TARGET_ITEM_CHARS:
            items.append(" ".join(current))
            current, current_len = [], 0
    if current:
        items.append(" ".join(current))
    return items


def allocate_durations(weights, total_duration):
    """Chia total_duration theo tỉ lệ độ dài ký tự (giống cách captions.js ước lượng thời
    lượng phụ đề) — đảm bảo mỗi phần tối thiểu MIN_BEAT_SECONDS."""
    n = len(weights)
    floor_total = MIN_BEAT_SECONDS * n
    if floor_total >= total_duration:
        return [total_duration / n] * n
    remaining = total_duration - floor_total
    total_w = sum(weights) or 1
    return [MIN_BEAT_SECONDS + (w / total_w) * remaining for w in weights]


def build_beat_plan(sections, total_duration):
    hook = sections.get("hook", "").strip()
    noidung = sections.get("noidung", "").strip()
    cta = sections.get("cta", "").strip()

    items = group_into_items(split_sentences(noidung)) if noidung else []
    if not items:
        items = [noidung] if noidung else []

    segments = []
    if hook:
        segments.append(("hook", hook, len(hook)))
    for it in items:
        segments.append(("item", it, len(it)))
    if cta:
        segments.append(("cta", cta, len(cta)))

    if not segments:
        segments = [("cta", "", 1)]

    durations = allocate_durations([w for _, _, w in segments], total_duration)

    beats = []
    t = 0.0
    for (kind, text, _), dur in zip(segments, durations):
        beats.append({"kind": kind, "text": text, "start": t, "end": t + dur})
        t += dur
    beats[-1]["end"] = total_duration  # tránh lệch làm tròn ở cuối

    total_items = sum(1 for b in beats if b["kind"] == "item")
    item_idx = 0
    for b in beats:
        if b["kind"] == "item":
            b["item_index"] = item_idx
            b["item_total"] = total_items
            item_idx += 1

    return beats


def make_frame_fn(beats, accent_rgb, label, niche_label):
    def frame_fn(t):
        beat = next((b for b in beats if b["start"] <= t < b["end"]), beats[-1])
        beat_t = t - beat["start"]
        beat_dur = beat["end"] - beat["start"]

        if beat["kind"] == "hook":
            return scenes.hook_scene(beat_t, WIDTH, HEIGHT, beat_t, beat_dur, accent_rgb, label, beat["text"])
        if beat["kind"] == "item":
            return scenes.point_scene(beat_t, WIDTH, HEIGHT, beat_t, beat_dur, accent_rgb, label, beat["item_index"], beat["item_total"], beat["text"])
        return scenes.cta_scene(beat_t, WIDTH, HEIGHT, beat_t, beat_dur, accent_rgb, beat["text"] or niche_label, "Xem thêm / Nhắn tin ngay")

    return frame_fn


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Cần truyền ngành. Ví dụ: python render.py spa\nNgành hợp lệ: xem industry-profiles.json')
    industry = sys.argv[1]
    metadata_path = sys.argv[2] if len(sys.argv) > 2 else find_latest_noface_metadata()

    with open(INDUSTRY_PROFILES_PATH, "r", encoding="utf-8") as f:
        profiles = json.load(f)
    if industry not in profiles:
        raise SystemExit(f'Ngành "{industry}" không có trong industry-profiles.json. Các ngành hợp lệ: {", ".join(profiles.keys())}')
    profile = profiles[industry]
    accent_rgb = hex_to_rgb(profile["accent_color_rgb"])

    with open(metadata_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    audio_path = meta["audio_path"]
    captions_path = meta["captions_path"]
    duration = float(meta["duration_seconds"])
    source_script_file = meta["source_script_file"]

    with open(source_script_file, "r", encoding="utf-8") as f:
        script_data = json.load(f)
    sections = script_data.get("sections") or {"hook": "", "noidung": script_data.get("script", ""), "cta": ""}
    niche = script_data.get("niche", profile.get("label", industry))

    print(f'Đang dựng beat plan cho ngành "{profile["label"]}" (thời lượng {duration:.1f}s)...')
    beats = build_beat_plan(sections, duration)
    for b in beats:
        print(f'  [{b["start"]:.1f}s - {b["end"]:.1f}s] {b["kind"]}: {b["text"][:50]}')

    frame_fn = make_frame_fn(beats, accent_rgb, profile["label"], niche)

    out_dir = os.path.join(os.path.dirname(__file__), "..", "output")
    os.makedirs(out_dir, exist_ok=True)
    timestamp = int(__import__("time").time() * 1000)
    out_path = os.path.join(out_dir, f"motion_{industry}_{timestamp}.mp4")

    print("Đang render frame-by-frame và pipe vào ffmpeg (có thể mất vài phút)...")
    render_frames_to_video(frame_fn, duration, FPS, WIDTH, HEIGHT, out_path, audio_path=audio_path, ass_path=captions_path)

    meta_out_path = os.path.join(out_dir, f"motion_{industry}_{timestamp}.json")
    with open(meta_out_path, "w", encoding="utf-8") as f:
        json.dump({
            "industry": industry,
            "style": "motion_graphics",
            "source_metadata": metadata_path,
            "source_script_file": source_script_file,
            "video_path": out_path,
            "duration_seconds": duration,
            "beats": beats,
        }, f, ensure_ascii=False, indent=2)

    print(f"\nĐã lưu video motion graphics tại: {out_path}")
    print(f"Metadata: {meta_out_path}")


if __name__ == "__main__":
    main()
