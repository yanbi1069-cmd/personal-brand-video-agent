# Nhạc nền cục bộ

Không có API nhạc miễn phí chính thức nào (đã kiểm tra thực tế: Pixabay chỉ có API ảnh + video, không có API nhạc). Vì vậy nhạc nền được lấy từ file cục bộ bạn tự chuẩn bị.

## Cách dùng
1. Tải vài file nhạc royalty-free (miễn phí bản quyền) từ [YouTube Audio Library](https://www.youtube.com/audiolibrary) hoặc tải tay từ [Pixabay Music](https://pixabay.com/music/) (trang web, không phải API).
2. Đặt file `.mp3`/`.wav`/`.m4a` vào đúng thư mục ngành tương ứng: `spa/`, `bat-dong-san/`, `coach/`.
3. Chạy `edit_video.js <ngành>` như bình thường — nếu thư mục có file, tool tự chọn ngẫu nhiên 1 bài và trộn nhỏ dưới giọng đọc (âm lượng ~12%). Nếu thư mục trống, video vẫn ra bình thường, chỉ là không có nhạc nền.

## Lưu ý bản quyền
Chỉ dùng nhạc có giấy phép cho phép sử dụng thương mại/không cần credit (hoặc credit đúng yêu cầu). Không dùng nhạc có bản quyền chưa xin phép.
