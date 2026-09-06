// Tự phục vụ: mỗi người dùng agent này clone GIỌNG CỦA CHÍNH HỌ qua HeyGen, không dùng
// chung giọng với ai khác — đúng tinh thần "agent xây dựng thương hiệu cá nhân".
// Usage: node scripts/clone_voice.js <đường-dẫn-file-audio-hoặc-video> "<Tên hiển thị giọng>"
//
// Chấp nhận cả file audio (.mp3/.wav/.m4a) lẫn video (.mp4...) — nếu là video, tự tách
// audio bằng ffmpeg trước khi gửi đi clone.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadEnvVar } = require("./lib/env");

const HEYGEN_BASE = "https://api.heygen.com";
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

function extractAudioIfNeeded(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const audioExts = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
  if (audioExts.includes(ext)) return inputPath;

  console.log("Phát hiện file video — đang tách audio bằng ffmpeg...");
  const outPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, ext)}_extracted_audio.mp3`
  );
  execFileSync("ffmpeg", ["-y", "-i", inputPath, "-vn", "-acodec", "libmp3lame", "-q:a", "2", outPath]);
  return outPath;
}

function guessMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg" };
  return map[ext] || "audio/mpeg";
}

async function cloneVoice(apiKey, audioPath, voiceName) {
  const buffer = fs.readFileSync(audioPath);
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > 10) {
    console.warn(`Cảnh báo: file audio ${sizeMB.toFixed(1)}MB khá lớn để gửi base64 — nếu lỗi, hãy cắt ngắn mẫu giọng (30s-2 phút là đủ).`);
  }

  const res = await fetch(`${HEYGEN_BASE}/v3/voices/clone`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: {
        type: "base64",
        media_type: guessMediaType(audioPath),
        data: buffer.toString("base64"),
      },
      voice_name: voiceName,
      remove_background_noise: true,
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.error?.message || body?.message || `HTTP ${res.status}`;
    if (res.status === 403) {
      throw new Error(
        `HeyGen từ chối (có thể gói tài khoản chưa hỗ trợ clone voice): ${detail}`
      );
    }
    throw new Error(`Clone voice lỗi: ${detail}`);
  }

  const voiceCloneId = body?.data?.voice_clone_id;
  if (!voiceCloneId) throw new Error(`HeyGen không trả về voice_clone_id. Response: ${JSON.stringify(body)}`);
  return voiceCloneId;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilReady(apiKey, voiceCloneId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const res = await fetch(`${HEYGEN_BASE}/v3/voices/${voiceCloneId}`, {
      headers: { "X-Api-Key": apiKey },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Kiểm tra trạng thái clone lỗi: ${body?.error?.message || res.status}`);

    const status = body?.data?.status;
    if (status === "complete") return body.data;
    if (status === "failed") throw new Error(`Clone voice thất bại: ${body?.data?.error || "không rõ lý do"}`);

    console.log(`Đang xử lý clone... trạng thái: ${status || "unknown"} (đợi ${POLL_INTERVAL_MS / 1000}s)`);
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Quá thời gian chờ (${POLL_TIMEOUT_MS / 1000}s) mà clone chưa xong.`);
}

async function main() {
  const [inputPath, voiceName] = process.argv.slice(2);
  if (!inputPath || !voiceName) {
    console.error(
      'Cần truyền file audio/video + tên hiển thị. Ví dụ: node scripts/clone_voice.js "giong-cua-toi.mp4" "Giọng của tôi"'
    );
    process.exit(1);
  }

  const apiKey = loadEnvVar("HEYGEN_API_KEY");
  const audioPath = extractAudioIfNeeded(path.resolve(inputPath));

  console.log(`Đang gửi mẫu giọng "${path.basename(audioPath)}" lên HeyGen để clone...`);
  const voiceCloneId = await cloneVoice(apiKey, audioPath, voiceName);
  console.log(`Đã gửi, voice_clone_id = ${voiceCloneId}. Đang chờ HeyGen xử lý...`);

  const result = await pollUntilReady(apiKey, voiceCloneId);
  const voiceId = result.voice_id || result.id || voiceCloneId;

  console.log(`\n✅ Clone xong! voice_id của bạn: ${voiceId}`);
  console.log(`\nThêm dòng sau vào file .env của bạn để pipeline dùng đúng giọng này:`);
  console.log(`HEYGEN_VOICE_ID=${voiceId}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
