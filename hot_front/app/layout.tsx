import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider, SignIn, SignedIn, SignedOut } from "@clerk/nextjs"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Volunteer Portal",
  description: "Senior Care Volunteer Management System",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      appearance={{
        cssLayerName: "clerk",
      }}
    >
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
          <SignedOut>
            <div className="flex items-center justify-center min-h-screen">
              <div className="w-full max-w-md">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-gray-900">Volunteer Portal</h1>
                  <p className="text-gray-600 mt-2">Sign in to manage your schedule</p>
                </div>
                <SignIn
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: "mx-auto",
                      card: "shadow-lg",
                    },
                  }}
                />
              </div>
            </div>
          </SignedOut>

          <SignedIn>{children}</SignedIn>
        </body>
      </html>
    </ClerkProvider>
  )
}
