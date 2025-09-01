"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

interface MapProps {
  seniors: Array<{
    uid: string
    name: string
    coords: { lat: number; lng: number }
    last_visit: string
  }>
  volunteers: Array<{
    vid: string
    name: string
    coords: { lat: number; lng: number }
    available: boolean | string[]
  }>
  assignments: Array<{
    volunteer: string
    cluster: string
    distance: number
  }>
  schedules: Array<{
    volunteer: string
    cluster: string
    datetime: string
    duration: number
  }>
}

export function InteractiveMap({ seniors, volunteers, assignments, schedules }: MapProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)

  // Singapore bounds
  const SINGAPORE_BOUNDS = {
    minLat: 1.16,
    maxLat: 1.47,
    minLng: 103.6,
    maxLng: 104.0,
  }

  // Convert lat/lng to SVG coordinates
  const coordsToSVG = (lat: number, lng: number) => {
    const x = ((lng - SINGAPORE_BOUNDS.minLng) / (SINGAPORE_BOUNDS.maxLng - SINGAPORE_BOUNDS.minLng)) * 800
    const y = ((SINGAPORE_BOUNDS.maxLat - lat) / (SINGAPORE_BOUNDS.maxLat - SINGAPORE_BOUNDS.minLat)) * 600
    return { x, y }
  }

  // Group seniors by clusters (simplified clustering)
  const clusters = useMemo(() => {
    const clusterMap = new Map<
      string,
      {
        id: string
        center: { lat: number; lng: number }
        seniors: typeof seniors
        volunteers: typeof volunteers
        activeSchedules: number
      }
    >()

    // Create clusters based on assignments
    assignments.forEach((assignment) => {
      if (!clusterMap.has(assignment.cluster)) {
        clusterMap.set(assignment.cluster, {
          id: assignment.cluster,
          center: { lat: 1.3, lng: 103.8 }, // Default center
          seniors: [],
          volunteers: [],
          activeSchedules: 0,
        })
      }
    })

    // Assign seniors to nearest clusters
    seniors.forEach((senior) => {
      const nearestCluster = Array.from(clusterMap.keys())[Math.floor(Math.random() * clusterMap.size)]
      if (nearestCluster) {
        const cluster = clusterMap.get(nearestCluster)!
        cluster.seniors.push(senior)

        // Update cluster center based on seniors
        if (cluster.seniors.length === 1) {
          cluster.center = senior.coords
        } else {
          cluster.center = {
            lat: (cluster.center.lat + senior.coords.lat) / 2,
            lng: (cluster.center.lng + senior.coords.lng) / 2,
          }
        }
      }
    })

    // Assign volunteers to clusters
    volunteers.forEach((volunteer) => {
      const assignment = assignments.find((a) => a.volunteer === volunteer.vid)
      if (assignment) {
        const cluster = clusterMap.get(assignment.cluster)
        if (cluster) {
          cluster.volunteers.push(volunteer)
        }
      }
    })

    // Count active schedules
    schedules.forEach((schedule) => {
      const today = new Date().toDateString()
      const scheduleDate = new Date(schedule.datetime).toDateString()
      if (scheduleDate === today) {
        const cluster = clusterMap.get(schedule.cluster)
        if (cluster) {
          cluster.activeSchedules++
        }
      }
    })

    return Array.from(clusterMap.values())
  }, [seniors, volunteers, assignments, schedules])

  // Calculate heatmap intensity based on unvisited seniors
  const getHeatmapIntensity = (senior: (typeof seniors)[0]) => {
    const lastVisit = new Date(senior.last_visit)
    const now = new Date()
    const daysSinceVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceVisit > 365) return 1 // High intensity - not visited in a year
    if (daysSinceVisit > 180) return 0.7 // Medium-high intensity
    if (daysSinceVisit > 90) return 0.4 // Medium intensity
    return 0.1 // Low intensity
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.5))
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setSelectedCluster(null)
  }

  return (
    <div className="relative">
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button size="sm" variant="outline" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Container */}
      <div className="relative overflow-hidden rounded-lg border bg-muted/20">
        <svg
          width="100%"
          height="400"
          viewBox="0 0 800 600"
          className="cursor-move"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: "center",
          }}
        >
          {/* Background */}
          <rect width="800" height="600" fill="hsl(var(--muted))" />

          {/* Singapore outline (simplified) */}
          <path
            d="M100 300 Q200 250 400 280 Q600 300 700 320 Q650 400 500 450 Q300 480 150 420 Q80 380 100 300"
            fill="hsl(var(--background))"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />

          {/* Heatmap - Unvisited seniors */}
          {seniors.map((senior, index) => {
            const { x, y } = coordsToSVG(senior.coords.lat, senior.coords.lng)
            const intensity = getHeatmapIntensity(senior)
            return (
              <circle
                key={`heatmap-${index}`}
                cx={x}
                cy={y}
                r={8 + intensity * 12}
                fill={`rgba(239, 68, 68, ${intensity * 0.6})`}
                className="pointer-events-none"
              />
            )
          })}

          {/* Senior locations */}
          {seniors.map((senior, index) => {
            const { x, y } = coordsToSVG(senior.coords.lat, senior.coords.lng)
            return (
              <circle
                key={`senior-${index}`}
                cx={x}
                cy={y}
                r="3"
                fill="hsl(var(--chart-1))"
                stroke="white"
                strokeWidth="1"
                className="cursor-pointer hover:r-4 transition-all"
                title={`Senior: ${senior.name}`}
              />
            )
          })}

          {/* Cluster centers */}
          {clusters.map((cluster, index) => {
            const { x, y } = coordsToSVG(cluster.center.lat, cluster.center.lng)
            const isSelected = selectedCluster === cluster.id
            return (
              <g key={`cluster-${index}`}>
                {/* Cluster area */}
                <circle
                  cx={x}
                  cy={y}
                  r="40"
                  fill={isSelected ? "hsl(var(--primary))" : "hsl(var(--chart-2))"}
                  fillOpacity="0.2"
                  stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--chart-2))"}
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  className="cursor-pointer"
                  onClick={() => setSelectedCluster(isSelected ? null : cluster.id)}
                />

                {/* Cluster center marker */}
                <circle
                  cx={x}
                  cy={y}
                  r="8"
                  fill={isSelected ? "hsl(var(--primary))" : "hsl(var(--chart-2))"}
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer"
                  onClick={() => setSelectedCluster(isSelected ? null : cluster.id)}
                />

                {/* Cluster label */}
                <text
                  x={x}
                  y={y - 50}
                  textAnchor="middle"
                  className="fill-foreground text-xs font-medium"
                  style={{ fontSize: "12px" }}
                >
                  {cluster.id}
                </text>

                {/* Stats */}
                <text
                  x={x}
                  y={y + 60}
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs"
                  style={{ fontSize: "10px" }}
                >
                  {cluster.seniors.length} seniors, {cluster.volunteers.length} volunteers
                </text>
              </g>
            )
          })}

          {/* Active volunteer locations */}
          {volunteers
            .filter((v) => v.available)
            .map((volunteer, index) => {
              const { x, y } = coordsToSVG(volunteer.coords.lat, volunteer.coords.lng)
              return (
                <g key={`volunteer-${index}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill="hsl(var(--chart-4))"
                    stroke="white"
                    strokeWidth="2"
                    className="cursor-pointer"
                    title={`Volunteer: ${volunteer.name}`}
                  />
                  {/* Activity indicator */}
                  <circle cx={x + 8} cy={y - 8} r="3" fill="hsl(var(--chart-5))" className="animate-pulse" />
                </g>
              )
            })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-chart-1"></div>
          <span>Seniors</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-chart-4"></div>
          <span>Active Volunteers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-chart-2 opacity-50"></div>
          <span>Volunteer Clusters</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 opacity-60"></div>
          <span>Unvisited Areas (Heatmap)</span>
        </div>
      </div>

      {/* Cluster Details Panel */}
      {selectedCluster && (
        <Card className="mt-4">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Cluster: {selectedCluster}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCluster(null)}>
                ×
              </Button>
            </div>
            {clusters
              .filter((c) => c.id === selectedCluster)
              .map((cluster) => (
                <div key={cluster.id} className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium">{cluster.seniors.length}</p>
                      <p className="text-muted-foreground">Seniors</p>
                    </div>
                    <div>
                      <p className="font-medium">{cluster.volunteers.length}</p>
                      <p className="text-muted-foreground">Volunteers</p>
                    </div>
                    <div>
                      <p className="font-medium">{cluster.activeSchedules}</p>
                      <p className="text-muted-foreground">Today's Visits</p>
                    </div>
                  </div>

                  {cluster.volunteers.length > 0 && (
                    <div>
                      <p className="font-medium mb-2">Assigned Volunteers:</p>
                      <div className="flex flex-wrap gap-2">
                        {cluster.volunteers.map((vol, idx) => (
                          <Badge key={idx} variant="secondary">
                            {vol.name || vol.vid}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
