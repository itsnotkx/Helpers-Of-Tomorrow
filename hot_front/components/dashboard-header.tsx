"use client"

import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { MapPin } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DashboardHeaderProps {
  title: string
  subtitle: string
  selectedDistrict: string
  onShowHighPriority?: () => void
  onDistrictChange: (district: "All" | "Jurong" | "Sembawang") => void
}

export function DashboardHeader({ title, subtitle, selectedDistrict, onShowHighPriority, onDistrictChange }: DashboardHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo + Title */}
          <div className="flex items-center gap-4">
            <Image src="/hotlogo.png" alt="Helpers of Tomorrow Logo" width={64} height={64} />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          {/* Right Side Controls */}
        <div className="flex items-center gap-6">
          <Select value={selectedDistrict} onValueChange={v => onDistrictChange(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Constituency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Jurong">Jurong</SelectItem>
              <SelectItem value="Sembawang">Sembawang</SelectItem>
            </SelectContent>
          </Select>

            <UserButton
              showName
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-12 h-12", // bigger avatar
                  userButtonOuterIdentifier: "text-lg font-semibold", // bigger name
                },
              }}
            />
          </div>
        </div>

        {/* Optional High Priority Banner */}
        {onShowHighPriority && (
          <div className="flex justify-between items-center mt-6">
            <h1 className="text-2xl font-bold">Senior Care Volunteer Dashboard</h1>
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              onClick={onShowHighPriority}
            >
              Show High Priority Seniors
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
