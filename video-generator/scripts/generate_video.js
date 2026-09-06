// Gọi HeyGen Avatar III (v2/video/generate) để dựng video có gương mặt (avatar) từ kịch bản
// đã sinh ở script-writer, theo dõi tiến trình render rồi tự động tải video thật về máy.
// Usage: node scripts/generate_video.js <avatar_id> <voice_id> [--real] [đường-dẫn-file-script-json]
//
// Mặc định chạy chế độ TEST (video có watermark, không tốn credit thật) để kiểm tra luồng.
// Thêm cờ --real để render bản thật (tốn credit HeyGen).

const fs = require("fs");
const path = require("path");
const { loadEnvVar } = require("./lib/env");

const HEYGEN_BASE = "https://api.heygen.com";
const SCRIPT_WRITER_OUTPUT_DIR = path.join(__dirname, "..", "..", "script-writer", "output");
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 phút

function findLatestScriptFile() {
  const files = fs
    .readdirSync(SCRIPT_WRITER_OUTPUT_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(SCRIPT_WRITER_OUTPUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error(
      `Không tìm thấy file kịch bản nào trong ${SCRIPT_WRITER_OUTPUT_DIR}. Hãy chạy script-writer trước.`
    );
  }
  return path.join(SCRIPT_WRITER_OUTPUT_DIR, files[0].f);
}

async function createVideo(apiKey, { script, avatarId, voiceId, isTest }) {
  const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      test: isTest,
      title: "AI Personal Branding Video",
      dimension: { width: 720, height: 1280 }, // dọc, phù hợp TikTok/Reels/Shorts
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: script,
            voice_id: voiceId,
          },
        },
      ],
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.error?.message || body?.message || `HTTP ${res.status}`;
    throw new Error(`HeyGen tạo video lỗi: ${detail}`);
  }
  const videoId = body?.data?.video_id;
  if (!videoId) throw new Error(`HeyGen không trả về video_id. Response: ${JSON.stringify(body)}`);
  return videoId;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilDone(apiKey, videoId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
      headers: { "X-Api-Key": apiKey },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = body?.error?.message || `HTTP ${res.status}`;
      throw new Error(`HeyGen kiểm tra trạng thái lỗi: ${detail}`);
    }

    const status = body?.data?.status;
    if (status === "completed") return body.data;
    if (status === "failed") {
      throw new Error(`HeyGen render thất bại: ${body?.data?.error?.message || "không rõ lý do"}`);
    }

    console.log(`Đang render... trạng thái: ${status || "unknown"} (đợi ${POLL_INTERVAL_MS / 1000}s)`);
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Quá thời gian chờ (${POLL_TIMEOUT_MS / 1000}s) mà video chưa render xong.`);
}

async function downloadVideo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải video thất bại: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

async function main() {
  const args = process.argv.slice(2);
  const isReal = args.includes("--real");
  const positional = args.filter((a) => a !== "--real");
  const [avatarId, voiceId, filePathArg] = positional;

  if (!avatarId || !voiceId) {
    console.error(
      'Cần truyền avatar_id và voice_id. Ví dụ: node scripts/generate_video.js <avatar_id> <voice_id> [--real] [file-script.json]'
    );
    process.exit(1);
  }

  const apiKey = loadEnvVar("HEYGEN_API_KEY");
  const scriptFile = filePathArg ? path.resolve(filePathArg) : findLatestScriptFile();
  const scriptData = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
  const scriptText = scriptData.script;
  if (!scriptText) throw new Error(`File ${scriptFile} không có trường "script".`);

  console.log(`Chế độ: ${isReal ? "THẬT (tốn credit)" : "TEST (watermark, không tốn credit thật)"}`);
  console.log(`Đang gửi kịch bản (ngách: ${scriptData.niche || "?"}) tới HeyGen (avatar_id=${avatarId})...`);

  const videoId = await createVideo(apiKey, {
    script: scriptText,
    avatarId,
    voiceId,
    isTest: !isReal,
  });
  console.log(`Đã tạo job render, video_id = ${videoId}. Đang theo dõi tiến trình...`);

  const result = await pollUntilDone(apiKey, videoId);
  console.log(`Render xong! video_url = ${result.video_url}`);

  const outDir = path.join(__dirname, "..", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const timestamp = Date.now();
  const videoPath = path.join(outDir, `video_${timestamp}.mp4`);

  console.log("Đang tải video về máy...");
  await downloadVideo(result.video_url, videoPath);

  const metaPath = path.join(outDir, `video_${timestamp}.json`);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        avatar_id: avatarId,
        voice_id: voiceId,
        source_script_file: scriptFile,
        heygen_video_id: videoId,
        video_url: result.video_url,
        local_path: videoPath,
        mode: isReal ? "real" : "test",
        generated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`\nĐã lưu video tại: ${videoPath}`);
  console.log(`Metadata: ${metaPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
