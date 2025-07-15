import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import OpenAIKeyDialog from "../components/OpenAIKeyDialog";
import ImportExportDialog from "../components/ImportExportDialog";
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
  title: "Annotator",
  description: "Minimalist PDF annotation tool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}
      >
        {/* Top navigation */}
        <nav className="border-b border-gray-200 bg-white w-full">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Brand */}
            <Link href="/" className="text-xl font-semibold tracking-tight">
              Annotator
            </Link>

            {/* Menu */}
            <div className="flex gap-6 text-sm font-medium">
              <Link href="/annotate" className="text-gray-700 hover:text-blue-600">
                Annotate
              </Link>
              <Link href="/objects" className="text-gray-700 hover:text-blue-600">
                Objects
              </Link>
              <ImportExportDialog />
              <OpenAIKeyDialog />
            </div>
          </div>
        </nav>

        {/* Page content */}
        <div className="w-full px-6 py-8">{children}</div>
      </body>
    </html>
  );
}
