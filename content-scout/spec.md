# Spec: content-scout

## 1. Vấn đề
Người muốn xây kênh thương hiệu cá nhân để bán hàng thường không biết nên làm content gì. Họ mất nhiều thời gian lướt thủ công qua TikTok/Facebook/YouTube/Instagram để tìm content đang viral trong ngành của mình, và khi tìm được một video hay thì không có sẵn lời thoại/kịch bản để học cấu trúc — phải tự nghe lại và gõ tay.

## 2. Người dùng
Cá nhân mới bắt đầu xây kênh nội dung để bán hàng, chưa có kinh nghiệm quay dựng, thường ngại lên hình. Người dùng đầu tiên là chính tôi — dùng thử nghiệm trên ngách của mình trước khi mở rộng cho người khác.

## 3. Nói làm gì
- Nhận đầu vào: 1 từ khóa/ngách ngành + 1 nền tảng (TikTok / Facebook / YouTube / Instagram) + số lượng kết quả tối đa.
- Gọi Apify actor tương ứng với nền tảng đó để tìm các video/bài đăng đang có tương tác cao trong ngách được chọn.
- Trả về danh sách kết quả: tiêu đề/caption, link gốc, số liệu tương tác (views/likes/shares), ngày đăng, nền tảng.
- Nếu kết quả là video: cố gắng lấy transcript (lời thoại) của video đó — gọi Apify actor `inexhaustible_glass/youtube-transcript-extractor` theo lô cho toàn bộ URL tìm được; nếu video không có caption khả dụng thì giữ `transcript: null`. (Đã thử actor `obsequious_ontologist/youtube-transcript-extractor` trước đó nhưng bị YouTube chặn do dùng yt-dlp — đổi sang actor này vì hoạt động ổn định.)
- Lưu kết quả dưới dạng JSON có cấu trúc để dùng làm input cho bước viết kịch bản (bước sau, **không** nằm trong bài này).

## 4. KHÔNG làm gì
- KHÔNG viết kịch bản từ nội dung tìm được.
- KHÔNG tạo hoặc render video qua HeyGen.
- KHÔNG tự động đăng bài lên bất kỳ kênh nào.
- KHÔNG chỉnh sửa/edit video.
- KHÔNG tải xuống hoặc lưu trữ toàn bộ file video — chỉ lấy metadata + text transcript.
- KHÔNG thu thập thông tin cá nhân của người xem, người bình luận, hay chủ tài khoản ngoài dữ liệu công khai của bài đăng.

## 5. Dữ liệu
- **Input**: từ khóa/ngách (string), nền tảng (enum: tiktok/facebook/youtube/instagram), số lượng kết quả tối đa (int).
- **Output**: JSON gồm `{platform, url, caption, engagement: {views, likes, shares}, posted_date, transcript}`.
- Chỉ dùng dữ liệu công khai (public), không đăng nhập vào tài khoản cá nhân của ai.
- `APIFY_TOKEN` lưu trong 1Password (vault riêng cho dự án) + biến môi trường local, **không** commit vào repo.

## 6. Xong là gì
- Chạy được script với 1 từ khóa + 1 nền tảng thật, trả về **ít nhất 5 kết quả thật** kèm link và số liệu tương tác thực tế.
- Với ít nhất 1 kết quả là video, lấy được transcript thật — hoặc nếu actor không hỗ trợ, ghi rõ giới hạn đó trong output.
- Kết quả chạy thử được lưu lại làm bằng chứng (ảnh/API response) để nộp Phần F.
- **Deadline**: hoàn thành trước 20:00 Chủ nhật 30/08/2026.

## 7. Để ở đâu
- Code, script nằm trong repo GitHub Private `content-scout`.
- Spec này nằm tại `content-scout/spec.md`.
- Sơ đồ kiến trúc tại `content-scout/architecture.html`.
- Kết quả chạy thử nằm ở `content-scout/output/` (không commit dữ liệu thật nếu chứa link/thông tin nhạy cảm — chỉ commit bản mẫu đã che).
- Token/API key nằm trong 1Password vault riêng cho dự án — không nằm trong repo dưới mọi hình thức.
