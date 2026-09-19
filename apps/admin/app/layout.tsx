import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hospital Hub",
  description: "Cổng nội bộ bệnh viện tích hợp Zalo",
  other: {
    "zalo-platform-site-verification":
      "USQxBAZj7mXmyim_yzf87JJ_c4BOYKCSCJCq",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
