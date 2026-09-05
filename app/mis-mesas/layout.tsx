import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mis Mesas",
  description: "Panel de control y acceso a todas tus mesas de D&D guardadas.",
};

export default function MisMesasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
