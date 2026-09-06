# personal-brand-video-agent

**AI Personal Branding Video Agent** (dự án khoá học "Build To Own") — pipeline đầy đủ 4 giai đoạn từ nghiên cứu đối thủ tới video hoàn chỉnh, đóng gói trong 1 repo duy nhất: clone về là chạy được đủ luồng, không cần thư mục/repo nào khác.

> Giai đoạn `content-scout` cũng tồn tại như 1 repo độc lập ([yanbi1069-cmd/content-scout](https://github.com/yanbi1069-cmd/content-scout)) — đó là bài nộp gốc của buổi 2. Bản trong repo này là bản sao đầy đủ chức năng, để repo hiện tại tự thân hoạt động được trọn vẹn.

## Pipeline

```
content-scout
      │  research video viral theo ngách + transcript thật
      ▼
script-writer
      │  viết kịch bản mới (HOOK / NỘI DUNG / CTA) từ video tham chiếu
      ▼
video-generator
      │  dựng video gốc: có mặt (HeyGen Avatar III) hoặc no-face (TTS + phụ đề)
      ▼
video-editor
      │  hậu kỳ theo ngành: B-roll (Pexels/Pixabay) HOẶC motion graphics tuỳ chỉnh
      ▼
   video final (.mp4), sẵn sàng đăng
```

## 4 thư mục con

- **[content-scout/](./content-scout)** — research video đang viral theo ngách trên YouTube (Apify), lấy transcript thật. [README](./content-scout/README.md) · [spec](./content-scout/spec.md).
- **[script-writer/](./script-writer)** — sinh kịch bản mới, nguyên bản, từ 1 video tham chiếu đang viral. [README](./script-writer/README.md) · [spec](./script-writer/spec.md).
- **[video-generator/](./video-generator)** — dựng video gốc, 2 nhánh: có mặt (avatar) hoặc no-face (2 nguồn giọng: thư viện có sẵn hoặc giọng chính chủ đã clone). [README](./video-generator/README.md) · [spec](./video-generator/spec.md).
- **[video-editor/](./video-editor)** — hậu kỳ theo ngành (`industry-profiles.json`: spa, bất động sản, coach), 2 phong cách dựng: B-roll thật từ Pexels/Pixabay, hoặc motion graphics tự vẽ bằng Pillow/ffmpeg (data-driven theo ngành, không hardcode nội dung). [README](./video-editor/README.md) · [spec](./video-editor/spec.md).

## Nguyên tắc thiết kế xuyên suốt

- **Đa người dùng (multi-tenant)**: avatar_id, voice_id, giọng clone đều là tham số bắt buộc — không hardcode danh tính của bất kỳ ai (kể cả người xây dựng khoá học) làm mặc định cho sản phẩm, vì đây là agent dùng để mỗi cá nhân/doanh nghiệp xây thương hiệu CỦA RIÊNG HỌ.
- **Data-driven theo ngành**: thêm ngành mới chỉ cần thêm 1 entry vào `industry-profiles.json`, không cần sửa code render.
- **An toàn API key**: mỗi thư mục con tự có `.env`/`.env.example` riêng, `.env` thật không bao giờ được commit (xem `.gitignore` từng thư mục).

## Setup nhanh

Mỗi thư mục con có `.env.example` riêng — copy thành `.env` và điền key thật (Apify, Kyma, HeyGen, Pexels, Pixabay tuỳ bước cần dùng, xem README từng thư mục để biết lấy ở đâu). Không cần `npm install` — chỉ dùng Node.js built-in, không có dependency ngoài.

**Yêu cầu hệ thống:**
- Node.js ≥ 18 (dùng `fetch` built-in).
- Python 3 + `pip install Pillow` (chỉ cần cho motion graphics).
- `ffmpeg`/`ffprobe` trong PATH.

```
node content-scout/scripts/search_youtube.js "<từ khoá ngách>"
node script-writer/scripts/write_script.js "<ngách>"
node video-generator/scripts/generate_video_noface.js
node video-editor/scripts/edit_video.js <industry>
# hoặc phong cách motion graphics:
python video-editor/motion_graphics/render.py <industry>
```
