// Thư viện dùng chung để dựng phụ đề .ass — style tham khảo từ project video khác của
// người dùng (đã kiểm chứng thật): nền đen mờ sau chữ, chữ trắng, cỡ 42, sát đáy khung hình.
// Dùng chung cho cả nhánh TTS ước lượng (Kyma) lẫn nhánh có timestamp thật (HeyGen).

const MAX_CHARS_PER_LINE = 28; // tránh tràn viền khi có từ dài (VD tên thương hiệu tiếng Anh)
const MAX_LINES_PER_CARD = 2; // câu dài vẫn đủ ý trong 1 thẻ nhờ xuống dòng, thay vì cắt sang thẻ khác

function assHeader(width, height) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,42,&H00FFFFFF,&H000000FF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,2,1,2,30,30,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

// Tách kịch bản thành từng câu theo dấu kết câu (. ! ? …) — không bao giờ để 2 câu
// dính vào chung 1 thẻ phụ đề, và không cắt ngang giữa câu.
function splitSentences(text) {
  const cleaned = text.replace(/\r/g, "").replace(/[*#_`]/g, "").replace(/\n+/g, " ").trim();
  const matches = cleaned.match(/[^.!?…]+[.!?…]*/g) || [cleaned];
  return matches.map((s) => s.trim()).filter(Boolean);
}

// Bọc 1 câu thành nhiều dòng theo kiểu nhét đầy dòng trước — dùng để KIỂM TRA nhanh
// cần bao nhiêu dòng (fitsCard), không dùng để hiển thị vì dễ để lại 1 từ lẻ ở dòng cuối.
function wrapLines(text, maxCharsPerLine) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (line && candidate.length > maxCharsPerLine) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Bọc CÂN BẰNG cho hiển thị thật: nếu vừa 2 dòng, chọn điểm chia sao cho 2 dòng dài
// gần bằng nhau nhất (tránh dòng 2 chỉ còn lẻ loi 1 từ như kiểu "nhét đầy dòng 1 trước").
function wrapLinesForDisplay(text, maxCharsPerLine) {
  const greedy = wrapLines(text, maxCharsPerLine);
  if (greedy.length <= 1) return greedy;

  const words = text.split(/\s+/).filter(Boolean);
  if (greedy.length === 2) {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const line1 = words.slice(0, i).join(" ");
      const line2 = words.slice(i).join(" ");
      if (line1.length <= maxCharsPerLine && line2.length <= maxCharsPerLine) {
        const diff = Math.abs(line1.length - line2.length);
        if (!best || diff < best.diff) best = { lines: [line1, line2], diff };
      }
    }
    if (best) return best.lines;
  }
  return greedy; // 3+ dòng hoặc không tìm được cách chia cân bằng — dùng bản nhét đầy
}

// Câu vừa 1-2 dòng thì ra đúng 1 thẻ. Câu dài hơn thì thử tăng dần số từ và kiểm tra
// TRỰC TIẾP bằng wrapLines() thật (không ước lượng bằng ngân sách ký tự lý thuyết,
// vì word-wrap theo từ không chia đều đẹp như phép tính chia — dễ lệch 1 dòng thừa)
// — dừng ngay trước khi thẻ vượt quá maxLinesPerCard dòng. Trả về mảng các NHÓM TỪ
// (chưa bọc dòng) kèm mảng chỉ số từ gốc — để nơi gọi có thể tra timestamp thật theo từ.
function sentenceToWordGroups(words, maxCharsPerLine, maxLinesPerCard) {
  const fitsCard = (ws) => wrapLines(ws.join(" "), maxCharsPerLine).length <= maxLinesPerCard;

  const groups = [];
  let start = 0;
  while (start < words.length) {
    let end = words.length;
    while (end > start + 1 && !fitsCard(words.slice(start, end))) end--;
    groups.push({ start, end });
    start = end;
  }

  // Cụm cuối quá ngắn (<=2 từ): cụm liền trước thường đã đầy nên không thể nhét thêm
  // nguyên cụm cuối vào — thay vào đó CHIA LẠI ĐỀU cả 2 cụm cuối cộng chung, để không
  // bên nào bị lẻ quá ít từ.
  if (groups.length > 1) {
    const last = groups[groups.length - 1];
    if (last.end - last.start <= 2) {
      const prev = groups[groups.length - 2];
      const combinedStart = prev.start;
      const combinedEnd = last.end;
      const combinedWords = words.slice(combinedStart, combinedEnd);
      let splitAt = Math.ceil(combinedWords.length / 2);
      const fitsRange = (s, e) => fitsCard(words.slice(s, e));
      while (
        splitAt > 1 &&
        splitAt < combinedWords.length &&
        !(fitsRange(combinedStart, combinedStart + splitAt) && fitsRange(combinedStart + splitAt, combinedEnd))
      ) {
        splitAt--;
      }
      if (
        splitAt > 1 &&
        fitsRange(combinedStart, combinedStart + splitAt) &&
        fitsRange(combinedStart + splitAt, combinedEnd)
      ) {
        groups.splice(groups.length - 2, 2, { start: combinedStart, end: combinedStart + splitAt }, { start: combinedStart + splitAt, end: combinedEnd });
      }
    }
  }

  return groups;
}

// Trả về danh sách thẻ phụ đề: { text (đã bọc dòng, nối \\N), wordStart, wordEnd (chỉ số
// từ trong toàn kịch bản — dùng để tra timestamp thật nếu có), wordCount }.
function buildCaptionCards(script) {
  const sentences = splitSentences(script);
  const cards = [];
  let globalOffset = 0;
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    const groups = sentenceToWordGroups(words, MAX_CHARS_PER_LINE, MAX_LINES_PER_CARD);
    for (const g of groups) {
      const groupWords = words.slice(g.start, g.end);
      const lines = wrapLinesForDisplay(groupWords.join(" "), MAX_CHARS_PER_LINE);
      cards.push({
        text: lines.join("\\N"),
        wordStart: globalOffset + g.start,
        wordEnd: globalOffset + g.end, // exclusive
        wordCount: g.end - g.start,
      });
    }
    globalOffset += words.length;
  }
  return cards;
}

function fmtAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds - Math.floor(seconds)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

// Ước lượng tuyến tính (khi KHÔNG có timestamp thật): phân bổ thời lượng theo tỉ lệ số
// từ mỗi thẻ trên tổng số từ toàn kịch bản.
function buildAssCaptionsEstimated(script, totalDuration, width, height) {
  const cards = buildCaptionCards(script);
  const totalWords = cards.reduce((sum, c) => sum + c.wordCount, 0);

  let events = "";
  let t = 0;
  for (const card of cards) {
    const share = card.wordCount / totalWords;
    const dur = Math.max(share * totalDuration, 0.6); // tối thiểu 0.6s/thẻ để không nháy quá nhanh
    const start = t;
    const end = Math.min(t + dur, totalDuration);
    events += `Dialogue: 0,${fmtAssTime(start)},${fmtAssTime(end)},Default,,0,0,0,,${card.text}\n`;
    t = end;
  }
  return assHeader(width, height) + events;
}

// Chính xác (khi CÓ timestamp thật theo từ, vd từ HeyGen word_timestamps): tra đúng
// thời điểm bắt đầu/kết thúc của từng thẻ theo từ thật, không ước lượng.
// wordTimestamps: mảng [{word, start, end}, ...] theo đúng thứ tự lời thoại.
function buildAssCaptionsFromTimestamps(script, wordTimestamps, width, height) {
  const cards = buildCaptionCards(script);
  if (wordTimestamps.length !== cards.reduce((s, c) => s + c.wordCount, 0)) {
    throw new Error(
      `Số từ không khớp giữa kịch bản (${cards.reduce((s, c) => s + c.wordCount, 0)}) và word_timestamps (${wordTimestamps.length}) — không thể căn timestamp thật.`
    );
  }

  let events = "";
  for (const card of cards) {
    const start = wordTimestamps[card.wordStart].start;
    const end = wordTimestamps[card.wordEnd - 1].end;
    events += `Dialogue: 0,${fmtAssTime(start)},${fmtAssTime(end)},Default,,0,0,0,,${card.text}\n`;
  }
  return assHeader(width, height) + events;
}

module.exports = {
  MAX_CHARS_PER_LINE,
  MAX_LINES_PER_CARD,
  assHeader,
  splitSentences,
  wrapLines,
  wrapLinesForDisplay,
  buildCaptionCards,
  fmtAssTime,
  buildAssCaptionsEstimated,
  buildAssCaptionsFromTimestamps,
};
