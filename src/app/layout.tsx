import "~/styles/globals.css";

import { type Metadata } from "next";
import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Airtable clone",
  description: "An Airtable clone built with the T3 stack.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden">
        <TRPCReactProvider>
          {children}
          <Toaster richColors closeButton />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
