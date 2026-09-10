import { NextResponse } from "next/server";

// Gửi email test qua Resend — dùng domain sandbox mặc định của Resend
// (onboarding@resend.dev), không cần verify domain riêng. Ở chế độ sandbox,
// Resend CHỈ cho gửi tới đúng email bạn dùng đăng ký tài khoản Resend.
export const runtime = "nodejs";

export async function POST(request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server chưa cấu hình RESEND_API_KEY (biến môi trường)." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const email = (body?.email || "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Thiếu hoặc sai định dạng email." }, { status: 400 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Personal Brand Video Agent <onboarding@resend.dev>",
      to: [email],
      subject: "Test email tự động — Personal Brand Video Agent",
      html: `<p>Đây là email test xác nhận hệ thống email tự động (Resend) đã hoạt động đúng.</p>
             <p>Gửi từ sản phẩm <strong>Personal Brand Video Agent</strong> — dự án khoá học Build To Own, Buổi 5.</p>`,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.message || `HTTP ${res.status}`;
    return NextResponse.json({ error: `Resend lỗi: ${detail}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
