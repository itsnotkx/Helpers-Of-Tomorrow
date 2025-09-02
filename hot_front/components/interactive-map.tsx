"use client"

import { useState, useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

// --- TypeScript interfaces ---
interface Coord {
  lat: number
  lng: number
}

interface Senior {
  uid: string
  name?: string
  coords: Coord
  physical: number
  mental: number
  community: number
  last_visit?: string
  cluster?: number
}

interface Volunteer {
  vid: string
  name?: string
  coords: Coord
  skill: number
  available: boolean | string[]
}

interface Assignment {
  volunteer: string
  cluster: number
  weighted_distance?: number
}

interface Schedule {
  volunteer: string
  cluster: number
  datetime: string
  duration: number
}

interface Cluster {
  center: Coord
  seniors: Senior[]
}

interface ScheduleResponse {
  schedules: Schedule[]
  clusters: Cluster[]
  cluster_density: Record<string, number>
}

const priorityColors: Record<"HIGH" | "MEDIUM" | "LOW", string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-green-500",
}

export function InteractiveMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef = useRef<mapboxgl.Popup | null>(null)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const [seniors, setSeniors] = useState<Senior[]>([])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])

  // --- Fetch all data from backend ---
  useEffect(() => {
    async function loadData() {
      try {
        // /schedules returns schedules + clusters
        const [sRes, vRes, scRes] = await Promise.all([
          fetch("http://localhost:8000/seniors"),
          fetch("http://localhost:8000/volunteers"),
          fetch("http://localhost:8000/schedules"),
        ])

        const seniorsData: Senior[] = (await sRes.json()).seniors || []
        const volunteersData: Volunteer[] = (await vRes.json()).volunteers || []
        const scheduleData: ScheduleResponse = await scRes.json()

        setSeniors(seniorsData)
        setVolunteers(volunteersData)
        setAssignments(scheduleData.schedules.map((s) => ({ volunteer: s.volunteer, cluster: s.cluster })))
        setSchedules(scheduleData.schedules)
        setClusters(scheduleData.clusters)
      } catch (err) {
        console.error("Failed to fetch data:", err)
        setMapError("Failed to load map data")
      }
    }
    loadData()
  }, [])

  // --- Compute assessments ---
  const assessments = seniors.map((s) => {
    const riskScore = (s.physical + s.mental + s.community) / 15
    const priority: "HIGH" | "MEDIUM" | "LOW" =
      riskScore > 0.7 ? "HIGH" : riskScore > 0.4 ? "MEDIUM" : "LOW"
    return { uid: s.uid, risk: riskScore, priority, needscare: riskScore > 0.6 }
  })

  // --- Initialize Mapbox ---
  useEffect(() => {
    if (!mapContainer.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [103.8198, 1.3521],
      zoom: 11,
    })

    map.current.on("load", () => {
      setMapLoaded(true)
      renderMarkers()
    })

    map.current.on("error", (e) => {
      console.error("Map error:", e)
      setMapError((e as any).message || "Failed to load map")
    })

    return () => map.current?.remove()
  }, [])

  // --- Re-render markers when data changes ---
  useEffect(() => {
    if (mapLoaded) renderMarkers()
  }, [seniors, volunteers, clusters, mapLoaded])

  // --- Render all markers ---
  const renderMarkers = () => {
    if (!map.current) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    // Cluster markers
    clusters.forEach((cluster, idx) => {
      const el = document.createElement("div")
      el.className =
        "w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg cursor-pointer"
      el.innerText = cluster.seniors.length.toString()

      const marker = new mapboxgl.Marker(el)
        .setLngLat([cluster.center.lng, cluster.center.lat])
        .addTo(map.current!)

      el.addEventListener("click", () =>
        map.current?.flyTo({ center: [cluster.center.lng, cluster.center.lat], zoom: 14 })
      )

      markersRef.current.push(marker)
    })

    // Senior markers
    seniors.forEach((s) => {
      if (!s.coords) return
      const assessment = assessments.find((a) => a.uid === s.uid)
      const colorClass = priorityColors[assessment?.priority || "LOW"]

      const el = document.createElement("div")
      el.className =
        `w-6 h-6 ${colorClass} rounded-full border-2 border-white shadow-md cursor-pointer flex items-center justify-center text-xs`
      el.innerText = "👤"

      const marker = new mapboxgl.Marker(el)
        .setLngLat([s.coords.lng, s.coords.lat])
        .addTo(map.current!)

      el.addEventListener("click", () => showSeniorPopup(s, assessment))
      markersRef.current.push(marker)
    })

    // Volunteer markers
    volunteers.forEach((v) => {
      if (!v.coords) return

      const el = document.createElement("div")
      el.className =
        "w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs"
      el.innerText = "🙋"

      const marker = new mapboxgl.Marker(el)
        .setLngLat([v.coords.lng, v.coords.lat])
        .addTo(map.current!)

      el.addEventListener("click", () => showVolunteerPopup(v))
      markersRef.current.push(marker)
    })
  }

  // --- Popups ---
  const showSeniorPopup = (s: Senior, assessment?: { priority: "HIGH" | "MEDIUM" | "LOW" }) => {
    if (!map.current) return
    popupRef.current?.remove()
    const lastVisit = s.last_visit ? new Date(s.last_visit).toLocaleDateString() : "N/A"
    const priority = assessment?.priority || "LOW"

    popupRef.current = new mapboxgl.Popup({ closeOnClick: true })
      .setLngLat([s.coords.lng, s.coords.lat])
      .setHTML(`
        <div class="p-3 min-w-[200px]">
          <h3 class="font-semibold text-sm mb-1">${s.name || s.uid}</h3>
          <div class="space-y-1 mb-2">
            <div>🏥 Physical: ${s.physical}/5</div>
            <div>🧠 Mental: ${s.mental}/5</div>
            <div>👥 Community: ${s.community}/5</div>
            <div>📅 Last Visit: ${lastVisit}</div>
          </div>
          <div class="px-2 py-1 bg-gray-100 rounded text-xs">${priority.toLowerCase()} priority</div>
        </div>
      `)
      .addTo(map.current)
  }

  const showVolunteerPopup = (v: Volunteer) => {
    if (!map.current) return
    popupRef.current?.remove()

    const assignment = assignments.find((a) => a.volunteer === v.vid)
    const available =
      typeof v.available === "boolean" ? v.available : v.available.length > 0

    popupRef.current = new mapboxgl.Popup({ closeOnClick: true })
      .setLngLat([v.coords.lng, v.coords.lat])
      .setHTML(`
        <div class="p-3 min-w-[200px]">
          <h3 class="font-semibold text-sm mb-1">${v.name || v.vid}</h3>
          <div>⭐ Skill: ${v.skill}/3</div>
          <div>${available ? "✅ Available" : "❌ Unavailable"}</div>
          ${assignment ? `<div>📍 Assigned: ${assignment.cluster}</div>` : ""}
        </div>
      `)
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
          <LegendItem color="bg-red-500" label="High Priority Senior" />
          <LegendItem color="bg-yellow-500" label="Medium Priority Senior" />
          <LegendItem color="bg-green-500" label="Low Priority Senior" />
          <LegendItem color="bg-blue-500" label="Volunteer" />
          <LegendItem color="bg-purple-500" label="Cluster" />
        </div>
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 ${color} rounded-full`} />
      <span className="text-xs">{label}</span>
    </div>
  )
}
