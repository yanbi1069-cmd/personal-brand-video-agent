// Bước 4 — Edit hậu kỳ: thay nền video gốc (no-face) bằng B-roll thật theo đúng ngành hàng
// (ảnh + video, gộp cả Pexels và Pixabay để đa dạng), hiệu ứng Ken Burns cho ảnh tĩnh,
// phối màu phụ đề theo ngành, và trộn nhạc nền cục bộ (nếu có) dưới giọng đọc gốc.
// Thiết kế data-driven: thêm ngành mới chỉ cần thêm entry vào industry-profiles.json.
// Usage: node scripts/edit_video.js <industry> [file-metadata-noface.json]

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadEnvVar } = require("./lib/env");

const VIDEO_GENERATOR_OUTPUT_DIR = path.join(__dirname, "..", "..", "video-generator", "output");
const PROFILES_PATH = path.join(__dirname, "..", "industry-profiles.json");
const MUSIC_DIR = path.join(__dirname, "..", "assets", "music");
const DIMENSION = { width: 720, height: 1280 };
const TMP_DIR = path.join(__dirname, "..", "output", "tmp");
const MAX_BROLL_CLIPS = 6;
const VIDEO_SEGMENT_SECONDS = 6;
const IMAGE_SEGMENT_SECONDS = 5;
const MUSIC_VOLUME = 0.12; // nhạc nền nhỏ, không át giọng đọc

function loadProfiles() {
  return JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
}

function findLatestNofaceMeta() {
  const files = fs
    .readdirSync(VIDEO_GENERATOR_OUTPUT_DIR)
    .filter((f) => f.startsWith("noface_") && f.endsWith(".json"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(VIDEO_GENERATOR_OUTPUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error(
      `Không tìm thấy metadata video no-face nào trong ${VIDEO_GENERATOR_OUTPUT_DIR}. Hãy chạy video-generator (nhánh no-face) trước.`
    );
  }
  return path.join(VIDEO_GENERATOR_OUTPUT_DIR, files[0].f);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Tìm B-roll từ 4 nguồn: Pexels video/ảnh, Pixabay video/ảnh ----------

async function searchPexelsVideos(apiKey, query, count) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.videos || [])
    .map((v) => {
      const files = [...(v.video_files || [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
      const pick = files.find((f) => (f.width ?? 0) >= 640) || files[files.length - 1];
      return pick ? { type: "video", source: "pexels", url: pick.link, refId: v.id } : null;
    })
    .filter(Boolean);
}

async function searchPexelsPhotos(apiKey, query, count) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.photos || []).map((p) => ({
    type: "image",
    source: "pexels",
    url: p.src.portrait || p.src.large,
    refId: p.id,
  }));
}

async function searchPixabayVideos(apiKey, query, count) {
  const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${Math.max(count, 3)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.hits || [])
    .map((h) => {
      const v = h.videos?.medium?.url || h.videos?.small?.url || h.videos?.large?.url;
      return v ? { type: "video", source: "pixabay", url: v, refId: h.id } : null;
    })
    .filter(Boolean);
}

async function searchPixabayPhotos(apiKey, query, count) {
  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${Math.max(count, 3)}&orientation=vertical`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.hits || []).map((h) => ({ type: "image", source: "pixabay", url: h.largeImageURL, refId: h.id }));
}

async function collectBrollPool(keywords, pexelsKey, pixabayKey) {
  const pool = [];
  for (const kw of keywords) {
    const [pv, pp, xv, xp] = await Promise.all([
      searchPexelsVideos(pexelsKey, kw, 2),
      searchPexelsPhotos(pexelsKey, kw, 2),
      searchPixabayVideos(pixabayKey, kw, 3),
      searchPixabayPhotos(pixabayKey, kw, 3),
    ]);
    pool.push(...pv, ...pp, ...xv, ...xp);
  }
  return pool;
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải B-roll thất bại: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

// ---------- Chuẩn hoá thành clip 720x1280 ----------

function normalizeVideoClip(inputPath, outputPath) {
  execFileSync("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-t", String(VIDEO_SEGMENT_SECONDS),
    "-vf", `scale=${DIMENSION.width}:${DIMENSION.height}:force_original_aspect_ratio=increase,crop=${DIMENSION.width}:${DIMENSION.height},fps=25`,
    "-an",
    "-c:v", "libx264",
    outputPath,
  ]);
}

// Ảnh tĩnh -> clip có hiệu ứng zoom nhẹ (Ken Burns) để không bị cảm giác slideshow đứng hình.
function imageToZoomClip(inputPath, outputPath) {
  const frames = IMAGE_SEGMENT_SECONDS * 25;
  const w2 = DIMENSION.width * 2;
  const h2 = DIMENSION.height * 2;
  execFileSync("ffmpeg", [
    "-y",
    "-loop", "1",
    "-i", inputPath,
    "-vf",
    `scale=${w2}:${h2}:force_original_aspect_ratio=increase,crop=${w2}:${h2},` +
      `zoompan=z='min(zoom+0.0012,1.3)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${DIMENSION.width}x${DIMENSION.height}:fps=25`,
    "-t", String(IMAGE_SEGMENT_SECONDS),
    "-c:v", "libx264",
    outputPath,
  ]);
}

function getDuration(filePath) {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]).toString().trim();
  return parseFloat(out);
}

function concatAndLoopToDuration(clipPaths, targetDuration, outputPath) {
  const listPath = path.join(TMP_DIR, "concat_list.txt");
  fs.writeFileSync(listPath, clipPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"), "utf8");

  const concatPath = path.join(TMP_DIR, "concat_raw.mp4");
  execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concatPath]);

  const concatDuration = getDuration(concatPath);
  const loopsNeeded = Math.max(1, Math.ceil(targetDuration / concatDuration));

  execFileSync("ffmpeg", [
    "-y",
    "-stream_loop", String(loopsNeeded - 1),
    "-i", concatPath,
    "-t", String(targetDuration),
    "-c", "copy",
    outputPath,
  ]);
}

// ---------- Nhạc nền cục bộ (không có API nhạc miễn phí chính thức) ----------

function pickRandomMusic(industry) {
  const dir = path.join(MUSIC_DIR, industry);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /\.(mp3|wav|m4a)$/i.test(f));
  if (files.length === 0) return null;
  return path.join(dir, files[Math.floor(Math.random() * files.length)]);
}

function mixNarrationWithMusic(narrationPath, musicPath, narrationDuration, outPath) {
  execFileSync("ffmpeg", [
    "-y",
    "-i", narrationPath,
    "-stream_loop", "-1",
    "-i", musicPath,
    "-filter_complex",
    `[1:a]volume=${MUSIC_VOLUME}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
    "-map", "[aout]",
    "-t", String(narrationDuration),
    outPath,
  ]);
}

// ---------- Ghép cuối ----------

function assembleFinal({ broll_bg, audioPath, captionsPath, outPath }) {
  const args = ["-y", "-i", broll_bg, "-i", audioPath];
  let vf = null;
  if (captionsPath && fs.existsSync(captionsPath)) {
    // File .ass đã tự khai báo đúng PlayResX/Y + style (nền đen mờ, chữ trắng, sát đáy) —
    // không cần force_style/original_size ở đây nữa.
    const captionsFilter = captionsPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    vf = `subtitles='${captionsFilter}'`;
  }
  if (vf) args.push("-vf", vf);
  args.push("-c:v", "libx264", "-c:a", "aac", "-shortest", outPath);
  execFileSync("ffmpeg", args);
}

async function main() {
  const industry = process.argv[2];
  const metaPathArg = process.argv[3];

  const profiles = loadProfiles();
  if (!industry || !profiles[industry]) {
    console.error(
      `Cần truyền tên ngành hợp lệ. Ví dụ: node scripts/edit_video.js spa\nCác ngành có sẵn: ${Object.keys(profiles).join(", ")}`
    );
    process.exit(1);
  }
  const profile = profiles[industry];

  const pexelsKey = loadEnvVar("PEXELS_API_KEY");
  const pixabayKey = loadEnvVar("PIXABAY_API_KEY");
  const metaPath = metaPathArg ? path.resolve(metaPathArg) : findLatestNofaceMeta();
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const targetDuration = meta.duration_seconds;

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const outDir = path.join(__dirname, "..", "output");
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Ngành: ${profile.label}. Đang tìm B-roll (Pexels + Pixabay, ảnh + video)...`);
  const pool = shuffle(await collectBrollPool(profile.broll_keywords, pexelsKey, pixabayKey));
  if (pool.length === 0) {
    throw new Error("Không tìm được B-roll nào từ Pexels/Pixabay cho ngành này — kiểm tra lại API key.");
  }
  const chosen = pool.slice(0, MAX_BROLL_CLIPS);
  console.log(`Chọn ngẫu nhiên ${chosen.length}/${pool.length} B-roll (${chosen.filter((c) => c.type === "video").length} video, ${chosen.filter((c) => c.type === "image").length} ảnh) từ nguồn: ${[...new Set(chosen.map((c) => c.source))].join(", ")}.`);

  const normalizedClips = [];
  const brollSources = [];
  for (const [i, item] of chosen.entries()) {
    const rawExt = item.type === "video" ? "mp4" : "jpg";
    const rawPath = path.join(TMP_DIR, `raw_${i}.${rawExt}`);
    const normPath = path.join(TMP_DIR, `norm_${i}.mp4`);
    console.log(`Tải ${item.type === "video" ? "video" : "ảnh"} từ ${item.source} (id=${item.refId})...`);
    await downloadFile(item.url, rawPath);
    if (item.type === "video") normalizeVideoClip(rawPath, normPath);
    else imageToZoomClip(rawPath, normPath);
    normalizedClips.push(normPath);
    brollSources.push({ type: item.type, source: item.source, ref_id: item.refId });
  }

  const brollBgPath = path.join(TMP_DIR, "broll_bg.mp4");
  console.log(`Đang ghép ${normalizedClips.length} clip B-roll, lặp/cắt cho khớp ${targetDuration.toFixed(1)}s...`);
  concatAndLoopToDuration(normalizedClips, targetDuration, brollBgPath);

  const musicPath = pickRandomMusic(industry);
  let audioForFinal = meta.audio_path;
  if (musicPath) {
    console.log(`Tìm thấy nhạc nền cục bộ: ${path.basename(musicPath)}. Đang trộn với giọng đọc...`);
    audioForFinal = path.join(TMP_DIR, "mixed_audio.mp3");
    mixNarrationWithMusic(meta.audio_path, musicPath, targetDuration, audioForFinal);
  } else {
    console.log(`Không có nhạc nền cục bộ cho ngành "${industry}" (thư mục assets/music/${industry}/ trống hoặc chưa có file) — dùng audio gốc.`);
  }

  const timestamp = Date.now();
  const finalPath = path.join(outDir, `final_${industry}_${timestamp}.mp4`);

  console.log("Đang ghép B-roll + phụ đề trắng + audio...");
  assembleFinal({
    broll_bg: brollBgPath,
    audioPath: audioForFinal,
    captionsPath: meta.captions_path,
    outPath: finalPath,
  });

  const metaOutPath = path.join(outDir, `final_${industry}_${timestamp}.json`);
  fs.writeFileSync(
    metaOutPath,
    JSON.stringify(
      {
        industry,
        industry_label: profile.label,
        broll_sources: brollSources,
        music_used: musicPath ? path.basename(musicPath) : null,
        source_noface_meta: metaPath,
        final_video_path: finalPath,
        generated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`\nĐã lưu video hoàn thiện tại: ${finalPath}`);
  console.log(`Metadata: ${metaOutPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
