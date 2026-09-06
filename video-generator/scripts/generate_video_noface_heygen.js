// Nhánh B (no-face), nguồn TTS = HeyGen (dùng giọng ĐÃ CLONE của chính chủ kênh qua
// scripts/clone_voice.js) — khác với generate_video_noface.js (dùng giọng có sẵn của
// Kyma/ElevenLabs, chưa phải giọng thật của người dùng).
//
// Lợi thế: HeyGen /v3/voices/speech trả kèm word_timestamps THẬT theo từng từ, nên phụ đề
// ở đây được căn CHÍNH XÁC theo lời nói thật, không phải ước lượng tuyến tính như bản kia.
//
// Usage: node scripts/generate_video_noface_heygen.js <voice_id> [đường-dẫn-file-script-json]
// (voice_id lấy từ scripts/clone_voice.js sau khi clone xong)

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadEnvVar } = require("./lib/env");
const { buildAssCaptionsFromTimestamps } = require("./lib/captions");

const HEYGEN_BASE = "https://api.heygen.com";
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

// Gọi HeyGen TTS-ONLY (không render video) — trả về audio_url + word_timestamps thật.
async function textToSpeechHeyGen(apiKey, text, voiceId) {
  const res = await fetch(`${HEYGEN_BASE}/v3/voices/speech`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.error?.message || body?.message || `HTTP ${res.status}`;
    throw new Error(`HeyGen TTS lỗi: ${detail}`);
  }

  const data = body?.data;
  if (!data?.audio_url) throw new Error(`HeyGen không trả về audio_url. Response: ${JSON.stringify(body)}`);
  return { audioUrl: data.audio_url, duration: data.duration, wordTimestamps: data.word_timestamps || [] };
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải audio thất bại: HTTP ${res.status}`);
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
  const [voiceId, filePathArg] = process.argv.slice(2);
  if (!voiceId) {
    console.error(
      'Cần truyền voice_id đã clone. Ví dụ: node scripts/generate_video_noface_heygen.js <voice_id>\n' +
      'Chưa clone voice? Chạy scripts/clone_voice.js trước.'
    );
    process.exit(1);
  }

  const apiKey = loadEnvVar("HEYGEN_API_KEY");
  const scriptFile = filePathArg ? path.resolve(filePathArg) : findLatestScriptFile();
  const scriptData = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
  const scriptText = scriptData.script;
  if (!scriptText) throw new Error(`File ${scriptFile} không có trường "script".`);

  const outDir = path.join(__dirname, "..", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const timestamp = Date.now();
  const audioPath = path.join(outDir, `noface_heygen_${timestamp}.mp3`);
  const captionsPath = path.join(outDir, `noface_heygen_${timestamp}.ass`);
  const videoPath = path.join(outDir, `noface_heygen_${timestamp}.mp4`);

  console.log(`Đang tạo giọng đọc bằng HeyGen (voice_id=${voiceId}) cho kịch bản ngách "${scriptData.niche || "?"}"...`);
  const { audioUrl, wordTimestamps } = await textToSpeechHeyGen(apiKey, scriptText, voiceId);

  console.log("Đang tải audio về máy...");
  await downloadFile(audioUrl, audioPath);
  const duration = getAudioDuration(audioPath);
  console.log(`Đã tạo audio, thời lượng ${duration.toFixed(1)}s, ${wordTimestamps.length} từ có timestamp thật.`);

  console.log("Đang dựng phụ đề theo timestamp thật (không ước lượng)...");
  const ass = buildAssCaptionsFromTimestamps(scriptText, wordTimestamps, DIMENSION.width, DIMENSION.height);
  fs.writeFileSync(captionsPath, ass, "utf8");

  console.log("Đang ghép video (nền + phụ đề + audio) bằng ffmpeg...");
  assembleVideo({ audioPath, captionsPath, duration, outPath: videoPath });

  const metaPath = path.join(outDir, `noface_heygen_${timestamp}.json`);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        mode: "no-face",
        tts_provider: "heygen",
        voice_id: voiceId,
        source_script_file: scriptFile,
        audio_path: audioPath,
        captions_path: captionsPath,
        video_path: videoPath,
        duration_seconds: duration,
        word_timestamp_count: wordTimestamps.length,
        generated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`\nĐã lưu video no-face (giọng clone HeyGen) tại: ${videoPath}`);
  console.log(`Metadata: ${metaPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
