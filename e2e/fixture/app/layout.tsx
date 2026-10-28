import Link from "next/link";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Home</Link> <Link href="/lazy">Lazy page</Link>{" "}
          <Link href="/plain">Plain page</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
