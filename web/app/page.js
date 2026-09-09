"use client";

import { useState } from "react";

const PRESETS = ["spa thẩm mỹ chăm sóc da", "bất động sản", "coach / chuyên gia"];

export default function Home() {
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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
    </main>
  );
}
