// Logic sinh kịch bản qua Kyma API — phản chiếu đúng logic của
// script-writer/scripts/write_script.js (buildPrompt/parseCleanScript) để bản demo web
// trả về kết quả nhất quán với bản dòng lệnh. Viết lại riêng (không import trực tiếp
// từ script-writer) vì Next.js route chạy trong runtime/module system khác.

const KYMA_MODELS = ["claude-haiku-4-5", "gemini-2.5-flash", "gpt-5.6-luna"];
const SECTION_MARKERS = ["===HOOK===", "===NOIDUNG===", "===CTA==="];

function buildPrompt(niche, video) {
  const system = `Bạn là chuyên gia viết kịch bản video ngắn (TikTok/Reels/YouTube Shorts) cho người xây dựng thương hiệu cá nhân để bán hàng tại Việt Nam.
Nhiệm vụ: phân tích 1 video đang viral trong một ngách cụ thể, rút ra cấu trúc/hook đang hiệu quả, sau đó viết một kịch bản HOÀN TOÀN MỚI, nguyên bản — không sao chép nguyên văn câu chữ từ video tham chiếu.
Giọng văn tự nhiên như người thật nói chuyện, không máy móc, không phóng đại sai sự thật, không đưa ra cam kết y tế/sức khoẻ tuyệt đối.

QUAN TRỌNG — ĐỊNH DẠNG ĐẦU RA:
Chỉ trả lời đúng 3 khối dưới đây, đúng nguyên văn 3 dòng đánh dấu, không thêm bất kỳ lời dẫn, lời chào, phân tích, nhận xét, tiêu đề in đậm hay chú thích hình ảnh/quay phim nào khác. Mỗi khối CHỈ chứa lời thoại sẽ được đọc thành tiếng — không markdown, không ngoặc mô tả hành động/hình ảnh.

===HOOK===
(lời thoại 3 giây đầu, giữ chân người xem)
===NOIDUNG===
(lời thoại nội dung chính, liền mạch như đang nói chuyện)
===CTA===
(lời thoại kêu gọi hành động ở cuối)`;

  const referenceText = video
    ? `Transcript của video tham chiếu:\n"""\n${video.transcript}\n"""`
    : `(Không có video tham chiếu cụ thể — hãy tự đề xuất 1 cấu trúc hook phù hợp cho ngách này.)`;

  const user = `Ngách/ngành hàng cần viết kịch bản: ${niche}

${video ? `Video tham chiếu đang viral:\n- Tiêu đề: ${video.caption}\n- Lượt xem: ${video.views}\n` : ""}
${referenceText}

Hãy viết 1 kịch bản mới cho ngách "${niche}", học cấu trúc/hook từ video trên (nếu có) nhưng nội dung phải nguyên bản, không sao chép. Nhớ trả lời đúng định dạng 3 khối đã yêu cầu, không thêm gì khác.`;

  return { system, user };
}

function cleanSectionText(s) {
  return (s || "")
    .replace(/\(.*?\)/gs, "")
    .replace(/[*#_`]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function parseCleanScript(raw) {
  const hasAllMarkers = SECTION_MARKERS.every((m) => raw.includes(m));
  let hook = "", noidung = "", cta = "";
  if (hasAllMarkers) {
    const [, h, n, c] = raw.split(/===HOOK===|===NOIDUNG===|===CTA===/);
    hook = cleanSectionText(h);
    noidung = cleanSectionText(n);
    cta = cleanSectionText(c);
  } else {
    noidung = cleanSectionText(raw);
  }
  return { sections: { hook, noidung, cta }, hasSections: hasAllMarkers };
}

async function callModel(apiKey, model, system, user) {
  const res = await fetch("https://kymaapi.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(detail);
    err.temporary = /temporarily unavailable/i.test(detail);
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("KYMA API không trả về nội dung script (response rỗng).");
  return content;
}

export async function generateScript(apiKey, niche, video) {
  const { system, user } = buildPrompt(niche, video);

  let lastErr;
  for (const model of KYMA_MODELS) {
    try {
      const content = await callModel(apiKey, model, system, user);
      const { sections, hasSections } = parseCleanScript(content);
      return { sections, hasSections, model };
    } catch (err) {
      lastErr = err;
      if (!err.temporary) throw err;
    }
  }
  throw new Error(`Tất cả model đều tạm thời quá tải (${lastErr?.message}).`);
}
