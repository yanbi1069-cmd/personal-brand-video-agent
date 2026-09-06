# video-editor

Bước 4 — edit hậu kỳ: thay nền video no-face bằng **B-roll thật đa dạng theo ngành hàng** (Pexels + Pixabay, cả ảnh và video, miễn phí) + phối màu phụ đề theo ngành + nhạc nền cục bộ (tuỳ chọn), giữ nguyên giọng đọc gốc. Nối tiếp `content-scout` → `script-writer` → `video-generator`.

## Dành cho ai
Người đã có video gốc no-face (từ `video-generator`), muốn video được "tailor" theo đúng ngành hàng thay vì nền đơn sắc chung chung.

## Thiết kế đa ngành (data-driven)
Toàn bộ đặc trưng theo ngành nằm trong `industry-profiles.json` — thêm ngành mới chỉ cần thêm 1 entry, **không sửa code**:
```json
{
  "ten-nganh": {
    "label": "Tên hiển thị",
    "accent_color_rgb": "RRGGBB",
    "broll_keywords": ["từ khoá tìm B-roll 1", "từ khoá 2", "..."]
  }
}
```
Đã có sẵn 3 ngành theo ICP buổi 3: `spa`, `bat-dong-san`, `coach`.

## Làm gì
- Lấy metadata video no-face mới nhất từ `../video-generator/output/` (hoặc chỉ định file cụ thể).
- Tìm B-roll từ **4 nguồn**: Pexels video, Pexels ảnh, Pixabay video, Pixabay ảnh — theo `broll_keywords` của ngành, gộp thành 1 pool rồi chọn ngẫu nhiên tối đa 6 item (mỗi lần chạy ra bộ khác nhau).
- Video B-roll: chuẩn hoá 720×1280, cắt tối đa 6s/clip. Ảnh B-roll: hiệu ứng zoom Ken Burns ~5s/ảnh.
- Ghép nối + lặp/cắt cho khớp đúng thời lượng audio gốc.
- Nếu có file nhạc trong `assets/music/<ngành>/`, tự chọn ngẫu nhiên 1 bài, trộn nhỏ (12%) dưới giọng đọc.
- Burn phụ đề (màu theo `accent_color_rgb` của ngành) lên nền B-roll, mux với audio → `final_<ngành>_<timestamp>.mp4`.

## Phong cách 2 — Motion graphics tự vẽ (`motion_graphics/`)

Thay vì nền B-roll, tự vẽ đồ hoạ chuyển động bằng Python (Pillow) + ffmpeg: cảnh mở đầu (hook) full-screen, mỗi luận điểm trong nội dung hiện riêng từng cảnh kèm chấm tiến trình, cảnh CTA có nút kêu gọi hành động — tất cả tự co giãn cỡ chữ để không bao giờ tràn khung hình, màu sắc lấy theo `accent_color_rgb` của ngành trong `industry-profiles.json`. Không hardcode nội dung/hình ảnh riêng cho ngành nào — cùng 1 bộ code chạy được cho cả 3 ngành, chỉ đổi tham số.

### Yêu cầu riêng
- Python 3 + thư viện Pillow: `pip install Pillow`.
- Font Montserrat (các cân nặng ExtraBold/Bold/SemiBold) đã cài trong hệ thống — trên Windows thường có sẵn tại `C:\Windows\Fonts`; nếu chưa có, tải từ [Google Fonts](https://fonts.google.com/specimen/Montserrat).
- Cần đã chạy `video-generator` (nhánh no-face) để có audio + phụ đề `.ass` — motion graphics đọc lại đúng file phụ đề đó, không tự tính lại timing.

### Chạy
```
python motion_graphics/render.py spa
python motion_graphics/render.py bat-dong-san
python motion_graphics/render.py coach ../video-generator/output/noface_xxx.json
```
Output: `output/motion_<ngành>_<timestamp>.mp4` + metadata JSON mô tả từng "beat" (đoạn cảnh) và thời điểm bắt đầu/kết thúc.

## KHÔNG làm (ở bản này)
- Nhạc nền chỉ lấy từ file cục bộ — Pixabay không có API nhạc chính thức (đã test thật: gọi `/api/music/` trả về 404).
- Chưa áp dụng cho video nhánh avatar (HeyGen) — chỉ xử lý nhánh no-face.
- B-roll chọn theo từ khoá ngành chung + ngẫu nhiên, chưa đồng bộ theo timestamp từng câu thoại.

Chi tiết đầy đủ: xem [spec.md](./spec.md).

## Yêu cầu
- `ffmpeg`/`ffprobe` trong PATH.
- Đã chạy `video-generator` (nhánh no-face) trước để có video/audio/srt gốc.

## Setup
1. Copy `.env.example` thành `.env`, điền `PEXELS_API_KEY` (pexels.com/api) và `PIXABAY_API_KEY` (pixabay.com/api/docs) — cả hai đều miễn phí, đăng ký tức thì.
2. (Tuỳ chọn) Thêm nhạc nền: bỏ file `.mp3`/`.wav`/`.m4a` royalty-free vào `assets/music/<ngành>/` — xem [assets/music/README.md](./assets/music/README.md).
3. Không commit file `.env`.

## Chạy
```
node scripts/edit_video.js spa
node scripts/edit_video.js bat-dong-san
node scripts/edit_video.js coach ../video-generator/output/noface_xxx.json
```
