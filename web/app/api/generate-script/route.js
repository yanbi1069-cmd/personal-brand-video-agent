import { NextResponse } from "next/server";
import { generateScript } from "@/lib/kyma";
import { REFERENCE_VIDEOS } from "@/lib/reference-videos";

// Chạy trên server (Node runtime của Vercel) — KYMA_API_KEY chỉ đọc từ biến môi trường
// phía server, KHÔNG BAO GIỜ gửi xuống trình duyệt (đúng nguyên tắc bảo mật đã học buổi 5).
export const runtime = "nodejs";

// Giới hạn độ dài để tránh lạm dụng (prompt injection / spam chi phí Kyma qua endpoint công khai).
const MAX_NICHE_LENGTH = 80;

export async function POST(request) {
  const apiKey = process.env.KYMA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server chưa cấu hình KYMA_API_KEY (biến môi trường)." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const niche = (body?.niche || "").trim();
  if (!niche) {
    return NextResponse.json({ error: "Thiếu ngách/ngành hàng." }, { status: 400 });
  }
  if (niche.length > MAX_NICHE_LENGTH) {
    return NextResponse.json({ error: `Ngách quá dài (tối đa ${MAX_NICHE_LENGTH} ký tự).` }, { status: 400 });
  }

  const video = REFERENCE_VIDEOS[niche] || null;

  try {
    const result = await generateScript(apiKey, niche, video);
    return NextResponse.json({
      niche,
      usedReferenceVideo: Boolean(video),
      ...result,
    });
  } catch (err) {
    return NextResponse.json({ error: `Kyma API lỗi: ${err.message}` }, { status: 502 });
  }
}
