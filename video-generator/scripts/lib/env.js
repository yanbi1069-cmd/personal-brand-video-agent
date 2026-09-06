const fs = require("fs");
const path = require("path");

// Đọc 1 biến từ file .env ở thư mục gốc project (ngang hàng với scripts/).
function loadEnvVar(name, { root = path.join(__dirname, "..", "..") } = {}) {
  const envPath = path.join(root, ".env");
  const content = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "");
  const match = content.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) throw new Error(`${name} không có trong ${envPath}`);
  return match[1].trim();
}

module.exports = { loadEnvVar };
