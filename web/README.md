# web — bản demo production (Buổi 5)

Web app Next.js cho phần **viết kịch bản** của pipeline — bản duy nhất trong repo chạy được trên Vercel (dựng video thật cần ffmpeg/Pillow, không chạy được trên serverless nên vẫn ở dạng CLI trong `../script-writer`, `../video-generator`, `../video-editor`).

## Vấn đề
Bài tập buổi 5 yêu cầu một sản phẩm chạy thật trên production, có link truy cập được — không chỉ chạy script trên máy cá nhân.

## Người dùng
Bất kỳ ai muốn thử nhanh AI viết kịch bản video theo ngành, không cần cài đặt gì, không cần biết dòng lệnh.

## Cách hoạt động
- Người dùng nhập ngành/ngách (hoặc chọn 1 trong các gợi ý có sẵn) → bấm "Sinh kịch bản".
- Server (Next.js API route, chạy trên Vercel) gọi Kyma API bằng đúng logic đã dùng ở `script-writer` (xem `lib/kyma.js`) — `KYMA_API_KEY` chỉ tồn tại trong biến môi trường phía server, không bao giờ gửi xuống trình duyệt.
- Với ngách "spa thẩm mỹ chăm sóc da" đã có sẵn 1 video tham chiếu THẬT (lấy từ content-scout) bundle trong `lib/reference-videos.js` — các ngách khác vẫn sinh được kịch bản nhưng không có video tham chiếu cụ thể.
- Kết quả (Hook / Nội dung / CTA) hiển thị trực tiếp trên trang, không cần tải file.

## Không làm
- Không chạy content-scout (Apify) trực tiếp từ web — tránh chi phí Apify không kiểm soát mỗi lượt khách ghé trang public.
- Không dựng video/audio trên web — bước đó vẫn chạy CLI cục bộ (`video-generator`, `video-editor`), vì cần ffmpeg/Pillow không chạy được trên Vercel serverless.
- Không lưu lại lịch sử kịch bản đã sinh (không có database ở bản này).

## Setup local
```
cd web
npm install
cp .env.example .env.local   # điền KYMA_API_KEY thật
npm run dev
```
Mở http://localhost:3000.

## Deploy Vercel
```
npx vercel                # lần đầu, làm theo hướng dẫn liên kết project
npx vercel env add KYMA_API_KEY production   # dán key thật khi được hỏi, KHÔNG paste vào chat AI
npx vercel --prod
```

## Xong là gì (Definition of Done)
- Nhập ngách bất kỳ, bấm nút, nhận được kịch bản 3 phần trong vài giây, không lỗi.
- Deploy thành công lên Vercel, có link production/preview truy cập được từ bên ngoài.
- `KYMA_API_KEY` không xuất hiện ở phía client (kiểm tra qua DevTools Network/Sources) và được cấu hình dạng biến môi trường (secret) trên Vercel, không commit vào repo.
