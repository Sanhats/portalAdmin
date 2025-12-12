import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ecommerce Backend API",
  description: "Backend API para sistema de ecommerce",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

