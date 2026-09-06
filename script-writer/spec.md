# Spec: script-writer

## 1. Vấn đề
Sau khi tìm được content đang viral trong ngách (bước research của `content-scout`), người dùng vẫn phải tự đọc transcript, tự phân tích cấu trúc/hook, rồi tự gõ tay một kịch bản mới cho video của mình — tốn thời gian và dễ ra kịch bản nhạt, không học được đúng cấu trúc đang hiệu quả.

## 2. Người dùng
Cá nhân/chủ doanh nghiệp đang xây kênh thương hiệu cá nhân để bán hàng, đã có sẵn dữ liệu research từ `content-scout` (JSON gồm video, transcript, engagement) và muốn có ngay bản nháp kịch bản để tự chỉnh sửa trước khi quay/tạo video.

## 3. Nói làm gì
- Nhận đầu vào: 1 file JSON kết quả từ `content-scout` (mặc định lấy file mới nhất trong `../content-scout/output/`) + tên ngách/ngành hàng (string, ví dụ "spa/thẩm mỹ").
- Chọn video tham chiếu: video có `transcript` thật và lượt xem cao nhất trong danh sách (nếu không video nào có transcript, dùng video có view cao nhất, chỉ dựa vào caption + cảnh báo rõ giới hạn này).
- Gọi KYMA API (model text, mặc định `claude-haiku-4.5`) để: phân tích cấu trúc/hook của transcript tham chiếu, sau đó viết một **kịch bản mới, nguyên bản** (không sao chép nguyên văn) theo đúng ngách đã chọn, giọng nói tự nhiên, có hook mở đầu — nội dung chính — call-to-action kết thúc.
- Lưu kết quả ra JSON gồm: ngách, video tham chiếu (link + tiêu đề + view), kịch bản mới sinh ra, tên model đã dùng, thời gian tạo.
- In script ra màn hình để người dùng đọc và tự duyệt ngay (không tự động dùng script này cho bước sau nếu chưa có ai đọc qua).

## 4. KHÔNG làm gì
- KHÔNG tự động gọi bước tạo video (avatar/no-face) — nằm ở component riêng, không nằm trong bài này.
- KHÔNG tự động đăng bài lên bất kỳ kênh nào.
- KHÔNG tự động chỉnh sửa hoặc "làm mới" kịch bản nhiều lần liên tục — chỉ sinh 1 bản nháp mỗi lần chạy, người dùng tự quyết định chạy lại nếu chưa ưng ý.
- KHÔNG sao chép nguyên văn transcript gốc vào kịch bản mới (rủi ro bản quyền + không phải mục tiêu — mục tiêu là học cấu trúc, không phải đạo văn).

## 5. Dữ liệu
- **Input**: đường dẫn file JSON từ content-scout (string, optional — mặc định file mới nhất), ngách/ngành hàng (string, bắt buộc).
- **Output**: JSON gồm `{niche, source_video: {url, caption, views}, model, generated_at, script}`.
- `KYMA_API_KEY` lưu trong file `.env` local, **không** commit vào repo (bị chặn trong `.gitignore`), giống nguyên tắc bảo mật của `content-scout`.

## 6. Xong là gì
- Chạy được script với 1 file JSON thật từ content-scout + 1 ngách thật, sinh ra được **1 kịch bản mới hoàn chỉnh** (có mở đầu, nội dung, kết thúc), lưu thành công ra file JSON.
- Kịch bản sinh ra phải khác biệt rõ ràng so với transcript gốc (không phải copy-paste), nhưng vẫn giữ được cấu trúc/hook học từ video tham chiếu.
- Có bằng chứng chạy thử (file output thật, có thể kèm ảnh terminal) để dùng làm minh chứng cho Bài tập 1 buổi 4 (MVP đã build + test).

## 7. Để ở đâu
- Code nằm trong thư mục/repo riêng `script-writer` (nối tiếp `content-scout`, không gộp chung — theo đúng ranh giới "KHÔNG làm gì" đã khai báo trong spec của `content-scout`).
- `KYMA_API_KEY` nằm trong `.env` local, không nằm trong repo dưới mọi hình thức.
