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
  overall_wellbeing?: number
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
  radius: number
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
  const [highlightedCluster, setHighlightedCluster] = useState<number | null>(null)

  const [seniors, setSeniors] = useState<Senior[]>([])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])

  // --- Fetch all data from backend ---
  useEffect(() => {
    async function loadData() {
      try {
        const [sRes, vRes, scRes] = await Promise.all([
          fetch("http://localhost:8000/seniors").catch(() => null),
          fetch("http://localhost:8000/volunteers").catch(() => null),
          fetch("http://localhost:8000/schedules").catch(() => null),
        ])

        if (sRes && vRes && scRes) {
          const seniorsData: Senior[] = (await sRes.json()).seniors || []
          const volunteersData: Volunteer[] = (await vRes.json()).volunteers || []
          const scheduleData: ScheduleResponse = await scRes.json()

          setSeniors(seniorsData)
          setVolunteers(volunteersData)
          setAssignments(scheduleData.schedules.map((s) => ({ volunteer: s.volunteer, cluster: s.cluster })))
          setSchedules(scheduleData.schedules)
          setClusters(scheduleData.clusters)
        }
      } catch (err) {
        console.error("Failed to fetch data", err)
      }
    }
    loadData()
  }, [])

  // --- Initialize Mapbox ---
  useEffect(() => {
    if (!mapContainer.current) return

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!mapboxToken) {
      setMapError("Mapbox token is required. Please set NEXT_PUBLIC_MAPBOX_TOKEN in your environment variables.")
      return
    }

    mapboxgl.accessToken = mapboxToken
    const singaporeBounds: [number, number, number, number] = [
      103.605, 1.214, // west, south
      104.045, 1.478  // east, north
    ];
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [103.8198, 1.3521],
      zoom: 11,

      bounds: singaporeBounds
    })
    map.current.on("load", () => {
      setMapLoaded(true)
      // Add cluster circle source and layer
      map.current.setMaxBounds(singaporeBounds);
      map.current.setMinZoom(10);
      map.current!.addSource("cluster-circles", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      })

      // Add circle layer for cluster boundaries
      map.current!.addLayer({
        id: "cluster-circles-layer",
        type: "fill",
        source: "cluster-circles",
        paint: {
          "fill-color": "#8B5CF6", // Purple color matching cluster markers
          "fill-opacity": 0.2,
          "fill-outline-color": "#8B5CF6",
        },
      })

      // Add circle outline layer
      map.current!.addLayer({
        id: "cluster-circles-outline",
        type: "line",
        source: "cluster-circles",
        paint: {
          "line-color": "#8B5CF6",
          "line-width": 2,
          "line-opacity": 0.8,
        },
      })

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
  }, [seniors, volunteers, clusters, mapLoaded, highlightedCluster])

  // --- Helper function to create circle polygon ---
  const createCirclePolygon = (center, radiusKm, points = 64) => {
    const coords = []
    const distanceX = radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180))
    const distanceY = radiusKm / 110.54

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI)
      const x = distanceX * Math.cos(theta)
      const y = distanceY * Math.sin(theta)
      coords.push([center[0] + x, center[1] + y])
    }
    coords.push(coords[0]) // Close the polygon
    return coords
  }

  // --- Update cluster circles ---
  const updateClusterCircles = () => {
    if (!map.current || !mapLoaded) return

    const features = clusters.map((cluster) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          createCirclePolygon(
            [cluster.center.lng, cluster.center.lat],
            cluster.radius || 0.5, // Use the radius from backend, fallback to 0.5km
          ),
        ],
      },
      properties: {
        clusterId: cluster.id,
        seniorCount: cluster.seniors.length,
        radius: cluster.radius,
      },
    }))

    const source = map.current.getSource("cluster-circles")
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: features,
      })
    }
  }

  // --- Render all markers ---
  const renderMarkers = () => {
    if (!map.current) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    // Update cluster circles first
    updateClusterCircles()

    // Cluster markers
    clusters.forEach((cluster, idx) => {
      const el = document.createElement("div")
      el.className =
        "w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg cursor-pointer relative z-10"
      el.innerText = cluster.seniors.length.toString()

      // Add hover effect to highlight corresponding circle
      el.addEventListener("mouseenter", () => {
        map.current?.setPaintProperty("cluster-circles-layer", "fill-opacity", [
          "case",
          ["==", ["get", "clusterId"], cluster.id],
          0.4, // Highlighted opacity
          0.2, // Default opacity
        ])
        map.current?.setPaintProperty("cluster-circles-outline", "line-width", [
          "case",
          ["==", ["get", "clusterId"], cluster.id],
          3, // Highlighted width
          2, // Default width
        ])
      })

      el.addEventListener("mouseleave", () => {
        map.current?.setPaintProperty("cluster-circles-layer", "fill-opacity", 0.2)
        map.current?.setPaintProperty("cluster-circles-outline", "line-width", 2)
      })

      const marker = new mapboxgl.Marker(el).setLngLat([cluster.center.lng, cluster.center.lat]).addTo(map.current!)

      el.addEventListener("click", () => {
        setHighlightedCluster(idx)

        if (popupRef.current) {
          popupRef.current.remove()
          popupRef.current = null
        }

        // Fit map to cluster bounds
        const bounds = new mapboxgl.LngLatBounds()
        cluster.seniors.forEach((senior) => {
          if (senior.coords) {
            bounds.extend([senior.coords.lng, senior.coords.lat])
          }
        })
        map.current?.fitBounds(bounds, { padding: 50 })
      })

      markersRef.current.push(marker)
    })

    const seniorMarkerElements = new Map()

    // Senior markers
    seniors.forEach((s) => {
      console.log(s.overall_wellbeing)
      if (!s.coords) return
      const levels = {
        1: "LOW",
        2: "MEDIUM",
        3: "HIGH"
      };

      const assessment = levels[s.overall_wellbeing] || "LOW";
      const isInHighlightedCluster =
        highlightedCluster !== null &&
        clusters[highlightedCluster]?.seniors.some((clusterSenior) => clusterSenior.uid === s.uid)
      const colorClass = priorityColors[assessment || "LOW"]
      console.log(colorClass)
      const sizeClass = isInHighlightedCluster ? "w-8 h-8" : "w-6 h-6"
      const borderClass = isInHighlightedCluster ? "border-4 border-purple-500" : "border-2 border-white"

      const el = document.createElement("div")
      el.className = `${sizeClass} ${colorClass} rounded-full ${borderClass} shadow-md cursor-pointer flex items-center justify-center text-xs relative z-20`
      el.innerText = "👤"
      el.style.transition = "all 0.2s ease-in-out"

      // Store reference to this element for highlighting
      seniorMarkerElements.set(s.uid, el)

      const marker = new mapboxgl.Marker(el).setLngLat([s.coords.lng, s.coords.lat]).addTo(map.current!)
      el.addEventListener("click", (e) => {
        e.stopPropagation()
        setHighlightedCluster(null)
        showSeniorPopup(s, assessment)
      })
      markersRef.current.push(marker)
    })

    // Volunteer markers
    volunteers.forEach((v) => {
      if (!v.coords) return
      const el = document.createElement("div")
      el.className =
        "w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs relative z-20"
      el.innerText = "🙋"
      const marker = new mapboxgl.Marker(el).setLngLat([v.coords.lng, v.coords.lat]).addTo(map.current!)
      el.addEventListener("click", (e) => {
        e.stopPropagation()
        setHighlightedCluster(null)
        showVolunteerPopup(v)
      })
      markersRef.current.push(marker)
    })
  }

  // --- Popups ---
  const showSeniorPopup = (s: Senior, assessment?: { priority: "HIGH" | "MEDIUM" | "LOW" }) => {
    if (!map.current) return

    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    const lastVisit = s.last_visit ? new Date(s.last_visit).toLocaleDateString() : "N/A"
    const priority = assessment || "LOW"

    popupRef.current = new mapboxgl.Popup({
      closeOnClick: false, // Disable auto-close to prevent conflicts
      closeButton: true, // Show close button instead
      focusAfterOpen: false, // Prevent focus issues
    })
      .setLngLat([s.coords.lng, s.coords.lat])
      .setHTML(`
        <div class="p-3 min-w-[200px]">
          <h3 class="font-semibold text-sm mb-1">${s.name || s.uid}</h3>
          <div class="space-y-1 mb-2">
            <div>🏥 Physical: ${5 - s.physical}/5</div>
            <div>🧠 Mental: ${5 - s.mental}/5</div>
            <div>👥 Community: ${5 - s.community}/5</div>
            <div>📅 Last Visit: ${lastVisit}</div>
          </div>
          <div class="px-2 py-1 bg-gray-100 rounded text-xs">${priority} priority</div>
        </div>
      `)
      .addTo(map.current)

    popupRef.current.on("close", () => {
      popupRef.current = null
    })
  }

  const showVolunteerPopup = (v: Volunteer) => {
    if (!map.current) return

    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    const assignment = assignments.find((a) => a.volunteer === v.vid)
    const available = typeof v.available === "boolean" ? v.available : v.available.length > 0

    popupRef.current = new mapboxgl.Popup({
      closeOnClick: false, // Disable auto-close to prevent conflicts
      closeButton: true, // Show close button instead
      focusAfterOpen: false, // Prevent focus issues
    })
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

    popupRef.current.on("close", () => {
      popupRef.current = null
    })
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
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg z-50">
        <h4 className="text-xs font-medium mb-2">Legend</h4>
        <div className="space-y-1">
          <LegendItem color="bg-red-500" label="High Priority Senior" />
          <LegendItem color="bg-yellow-500" label="Medium Priority Senior" />
          <LegendItem color="bg-green-500" label="Low Priority Senior" />
          <LegendItem color="bg-blue-500" label="Volunteer" />
          <LegendItem color="bg-purple-500" label="Cluster" />
        </div>
        {highlightedCluster !== null && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs text-purple-600 font-medium">Cluster {highlightedCluster + 1} highlighted</div>
            <div className="text-xs text-gray-500">Click elsewhere to clear</div>
          </div>
        )}
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
