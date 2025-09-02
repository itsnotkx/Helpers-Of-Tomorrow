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
  usingMockData: boolean
  onTryConnectApi: () => void
  onRefresh: () => void
}

export function DashboardHeader({
  title,
  subtitle,
  selectedDistrict,
  usingMockData,
  onTryConnectApi,
  onRefresh,
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
              {usingMockData && (
                <Badge variant="outline" className="mt-2 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Demo Mode - Using sample data
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              <MapPin className="h-3 w-3 mr-1" />
              {selectedDistrict}
            </Badge>
            {usingMockData ? (
              <Button onClick={onTryConnectApi} variant="outline" size="sm">
                <Activity className="h-4 w-4 mr-2" />
                Try Connect API
              </Button>
            ) : (
              <Button onClick={onRefresh} variant="outline" size="sm">
                <Activity className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
            <UserButton showName />
          </div>
        </div>
      </div>
    </header>
  )
}
