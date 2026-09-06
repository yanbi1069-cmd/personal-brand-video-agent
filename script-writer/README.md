# script-writer

Sinh kịch bản video mới (nguyên bản) cho thương hiệu cá nhân, dựa trên 1 video đang viral tìm được từ `content-scout`. Đây là **giai đoạn 2** trong pipeline AI Personal Branding Video Agent (giai đoạn 1 là `content-scout`).

## Dành cho ai
Cá nhân/chủ doanh nghiệp đã chạy `content-scout` để research content viral theo ngách, giờ cần một bản nháp kịch bản để tự chỉnh sửa trước khi quay/tạo video — thay vì tự đọc transcript và tự viết tay.

## Làm gì
- Lấy file kết quả research mới nhất từ `../content-scout/output/` (hoặc chỉ định file cụ thể).
- Chọn video tham chiếu: ưu tiên video có transcript thật + lượt xem cao nhất.
- Gọi KYMA API để phân tích cấu trúc/hook của video tham chiếu, rồi viết một kịch bản **hoàn toàn mới, không sao chép nguyên văn**, theo đúng ngách chỉ định. Thử lần lượt 3 model theo thứ tự ưu tiên — `claude-haiku-4-5` → `gemini-2.5-flash` → `gpt-5.6-luna` — chỉ chuyển sang model kế tiếp khi model hiện tại báo tạm thời quá tải, không phải khi lỗi khác (sai key, hết credit...).
- Lưu kết quả JSON gồm: ngách, video tham chiếu, model dùng, kịch bản đầy đủ (`script`) và tách riêng từng phần `sections: {hook, noidung, cta}` — dùng cho các bước sau (vd. dựng đồ hoạ theo từng đoạn ở `video-editor`).
- In kịch bản ra màn hình để tự đọc/duyệt ngay.

Chi tiết đầy đủ: xem [spec.md](./spec.md).

## Setup
1. Copy `.env.example` thành `.env`.
2. Điền `KYMA_API_KEY` (lấy theo [hướng dẫn KYMA API](https://docs.kymaapi.com/introduction) — mỗi học viên Build to Own có $10 credit riêng).
3. Không commit file `.env` — đã bị chặn trong `.gitignore`.

## Chạy
Chạy `content-scout` trước để có dữ liệu research, sau đó:
```
node scripts/write_script.js "<ngách/ngành hàng>"
```
Ví dụ:
```
node scripts/write_script.js "spa thẩm mỹ chăm sóc da"
```
Muốn chỉ định file kết quả research cụ thể thay vì lấy file mới nhất:
```
node scripts/write_script.js "spa thẩm mỹ chăm sóc da" ../content-scout/output/youtube_1788626896805.json
```
