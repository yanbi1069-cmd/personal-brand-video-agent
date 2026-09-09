import "./globals.css";

export const metadata = {
  title: "Personal Brand Video Agent — Script Writer",
  description: "Sinh kịch bản video xây dựng thương hiệu cá nhân bằng AI, theo ngành.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
