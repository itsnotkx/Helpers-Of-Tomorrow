"use client"

import { useState, useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

// TypeScript interfaces matching the dashboard data
interface Senior {
  uid: string
  name: string
  coords: { lat: number; lng: number }
  physical: number
  mental: number
  community: number
  last_visit: string
}

interface Volunteer {
  vid: string
  name: string
  coords: { lat: number; lng: number }
  skill: number
  available: boolean | string[]
}

interface Assessment {
  uid: string
  risk: number
  priority: "HIGH" | "MEDIUM" | "LOW"
  needscare: boolean
}

interface Assignment {
  volunteer: string
  cluster: string
  distance: number
}

interface Schedule {
  volunteer: string
  cluster: string
  datetime: string
  duration: number
}

interface InteractiveMapProps {
  seniors: Senior[]
  volunteers: Volunteer[]
  assignments: Assignment[]
  schedules: Schedule[]
}

const priorityColors = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-green-500",
}

export function InteractiveMap({ seniors, volunteers, assignments, schedules }: InteractiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef = useRef<mapboxgl.Popup | null>(null)

  // Calculate assessments based on senior data
  const assessments: Assessment[] = seniors.map((senior) => {
    const totalScore = senior.physical + senior.mental + senior.community
    const risk = totalScore / 15 // Normalize to 0-1
    const priority = risk > 0.7 ? "HIGH" : risk > 0.4 ? "MEDIUM" : "LOW"

    return {
      uid: senior.uid,
      risk,
      priority,
      needscare: risk > 0.6,
    }
  })

  useEffect(() => {
    if (!mapContainer.current) return

    const mapboxToken =
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    mapboxgl.accessToken = mapboxToken

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [103.8198, 1.3521],
        zoom: 11,
      })

      map.current.on("load", () => {
        console.log("[v0] Map loaded successfully")
        setMapLoaded(true)
        addMarkers()
      })

      map.current.on("error", (error) => {
        console.error("[v0] Map error:", error)
        setMapError(error.message || "Failed to load map")
      })
    } catch (error) {
      console.error("[v0] Map initialization error:", error)
      setMapError("Failed to initialize map")
    }

    return () => {
      if (map.current) {
        map.current.remove()
      }
    }
  }, [])

  useEffect(() => {
    if (mapLoaded) {
      addMarkers()
    }
  }, [seniors, volunteers, mapLoaded])

  const addMarkers = () => {
    if (!map.current) return

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Add senior markers
    seniors.forEach((senior) => {
      const assessment = assessments.find((a) => a.uid === senior.uid)
      const priority = assessment?.priority || "LOW"
      const colorClass = priorityColors[priority]

      const markerEl = document.createElement("div")
      markerEl.className = `relative cursor-pointer shadow-lg`
      markerEl.style.width = "30px"
      markerEl.style.height = "40px"

      // Create the pin shape with CSS
      markerEl.innerHTML = `
        <div class="absolute inset-0">
          <div class="w-6 h-6 ${colorClass} rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold relative mx-auto">
            👤
          </div>
          <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[12px] ${colorClass.replace("bg-", "border-t-")} border-l-transparent border-r-transparent mx-auto"></div>
        </div>
      `

      // Create marker
      const marker = new mapboxgl.Marker(markerEl).setLngLat([senior.coords.lng, senior.coords.lat]).addTo(map.current!)

      // Add click handler
      markerEl.addEventListener("click", () => {
        showSeniorPopup(senior, assessment)
        map.current?.flyTo({
          center: [senior.coords.lng, senior.coords.lat],
          zoom: 15,
        })
      })

      markersRef.current.push(marker)
    })

    // Add volunteer markers
    volunteers.forEach((volunteer) => {
      const markerEl = document.createElement("div")
      markerEl.className = `relative cursor-pointer shadow-lg`
      markerEl.style.width = "24px"
      markerEl.style.height = "24px"

      markerEl.innerHTML = `
        <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
          🙋
        </div>
      `

      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([volunteer.coords.lng, volunteer.coords.lat])
        .addTo(map.current!)

      markerEl.addEventListener("click", () => {
        showVolunteerPopup(volunteer)
        map.current?.flyTo({
          center: [volunteer.coords.lng, volunteer.coords.lat],
          zoom: 15,
        })
      })

      markersRef.current.push(marker)
    })
  }

  const showSeniorPopup = (senior: Senior, assessment?: Assessment) => {
    if (!map.current) return

    if (popupRef.current) {
      popupRef.current.remove()
    }

    const lastVisitDate = new Date(senior.last_visit).toLocaleDateString()
    const priority = assessment?.priority || "LOW"

    const popupContent = `
      <div class="p-3 min-w-[200px]">
        <h3 class="font-semibold text-sm mb-1">${senior.name}</h3>
        <div class="space-y-1 mb-2">
          <div class="flex items-center gap-1">
            <span class="text-xs">🏥</span>
            <span class="text-xs">Physical: ${senior.physical}/5</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs">🧠</span>
            <span class="text-xs">Mental: ${senior.mental}/5</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs">👥</span>
            <span class="text-xs">Community: ${senior.community}/5</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs">📅</span>
            <span class="text-xs">Last visit: ${lastVisitDate}</span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="px-2 py-1 bg-gray-100 rounded text-xs capitalize">${priority.toLowerCase()} priority</span>
        </div>
      </div>
    `

    popupRef.current = new mapboxgl.Popup({ closeOnClick: true })
      .setLngLat([senior.coords.lng, senior.coords.lat])
      .setHTML(popupContent)
      .addTo(map.current)
  }

  const showVolunteerPopup = (volunteer: Volunteer) => {
    if (!map.current) return

    if (popupRef.current) {
      popupRef.current.remove()
    }

    const assignment = assignments.find((a) => a.volunteer === volunteer.vid)
    const isAvailable = typeof volunteer.available === "boolean" ? volunteer.available : volunteer.available.length > 0

    const popupContent = `
      <div class="p-3 min-w-[200px]">
        <h3 class="font-semibold text-sm mb-1">${volunteer.name}</h3>
        <div class="space-y-1 mb-2">
          <div class="flex items-center gap-1">
            <span class="text-xs">⭐</span>
            <span class="text-xs">Skill Level: ${volunteer.skill}/3</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs">${isAvailable ? "✅" : "❌"}</span>
            <span class="text-xs">${isAvailable ? "Available" : "Unavailable"}</span>
          </div>
          ${
            assignment
              ? `
            <div class="flex items-center gap-1">
              <span class="text-xs">📍</span>
              <span class="text-xs">Assigned: ${assignment.cluster}</span>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `

    popupRef.current = new mapboxgl.Popup({ closeOnClick: true })
      .setLngLat([volunteer.coords.lng, volunteer.coords.lat])
      .setHTML(popupContent)
      .addTo(map.current)
  }

  return (
    <div className="w-full h-[400px] relative">
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <div className="text-center p-4">
            <p className="text-destructive font-medium">Map Error:</p>
            <p className="text-sm text-muted-foreground">{mapError}</p>
          </div>
        </div>
      )}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full rounded-lg" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg z-10">
        <h4 className="text-xs font-medium mb-2">Legend</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="text-xs">High Priority Senior</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <span className="text-xs">Medium Priority Senior</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-xs">Low Priority Senior</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-xs">Volunteer</span>
          </div>
        </div>
      </div>
    </div>
  )
}
