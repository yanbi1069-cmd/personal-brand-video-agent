# video-generator

Dựng video từ kịch bản — giai đoạn 3 trong pipeline AI Personal Branding Video Agent (nối tiếp `content-scout` → `script-writer`). Có **2 nhánh độc lập**: có mặt (avatar) hoặc no-face.

## Dành cho ai
Người đã có kịch bản (từ `script-writer`), muốn ra video sẵn sàng đăng mà không cần tự quay.

## Nhánh A — Có mặt (HeyGen Avatar III)
- Lấy kịch bản mới nhất từ `../script-writer/output/` (hoặc chỉ định file cụ thể).
- Gọi HeyGen theo đường Avatar III (`POST /v2/video/generate`) với `avatar_id` + `voice_id` do bạn tự chọn (không mặc định).
- Theo dõi tiến trình render (`GET /v1/video_status.get`) tới khi xong, tự động tải video thật về `output/`.
- Mặc định chạy **chế độ test** (watermark, không tốn credit thật) — chỉ tốn credit khi thêm cờ `--real`.

### Setup
1. Copy `.env.example` thành `.env`, điền `HEYGEN_API_KEY` (Settings → API trong tài khoản HeyGen).
2. Lấy avatar/voice của bạn: `GET https://api.heygen.com/v2/avatars` và `GET https://api.heygen.com/v2/voices` (header `X-Api-Key`).

### Chạy
```
node scripts/generate_video.js <avatar_id> <voice_id>
node scripts/generate_video.js <avatar_id> <voice_id> --real
node scripts/generate_video.js <avatar_id> <voice_id> --real ../script-writer/output/script_xxx.json
```

## Nhánh B — No-face

Có **2 lựa chọn nguồn giọng đọc**, tuỳ bạn có muốn dùng đúng giọng của mình hay không:

### B1 — Giọng có sẵn (nhanh, không cần chuẩn bị gì)
Dùng thư viện giọng có sẵn của Kyma/ElevenLabs (`eleven-multilingual-v2`), dùng chung `KYMA_API_KEY` với `script-writer` — không cần setup thêm, nhưng **không phải giọng thật của bạn**.

```
node scripts/generate_video_noface.js
node scripts/generate_video_noface.js <voice_id>
node scripts/generate_video_noface.js <voice_id> ../script-writer/output/script_xxx.json
```
Lấy voice_id khác: `GET https://kymaapi.com/v1/audio/voices` (header `Authorization: Bearer $KYMA_API_KEY`).

### B2 — Giọng chính chủ (khuyến nghị cho agent xây thương hiệu cá nhân) ⭐

Vì đây là agent xây **thương hiệu cá nhân**, mỗi người dùng nên dùng **đúng giọng của chính mình**, không dùng chung giọng máy với người khác. Quy trình tự phục vụ, mỗi người tự làm 1 lần:

**Bước 1 — Chuẩn bị mẫu giọng của bạn**
- 1 file audio hoặc video có giọng nói rõ, ít tạp âm, dài khoảng **30 giây – 2 phút** (nói chuyện bình thường, không cần kịch bản đặc biệt).
- Có thể dùng file `.mp3/.wav/.m4a` hoặc trực tiếp 1 file video `.mp4` có tiếng nói của bạn — script tự tách audio nếu bạn đưa video vào.

**Bước 2 — Lấy HeyGen API key của chính bạn**
1. Đăng nhập [HeyGen](https://app.heygen.com/).
2. Vào Settings → API, tạo/copy API key.
3. Điền vào `.env` (copy từ `.env.example`): `HEYGEN_API_KEY=key_cua_ban`.

> **Lưu ý:** Clone voice có thể yêu cầu gói trả phí của HeyGen (lỗi `plan_upgrade_required` nếu gói free không hỗ trợ). Kiểm tra gói tài khoản trước nếu gặp lỗi này.

**Bước 3 — Clone giọng (chỉ cần làm 1 lần)**
```
node scripts/clone_voice.js "duong-dan-file-audio-hoac-video-cua-ban.mp4" "Tên giọng của tôi"
```
Script sẽ tự tách audio nếu bạn đưa file video, gửi lên HeyGen, đợi xử lý, rồi in ra `voice_id` — lưu lại (vd thêm `HEYGEN_VOICE_ID=...` vào `.env` để dùng lại về sau).

**Bước 4 — Dùng giọng đã clone để tạo video**
```
node scripts/generate_video_noface_heygen.js <voice_id_vua_clone>
node scripts/generate_video_noface_heygen.js <voice_id_vua_clone> ../script-writer/output/script_xxx.json
```

**Ưu điểm so với B1:** HeyGen trả kèm `word_timestamps` thật (thời điểm chính xác từng từ được nói) → phụ đề được căn **chính xác theo lời nói thật**, không phải ước lượng tuyến tính như cách B1 đang làm.

### Yêu cầu chung (cả B1 và B2)
- `ffmpeg`/`ffprobe` có trong PATH (kiểm tra bằng `ffmpeg -version`).

Chi tiết đầy đủ: xem [spec.md](./spec.md).
