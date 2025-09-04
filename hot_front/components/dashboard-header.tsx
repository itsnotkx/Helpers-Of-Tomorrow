"use client"

import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, AlertTriangle, Activity } from "lucide-react"
import { UserButton } from "@clerk/nextjs"

interface DashboardHeaderProps {
  title: string
  subtitle: string
  selectedDistrict: string
  needButton: boolean
  textToInput?: string
  onRefresh?: () => void
  onShowHighPriority?: () => void
}

export function DashboardHeader({
  title,
  subtitle,
  selectedDistrict,
  needButton,
  textToInput,
  onRefresh,
  onShowHighPriority,
}: DashboardHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/hotlogo.png" alt="Helpers of Tomorrow Logo" width={64} height={64} />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              <MapPin className="h-3 w-3 mr-1" />
              {selectedDistrict}
            </Badge>
            {needButton ? (
              <Button onClick={onRefresh} variant="outline" size="sm">
                <Activity className="h-4 w-4 mr-2" />
                {textToInput}
              </Button>
            ) : (
              <div></div>
            )}
            <UserButton showName />
          </div>
        </div>
        {onShowHighPriority && (
          <div className="flex justify-between items-center mb-6">
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
