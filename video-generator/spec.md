# Spec: video-generator

## 1. Vấn đề
Đã có kịch bản (từ `script-writer`) nhưng để có video thật, người dùng vẫn phải tự quay/tự dựng — đúng nỗi đau gốc: ngại lên hình hoặc không có thời gian quay dựng.

## 2. Người dùng
Cá nhân/chủ doanh nghiệp đã có kịch bản, muốn ra video sẵn sàng đăng mà không cần tự quay — có thể chọn video "có mặt" (avatar) hoặc "no-face" tuỳ nhu cầu.

## 3. Nói làm gì
Có **2 nhánh độc lập**, cùng nhận input là 1 file JSON kịch bản từ `script-writer` (mặc định lấy file mới nhất):

### Nhánh A — Có mặt (avatar), qua HeyGen
`scripts/generate_video.js <avatar_id> <voice_id> [--real] [file-script.json]`
- `avatar_id`/`voice_id` do người dùng tự truyền vào — không mặc định avatar/voice của ai khác.
- Gọi HeyGen API theo đường **Avatar III** (endpoint `POST /v2/video/generate`, `character.type: "avatar"`) — mặc định theo yêu cầu, không dùng Avatar IV trừ khi có chỉ định khác.
- Theo dõi tiến trình render bằng cách poll `GET /v1/video_status.get` cho tới khi `completed` hoặc `failed`.
- Tự động tải file video thật về máy, lưu cùng metadata.
- Mặc định chạy **chế độ test** (`test: true`, có watermark) để không tốn credit khi thử — chỉ chạy chế độ thật khi có cờ `--real`.

### Nhánh B — No-face (không cần avatar), 2 nguồn giọng
**B1 — `scripts/generate_video_noface.js [voice_id] [file-script.json]`** (giọng có sẵn, nhanh)
- Sinh giọng đọc từ kịch bản bằng Kyma TTS (`eleven-multilingual-v2`) — giọng thư viện có sẵn, không phải giọng thật của người dùng.
- Đo thời lượng audio thật, tự chia kịch bản thành các thẻ phụ đề theo ranh giới câu (không dính/không mồ côi/2 dòng cân bằng), phân bổ thời gian theo tỉ lệ số từ (ước lượng tuyến tính — chưa có timestamp thật).
- Ghép nền đơn sắc (720×1280) + phụ đề `.ass` (nền đen mờ, chữ trắng, sát đáy) + audio bằng ffmpeg thành 1 video gốc.
- Không cần `HEYGEN_API_KEY` — chỉ dùng `KYMA_API_KEY` đã có sẵn từ `script-writer`.

**B2 — `scripts/generate_video_noface_heygen.js <voice_id> [file-script.json]`** (giọng chính chủ, khuyến nghị) ⭐
- Vì đây là agent xây **thương hiệu cá nhân**, mỗi người dùng cần dùng đúng giọng của chính mình — không dùng chung 1 giọng máy cho mọi người.
- Yêu cầu chạy `scripts/clone_voice.js <file-audio-hoac-video> "<tên>"` trước đó **1 lần duy nhất** để có `voice_id` riêng (gọi HeyGen `POST /v3/voices/clone`, tự tách audio nếu input là video, poll `GET /v3/voices/{id}` tới khi `complete`).
- Sinh giọng đọc bằng HeyGen TTS-only (`POST /v3/voices/speech`) — **không render video avatar rồi che đi**, chỉ lấy đúng audio.
- HeyGen trả kèm `word_timestamps` THẬT theo từng từ → phụ đề được căn chính xác theo lời nói thật, không phải ước lượng như B1.
- Logic chia câu/bọc dòng dùng chung với B1 qua `scripts/lib/captions.js` (tách thành thư viện dùng chung, đã test hồi quy để đảm bảo không đổi hành vi B1).

## 4. KHÔNG làm gì
- KHÔNG tự chọn avatar/voice thay người dùng ở nhánh A — bắt buộc phải truyền `avatar_id`/`voice_id`.
- KHÔNG dùng Avatar IV (API riêng, khác endpoint) trừ khi được yêu cầu rõ ràng khác đi.
- KHÔNG edit hậu kỳ theo ngành (B-roll thật, nhạc nền, template riêng theo ngách) — đó là component "edit" riêng, chạy SAU bước này, nhận video gốc của cả 2 nhánh làm input.
- KHÔNG tự động đăng video lên bất kỳ kênh MXH nào.
- KHÔNG chạy chế độ thật của HeyGen (`--real`, tốn credit) nếu người dùng không chủ động bật cờ đó.
- Nhánh B1 KHÔNG căn phụ đề theo timestamp thật — chỉ ước lượng tuyến tính theo độ dài chữ (nhánh B2 đã có timestamp thật).
- `clone_voice.js` KHÔNG hardcode giọng của bất kỳ ai làm mặc định cho sản phẩm — mỗi người dùng agent này (kể cả khi share/thương mại hoá) tự clone giọng của chính họ, dùng `voice_id` riêng.

## 5. Dữ liệu
**Nhánh A** — Input: file JSON kịch bản (optional), `avatar_id` (bắt buộc), `voice_id` (bắt buộc), cờ `--real` (optional). Output: `.mp4` thật + JSON metadata `{avatar_id, voice_id, source_script_file, heygen_video_id, video_url, local_path, mode, generated_at}`. `HEYGEN_API_KEY` trong `.env` local.

**Nhánh B** — Input: file JSON kịch bản (optional), `voice_id` (optional, có default). Output: `.mp3` (giọng đọc), `.srt` (phụ đề), `.mp4` (video gốc ghép sẵn) + JSON metadata `{mode, voice_id, source_script_file, audio_path, srt_path, video_path, duration_seconds, generated_at}`. Dùng chung `KYMA_API_KEY` từ `.env` của `script-writer`.

## 6. Xong là gì
- **Nhánh A**: gọi được HeyGen thật, poll tới khi render xong, tải được file mp4 thật về máy — đã test ở chế độ test, sẵn sàng chạy `--real` khi có avatar_id/voice_id/API key thật.
- **Nhánh B**: đã chạy thành công thật (không giả lập) — sinh audio thật, ghép video thật, thời lượng phản ánh đúng độ dài kịch bản (đã phát hiện và sửa lỗi kịch bản lẫn lời phân tích của model, khiến audio dài gấp gần 3 lần bình thường).
- Có bằng chứng: file mp4/mp3/srt thật + metadata JSON làm minh chứng cho Bài tập 1 buổi 4.

## 7. Để ở đâu
- Code nằm trong thư mục/repo riêng `video-generator`, nối tiếp `script-writer` (đọc output của nó làm input).
- `HEYGEN_API_KEY` (nhánh A) nằm trong `.env` local của `video-generator`; `KYMA_API_KEY` (nhánh B) dùng chung với `.env` của `script-writer` — không nằm trong repo dưới mọi hình thức.
