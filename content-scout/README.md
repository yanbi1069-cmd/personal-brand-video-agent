# content-scout

Công cụ tìm content đang viral trên TikTok/Facebook/YouTube/Instagram theo một ngách/từ khóa, để làm nguyên liệu nghiên cứu trước khi viết kịch bản cho kênh cá nhân.

## Dành cho ai
Cá nhân mới bắt đầu xây kênh nội dung để bán hàng, chưa có kinh nghiệm quay dựng, cần tìm nhanh content đang hoạt động tốt trong ngách của mình thay vì lướt thủ công.

## Làm gì
- Nhận đầu vào: từ khóa/ngách + nền tảng + số lượng kết quả tối đa.
- Gọi Apify actor tương ứng để tìm video/bài đăng có tương tác cao trong ngách đó (`grow_media/youtube-search-api` cho YouTube).
- Với mỗi video tìm được, gọi tiếp actor `inexhaustible_glass/youtube-transcript-extractor` để lấy transcript thật (lời thoại) theo lô — nếu video không có caption/phụ đề khả dụng thì giữ `transcript: null` (giới hạn đã biết, không phải lỗi).
- Trả về danh sách: tiêu đề/caption, link gốc, engagement (views/likes/shares), ngày đăng, transcript.
- Lưu kết quả dưới dạng JSON làm input cho bước viết kịch bản (không nằm trong phạm vi dự án này).

Chi tiết đầy đủ: xem [spec.md](./spec.md).

## Setup
1. Copy `.env.example` thành `.env`.
2. Điền giá trị `APIFY_TOKEN` (lấy từ vault `content scout` trong 1Password).
3. Không commit file `.env` — đã bị chặn trong `.gitignore`.
