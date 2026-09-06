// Nhánh B (no-face), nguồn TTS = Kyma/ElevenLabs — dựng "video gốc" không cần avatar/gương mặt
// + nền đơn giản + phụ đề (ước lượng thời lượng theo tỉ lệ số từ, chưa có timestamp thật).
// Muốn dùng giọng đã clone của chính bạn (qua HeyGen) kèm timestamp thật, xem
// scripts/generate_video_noface_heygen.js thay vì file này.
// Đây là bản GỐC (chưa polish theo ngành) — bước edit hậu kỳ nằm ở component riêng, sau bước này.
// Usage: node scripts/generate_video_noface.js [voice_id] [đường-dẫn-file-script-json]

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadEnvVar } = require("./lib/env");
const { buildAssCaptionsEstimated } = require("./lib/captions");

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // "Sarah" — giọng nữ trung tính, đa ngôn ngữ (ElevenLabs)
const TTS_MODEL = process.env.KYMA_TTS_MODEL || "eleven-multilingual-v2"; // vd KYMA_TTS_MODEL=eleven-turbo-v2-5 để giảm chi phí
const SCRIPT_WRITER_OUTPUT_DIR = path.join(__dirname, "..", "..", "script-writer", "output");
const BG_COLOR = "0x1F3B5C"; // nền đơn sắc tạm thời — B-roll thật thuộc bước edit hậu kỳ sau này
const DIMENSION = { width: 720, height: 1280 };

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

async function textToSpeech(apiKey, text, voiceId, destPath) {
  const res = await fetch("https://kymaapi.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text,
      voice_id: voiceId,
      response_format: "mp3_44100_128",
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Kyma TTS lỗi: ${detail}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

function getAudioDuration(filePath) {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]).toString().trim();
  return parseFloat(out);
}

function assembleVideo({ audioPath, captionsPath, duration, outPath }) {
  // Nền đơn sắc + phụ đề .ass (style đã khai báo sẵn trong file) + audio TTS — ghép bằng ffmpeg.
  const captionsFilter = captionsPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  const vf = `subtitles='${captionsFilter}'`;

  execFileSync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${BG_COLOR}:s=${DIMENSION.width}x${DIMENSION.height}:d=${duration}`,
    "-i", audioPath,
    "-vf", vf,
    "-c:v", "libx264",
    "-c:a", "aac",
    "-shortest",
    outPath,
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const voiceId = args[0] || DEFAULT_VOICE_ID;
  const filePathArg = args[1];

  const apiKey = loadEnvVar("KYMA_API_KEY", { root: path.join(__dirname, "..", "..", "script-writer") });
  const scriptFile = filePathArg ? path.resolve(filePathArg) : findLatestScriptFile();
  const scriptData = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
  const scriptText = scriptData.script;
  if (!scriptText) throw new Error(`File ${scriptFile} không có trường "script".`);

  const outDir = path.join(__dirname, "..", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const timestamp = Date.now();
  const audioPath = path.join(outDir, `noface_${timestamp}.mp3`);
  const captionsPath = path.join(outDir, `noface_${timestamp}.ass`);
  const videoPath = path.join(outDir, `noface_${timestamp}.mp4`);

  console.log(`Đang tạo giọng đọc (voice_id=${voiceId}) cho kịch bản ngách "${scriptData.niche || "?"}"...`);
  await textToSpeech(apiKey, scriptText, voiceId, audioPath);

  const duration = getAudioDuration(audioPath);
  console.log(`Đã tạo audio, thời lượng ${duration.toFixed(1)}s. Đang chia phụ đề (ước lượng theo tỉ lệ từ)...`);

  const ass = buildAssCaptionsEstimated(scriptText, duration, DIMENSION.width, DIMENSION.height);
  fs.writeFileSync(captionsPath, ass, "utf8");

  console.log("Đang ghép video (nền + phụ đề + audio) bằng ffmpeg...");
  assembleVideo({ audioPath, captionsPath, duration, outPath: videoPath });

  const metaPath = path.join(outDir, `noface_${timestamp}.json`);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        mode: "no-face",
        tts_provider: "kyma",
        voice_id: voiceId,
        source_script_file: scriptFile,
        audio_path: audioPath,
        captions_path: captionsPath,
        video_path: videoPath,
        duration_seconds: duration,
        generated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`\nĐã lưu video no-face tại: ${videoPath}`);
  console.log(`Metadata: ${metaPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
