import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});
const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});
export const metadata = {
    title: "DropSphere — Private. Direct. Fast. P2P Local-Network Stream",
    description: "A high-speed, zero-cloud-cost, peer-to-peer encrypted local-network file and screen streaming web application using WebRTC DataChannel.",
};
export default function RootLayout({ children, }) {
    return (<html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-[#070a0f] text-[#f5f7fa]">{children}</body>
    </html>);
}
