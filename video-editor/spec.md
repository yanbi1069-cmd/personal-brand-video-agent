# Spec: video-editor

## 1. Vấn đề
Video gốc từ `video-generator` (avatar hoặc no-face) mới chỉ chạy được, chưa "ra tấm ra món" — nền đơn sắc, phụ đề trắng đơn điệu, không gắn với đặc thù ngành hàng nào. Đây chính là khoảng trống lớn nhất được xác định ở Bài 1 Market Research buổi 3: hầu hết đối thủ dừng ở caption tự động hoặc cắt clip, chưa ai polish video theo đúng ngành hàng.

## 2. Người dùng
Người đã có video gốc (từ `video-generator`), muốn video được "tailor" theo đúng ngành hàng của mình (spa, bất động sản, coach...) mà không cần tự dựng bằng tay.

## 3. Nói làm gì
- Nhận đầu vào: metadata video no-face từ `video-generator` (mặc định lấy file mới nhất) + tên ngành (key trong `industry-profiles.json`).
- Tra cứu **industry profile** (file `industry-profiles.json`, dạng data-driven — thêm ngành mới chỉ cần thêm 1 entry, không sửa code): mỗi profile gồm `label`, `accent_color_rgb` (màu chủ đạo cho phụ đề), `broll_keywords` (từ khoá tìm B-roll theo ngành).
- Tìm B-roll từ **4 nguồn** theo từ khoá ngành: Pexels video, Pexels ảnh, Pixabay video, Pixabay ảnh — gộp thành 1 pool, xáo ngẫu nhiên rồi chọn tối đa 6 item (video + ảnh trộn lẫn) mỗi lần chạy để tăng đa dạng.
- Clip video B-roll: chuẩn hoá về 720×1280, cắt tối đa 6s/clip. Ảnh B-roll: áp hiệu ứng zoom nhẹ (Ken Burns, ~5s/ảnh) để không bị cảm giác slideshow đứng hình.
- Ghép nối toàn bộ clip đã chuẩn hoá, lặp/cắt cho khớp đúng thời lượng audio gốc.
- **Nhạc nền cục bộ** (tuỳ chọn): nếu thư mục `assets/music/<ngành>/` có file `.mp3/.wav/.m4a`, tự chọn ngẫu nhiên 1 bài, trộn nhỏ (12% âm lượng) dưới giọng đọc gốc. Nếu thư mục trống, dùng audio gốc, không lỗi.
- Áp phụ đề màu theo `accent_color_rgb` của ngành lên nền B-roll, ghép với audio (đã trộn nhạc hoặc gốc) thành `final_<ngành>_<timestamp>.mp4`.

## 4. KHÔNG làm gì
- KHÔNG tự động tải nhạc nền qua API — Pixabay không có API nhạc chính thức (đã kiểm tra thực tế: gọi thử `/api/music/` trả về 404). Nhạc nền chỉ lấy từ file cục bộ do người dùng tự chuẩn bị.
- KHÔNG áp dụng B-roll thay nền cho video nhánh avatar (HeyGen) ở bản này — nền video avatar không phải phông xanh, thay nền không đơn giản; bản này tập trung cho nhánh no-face trước.
- KHÔNG tự động chọn ngành thay người dùng — phải truyền rõ tên ngành.
- KHÔNG tự động đăng bài lên MXH.
- KHÔNG cam kết B-roll khớp 100% ngữ cảnh từng câu thoại — B-roll chọn theo từ khoá ngành chung + ngẫu nhiên, chưa đồng bộ theo timestamp từng ý (như `heygen-secondbrain-module` đã làm) — để dành cho phiên bản sau nếu cần.

## 5. Dữ liệu
- **Input**: metadata JSON từ `video-generator` (mặc định file mới nhất), tên ngành (string, khớp key trong `industry-profiles.json`).
- **Output**: `final_<ngành>_<timestamp>.mp4`, kèm metadata `{industry, broll_sources (kèm nguồn + loại mỗi item), music_used, source_noface_meta, generated_at}`.
- `PEXELS_API_KEY` và `PIXABAY_API_KEY` lưu trong `.env` local, không commit vào repo — dùng chung key đã có ở các project video khác của người dùng (cả hai đều miễn phí, không giới hạn chi phí).
- Nhạc nền: file cục bộ trong `assets/music/<ngành>/`, không qua API.

## 6. Xong là gì
- Chạy được thật với 1 video no-face thật đã có (ngách spa) + ngành "spa" → ra được `final.mp4` có B-roll thật đa dạng (ảnh + video, nhiều nguồn), phụ đề màu theo ngành, audio giữ nguyên hoặc đã trộn nhạc.
- Đổi sang ngành khác (`bat-dong-san`, `coach`) chỉ cần đổi tham số, không sửa code — chứng minh được tính "đa ngành" của thiết kế.
- Chạy lại nhiều lần cho cùng 1 ngành ra bộ B-roll khác nhau mỗi lần (do chọn ngẫu nhiên từ pool lớn) — tránh cảm giác lặp lại giữa các video.

## 7. Để ở đâu
- Code nằm trong thư mục/repo riêng `video-editor`, nhận input từ `video-generator`.
- `PEXELS_API_KEY`, `PIXABAY_API_KEY` nằm trong `.env` local, không nằm trong repo dưới mọi hình thức.
- File nhạc nền nằm trong `assets/music/<ngành>/` (được `.gitkeep` giữ cấu trúc thư mục, file nhạc thật do người dùng tự thêm).
