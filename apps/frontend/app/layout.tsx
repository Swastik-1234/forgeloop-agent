import type { Metadata } from "next";
import { Instrument_Sans, Indie_Flower } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import { QueryProvider } from "./providers/QueryProvider";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const indieFlower = Indie_Flower({
  variable: "--font-indie-flower",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Likeable - Build beautiful websites in a single prompt",
  description: "Learn smarter, faster, and more interactively with our custom AI model.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSans.variable} ${indieFlower.variable} antialiased`}
      >
        <QueryProvider>
          {/* <Header /> */}
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
