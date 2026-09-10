"use client";

import { useState } from "react";

const PRESETS = ["spa thẩm mỹ chăm sóc da", "bất động sản", "coach / chuyên gia"];

export default function Home() {
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!niche.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTestEmail(e) {
    e.preventDefault();
    if (!email.trim() || emailLoading) return;
    setEmailLoading(true);
    setEmailError("");
    setEmailSent(false);
    try {
      const res = await fetch("/api/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra.");
      setEmailSent(true);
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <main className="page">
      <h1 className="title">🎬 Personal Brand Video Agent</h1>
      <p className="subtitle">
        Nhập ngành/ngách của bạn, AI sẽ viết 1 kịch bản video ngắn hoàn toàn mới (Hook / Nội dung / CTA)
        để bạn dùng dựng video xây dựng thương hiệu cá nhân.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            type="text"
            placeholder="VD: spa thẩm mỹ chăm sóc da"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            maxLength={80}
          />
          <button type="submit" disabled={loading || !niche.trim()}>
            {loading ? (
              <>
                <span className="spinner" />
                Đang viết...
              </>
            ) : (
              "Sinh kịch bản"
            )}
          </button>
        </div>
      </form>

      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p} type="button" className="preset-chip" onClick={() => setNiche(p)}>
            {p}
          </button>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="result">
          <div className="card">
            <p className="card-label">Hook</p>
            <p className="card-text">{result.sections.hook || "(trống)"}</p>
          </div>
          <div className="card">
            <p className="card-label">Nội dung</p>
            <p className="card-text">{result.sections.noidung || "(trống)"}</p>
          </div>
          <div className="card">
            <p className="card-label">CTA</p>
            <p className="card-text">{result.sections.cta || "(trống)"}</p>
          </div>
          <p className="meta">
            Model: {result.model} · {result.usedReferenceVideo ? "Có video tham chiếu thật" : "Không có video tham chiếu"}
          </p>
        </div>
      )}

      <hr className="divider" />

      <h2 className="section-title">📧 Test email tự động</h2>
      <p className="subtitle">
        Nhập đúng email bạn dùng để đăng ký tài khoản Resend (chế độ sandbox chỉ gửi được tới địa chỉ đó).
      </p>
      <form onSubmit={handleSendTestEmail}>
        <div className="form-row">
          <input
            type="email"
            placeholder="email@vidu.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={emailLoading || !email.trim()}>
            {emailLoading ? (
              <>
                <span className="spinner" />
                Đang gửi...
              </>
            ) : (
              "Gửi email test"
            )}
          </button>
        </div>
      </form>
      {emailError && <div className="error-box">{emailError}</div>}
      {emailSent && <div className="success-box">Đã gửi! Kiểm tra hộp thư (kể cả Spam/Promotions).</div>}
    </main>
  );
}
