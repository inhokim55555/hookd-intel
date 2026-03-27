import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'Hookd Intel',
  description: 'Ad intelligence powered by Claude AI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-base text-zinc-100 min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-0 lg:ml-60 min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  )
}
