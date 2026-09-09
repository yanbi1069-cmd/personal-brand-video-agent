// Dữ liệu tham chiếu THẬT lấy từ content-scout (research thật, không giả lập) — bundle sẵn
// vào web app thay vì gọi lại Apify mỗi lần người dùng bấm nút, để: (1) trải nghiệm nhanh
// (không đợi research mất nhiều giây), (2) không tốn phí Apify không kiểm soát mỗi lượt
// khách ghé trang demo, (3) chạy gọn trong giới hạn thời gian của Vercel serverless.
//
// Đây CHỈ là preset cho bản demo web — pipeline đầy đủ (chạy content-scout thật theo
// bất kỳ ngách nào) vẫn nằm ở content-scout/script-writer chạy dòng lệnh, xem README gốc.

export const REFERENCE_VIDEOS = {
  "spa thẩm mỹ chăm sóc da": {
    caption: "4 thói quen chăm sóc da buổi sáng khiến lão hoa da không phanh mà hầu hết ai cũng mắc phải",
    url: "https://www.youtube.com/watch?v=KjMKlWj11x8",
    views: 226970,
    transcript:
      "Bốn thói quen chăm sóc da vào buổi sáng khiến da bạn lão hóa không phanh mà hầu hết ai cũng mắc phải, đặc biệt là thói quen thứ tư bạn cùng xem. Thói quen đầu tiên các bạn mắc phải khi chăm sóc da chính là không làm sạch da tốt vào buổi sáng — ban đêm da vẫn tăng tiết dầu, tăng tiết bã nhờn, cộng bụi mịn từ không khí và bẩn từ vỏ chăn gối, nếu buổi sáng không làm sạch kỹ thì lỗ chân lông sẽ bít tắc.",
  },
};

export const NICHE_PRESETS = Object.keys(REFERENCE_VIDEOS);
