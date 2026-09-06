// Sinh kịch bản video mới (nguyên bản) dựa trên 1 video tham chiếu đang viral,
// lấy từ kết quả research của content-scout, dùng KYMA API (model text).
// Usage: node scripts/write_script.js "<ngách>" [đường-dẫn-file-json-content-scout]

const fs = require("fs");
const path = require("path");
const { loadEnvVar } = require("./lib/env");

// Thử theo thứ tự — nếu model đầu bị nhà cung cấp báo tạm thời quá tải, tự động rơi xuống model kế tiếp.
const KYMA_MODELS = ["claude-haiku-4-5", "gemini-2.5-flash", "gpt-5.6-luna"];
const CONTENT_SCOUT_OUTPUT_DIR = path.join(__dirname, "..", "..", "content-scout", "output");

// Nếu không truyền file cụ thể, lấy file .json mới nhất trong output/ của content-scout
// (bỏ qua sample.json vì đó là dữ liệu mẫu đã che, không phải kết quả research thật).
function findLatestContentScoutFile() {
  const files = fs
    .readdirSync(CONTENT_SCOUT_OUTPUT_DIR)
    .filter((f) => f.endsWith(".json") && f !== "sample.json")
    .map((f) => ({ f, mtime: fs.statSync(path.join(CONTENT_SCOUT_OUTPUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error(
      `Không tìm thấy file kết quả nào trong ${CONTENT_SCOUT_OUTPUT_DIR}. Hãy chạy content-scout trước.`
    );
  }
  return path.join(CONTENT_SCOUT_OUTPUT_DIR, files[0].f);
}

// Chọn video tham chiếu: ưu tiên video có transcript thật + view cao nhất.
// Nếu không video nào có transcript, dùng video view cao nhất và cảnh báo giới hạn.
function pickReferenceVideo(items) {
  const withTranscript = items.filter((it) => it.transcript);
  const pool = withTranscript.length > 0 ? withTranscript : items;
  const sorted = [...pool].sort((a, b) => (b.engagement?.views ?? 0) - (a.engagement?.views ?? 0));
  return { video: sorted[0], usedTranscript: withTranscript.length > 0 };
}

const SECTION_MARKERS = ["===HOOK===", "===NOIDUNG===", "===CTA==="];

function buildPrompt(niche, video, usedTranscript) {
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

  const referenceText = usedTranscript
    ? `Transcript đầy đủ của video tham chiếu:\n"""\n${video.transcript}\n"""`
    : `(Video này không lấy được transcript, chỉ có tiêu đề — hãy suy luận cấu trúc dựa trên tiêu đề và cân nhắc kỹ vì thông tin đầu vào hạn chế.)`;

  const user = `Ngách/ngành hàng cần viết kịch bản: ${niche}

Video tham chiếu đang viral:
- Tiêu đề: ${video.caption}
- Lượt xem: ${video.engagement?.views ?? "không rõ"}
- Link gốc: ${video.url}

${referenceText}

Hãy viết 1 kịch bản mới cho ngách "${niche}", học cấu trúc/hook từ video trên nhưng nội dung phải nguyên bản, không sao chép. Nhớ trả lời đúng định dạng 3 khối đã yêu cầu, không thêm gì khác.`;

  return { system, user };
}

// Model đôi khi vẫn lỡ thêm lời dẫn/markdown dù đã dặn — parse theo marker rồi dọn sạch
// để đảm bảo "script" cuối cùng chỉ còn lời thoại thuần, an toàn cho TTS/HeyGen đọc.
function cleanSectionText(s) {
  return (s || "")
    .replace(/\(.*?\)/gs, "") // bỏ chú thích trong ngoặc (hình ảnh/hành động)
    .replace(/[*#_`]/g, "") // bỏ ký tự markdown
    .replace(/^\s*[-•]\s*/gm, "") // bỏ gạch đầu dòng
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

// Trả về cả bản gộp (dùng cho TTS/HeyGen) LẪN từng khối riêng hook/noidung/cta
// (dùng để dựng motion graphics theo từng đoạn — hook/CTA full-screen người nói,
// noidung là chỗ chèn đồ hoạ minh hoạ theo ngành).
function parseCleanScript(raw) {
  const hasAllMarkers = SECTION_MARKERS.every((m) => raw.includes(m));
  let hook = "", noidung = "", cta = "";
  if (hasAllMarkers) {
    const [, h, n, c] = raw.split(/===HOOK===|===NOIDUNG===|===CTA===/);
    hook = cleanSectionText(h);
    noidung = cleanSectionText(n);
    cta = cleanSectionText(c);
  } else {
    // Fallback: model không theo đúng định dạng — không tách được khối, để nguyên vào noidung.
    noidung = cleanSectionText(raw);
  }

  const script = [hook, noidung, cta].filter(Boolean).join("\n\n");
  return { script, sections: { hook, noidung, cta }, hasSections: hasAllMarkers };
}

async function callModel(apiKey, model, system, user) {
  const res = await fetch("https://kymaapi.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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

// Thử lần lượt từng model trong KYMA_MODELS. Chỉ rơi xuống model kế tiếp khi lỗi là
// "tạm thời quá tải" (temporary) — lỗi khác (vd sai key, hết credit) thì dừng luôn, không thử tiếp.
async function generateScript(apiKey, niche, video, usedTranscript) {
  const { system, user } = buildPrompt(niche, video, usedTranscript);

  let lastErr;
  for (const model of KYMA_MODELS) {
    try {
      const content = await callModel(apiKey, model, system, user);
      if (model !== KYMA_MODELS[0]) {
        console.warn(`Lưu ý: model chính bận, đã tự động dùng model dự phòng "${model}".`);
      }
      return { content, model };
    } catch (err) {
      lastErr = err;
      if (!err.temporary) throw new Error(`KYMA API lỗi: ${err.message}`);
      console.warn(`Model "${model}" tạm thời quá tải, thử model kế tiếp...`);
    }
  }
  throw new Error(`KYMA API lỗi: tất cả model đều tạm thời quá tải (${lastErr?.message}).`);
}

async function main() {
  const niche = process.argv[2];
  const filePathArg = process.argv[3];

  if (!niche) {
    console.error('Cần truyền ngách/ngành hàng. Ví dụ: node scripts/write_script.js "spa thẩm mỹ"');
    process.exit(1);
  }

  const apiKey = loadEnvVar("KYMA_API_KEY");
  const sourceFile = filePathArg ? path.resolve(filePathArg) : findLatestContentScoutFile();
  const items = JSON.parse(fs.readFileSync(sourceFile, "utf8"));

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`File ${sourceFile} không có kết quả nào để dùng làm tham chiếu.`);
  }

  const { video, usedTranscript } = pickReferenceVideo(items);
  if (!usedTranscript) {
    console.warn(
      "Cảnh báo: không video nào trong file có transcript thật — kịch bản được viết chỉ dựa trên tiêu đề, chất lượng có thể hạn chế."
    );
  }

  console.log(`Đang viết kịch bản cho ngách "${niche}" (tham chiếu: ${video.caption})...`);
  const { content: rawResponse, model } = await generateScript(apiKey, niche, video, usedTranscript);
  const { script, sections, hasSections } = parseCleanScript(rawResponse);

  const outDir = path.join(__dirname, "..", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `script_${Date.now()}.json`);
  const result = {
    niche,
    source_video: {
      url: video.url,
      caption: video.caption,
      views: video.engagement?.views ?? null,
    },
    used_transcript: usedTranscript,
    model,
    generated_at: new Date().toISOString(),
    script, // lời thoại sạch, dùng cho TTS/HeyGen — không chứa lời dẫn/phân tích/chú thích
    sections, // { hook, noidung, cta } — dùng để dựng motion graphics theo từng đoạn
    has_sections: hasSections, // false nếu model không theo đúng định dạng 3 khối (sections.noidung chứa toàn bộ)
    raw_response: rawResponse, // nguyên văn phản hồi model, chỉ để tham khảo/debug
  };
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");

  console.log(`\n===== KỊCH BẢN (đọc và tự duyệt trước khi dùng) =====\n`);
  console.log(script);
  console.log(`\n===== Đã lưu vào ${outFile} =====`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
