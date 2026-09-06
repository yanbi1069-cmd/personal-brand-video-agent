// Tìm video YouTube đang có view cao theo từ khóa/ngách, dùng Apify actor grow_media/youtube-search-api.
// Sau đó lấy transcript thật cho từng video bằng Apify actor inexhaustible_glass/youtube-transcript-extractor.
// (Đã thử obsequious_ontologist/youtube-transcript-extractor trước đó nhưng actor này dùng yt-dlp và
// bị YouTube chặn với lỗi "Sign in to confirm you're not a bot" — đổi sang actor này vì lấy được transcript thật.)
// Usage: node scripts/search_youtube.js "<từ khóa>" [số lượng]

const fs = require("fs");
const path = require("path");

function loadApifyToken() {
  const envPath = path.join(__dirname, "..", ".env");
  const content = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "");
  const match = content.match(/APIFY_TOKEN=(.+)/);
  if (!match) throw new Error("APIFY_TOKEN không có trong .env");
  return match[1].trim();
}

async function searchYoutube(token, keyword, maxResults) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/grow_media~youtube-search-api/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: keyword, maxResults, order: "viewCount" }),
    }
  );
  if (!res.ok) throw new Error(`Apify actor tìm kiếm lỗi: HTTP ${res.status}`);
  const items = await res.json();

  return items.map((it) => ({
    platform: "youtube",
    url: it.url,
    caption: it.title,
    engagement: {
      views: it.viewCount ?? null,
      likes: it.likes ?? null,
      shares: null, // YouTube Data API không trả về số lượt share
    },
    posted_date: it.date ?? null,
    transcript: null, // sẽ được điền ở fetchTranscripts(), nếu actor lấy được
  }));
}

// Gọi actor transcript theo lô (batch) cho toàn bộ URL tìm được trong 1 lần gọi API,
// thay vì gọi riêng từng video — nhanh hơn và tốn ít quota hơn.
async function fetchTranscripts(token, results) {
  const urls = results.map((r) => r.url).filter(Boolean);
  if (urls.length === 0) return results;

  let transcriptItems;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/inexhaustible_glass~youtube-transcript-extractor/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, language: "vi" }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail = body?.error?.message || `HTTP ${res.status}`;
      throw new Error(detail);
    }
    transcriptItems = await res.json();
  } catch (err) {
    console.warn(`Cảnh báo: actor transcript lỗi (${err.message}) — giữ transcript = null cho toàn bộ kết quả.`);
    return results;
  }

  const byUrl = new Map(transcriptItems.map((t) => [t.url, t]));

  return results.map((r) => {
    const t = byUrl.get(r.url);
    if (t && t.transcript) {
      return { ...r, transcript: t.transcript };
    }
    // Giữ transcript = null nếu video đó không có caption/transcript khả dụng —
    // đây là giới hạn đã biết, không phải lỗi (video không có phụ đề nào).
    return r;
  });
}

async function main() {
  const keyword = process.argv[2];
  const maxResults = parseInt(process.argv[3] || "8", 10);
  if (!keyword) {
    console.error('Cần truyền từ khóa. Ví dụ: node scripts/search_youtube.js "AI công nghệ" 8');
    process.exit(1);
  }

  const token = loadApifyToken();
  const searchResults = await searchYoutube(token, keyword, maxResults);
  const results = await fetchTranscripts(token, searchResults);

  const outDir = path.join(__dirname, "..", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `youtube_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), "utf8");

  const withTranscript = results.filter((r) => r.transcript).length;
  console.log(`Đã lưu ${results.length} kết quả vào ${outFile} (${withTranscript}/${results.length} có transcript thật)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
