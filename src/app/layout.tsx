import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FormsProvider } from "@/lib/forms-store";
import { EntriesProvider } from "@/lib/entries-store";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TericVoice — Voice-to-Form",
  description: "Voice-based form data collection and entry management.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla)
          inject attributes like cz-shortcut-listen onto <body> before React
          hydrates, which otherwise trips a false-positive hydration
          mismatch warning on every page — this is the standard, React-
          recommended way to silence that specific class of noise without
          hiding real hydration bugs elsewhere in the tree. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <TooltipProvider delayDuration={200}>
          <FormsProvider>
            <EntriesProvider>{children}</EntriesProvider>
          </FormsProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
