"use client"

import { useState, useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

// --- TypeScript interfaces ---
interface Coord {
  lat: number
  lng: number
}
export interface Senior {
  uid: string
  name: string
  coords: { lat: number; lng: number }
  physical?: number
  mental?: number
  community?: number
  last_visit?: string
  cluster?: number
  overall_wellbeing: 1 | 2 | 3
}
export interface Volunteer {
  vid: string
  name: string
  coords: { lat: number; lng: number }
  skill: number
  available: boolean | string[]
}

export interface Assignment {
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
  [x: string]: any
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

export function InteractiveMap({
  highlightedSeniorId,
  onMapUnfocus,
  onSeniorClick,
  centerCoordinates = [103.8198, 1.3521], // Default to Singapore center
  initialZoom = 11,
}: {
  highlightedSeniorId?: string | null
  onMapUnfocus?: () => void
  onSeniorClick?: (seniorId: string) => void
  centerCoordinates?: [number, number]
  initialZoom?: number
}) {


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

  const wellbeingLabels: Record<number, string> = {
    1: "Very Poor",
    2: "Poor",
    3: "Normal",
    4: "Good",
    5: "Very Good",
    }


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
      style: "mapbox://styles/wzinl/cmf5f4has01rh01pj8ajb1993",
      center: centerCoordinates,
      zoom: 13
      
    })
    map.current.on("load", () => {
      setMapLoaded(true)
      // Add cluster circle source and layer
      if (map.current) {
        map.current.setMaxBounds(singaporeBounds);
        map.current.setMinZoom(10);
        map.current.addSource("cluster-circles", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
      }
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
    if (!map.current) return
    if (!mapLoaded) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

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

    // Senior markers
    seniors.forEach((s) => {
      if (!s.coords) return
      const levels = { 1: "HIGH", 2: "MEDIUM", 3: "LOW" }
      const assessment = levels[s.overall_wellbeing] || "LOW"
      const isHighlighted = s.uid === highlightedSeniorId
      const colorClass = priorityColors[(assessment || "LOW") as "HIGH" | "MEDIUM" | "LOW"]
      const sizeClass = "w-6 h-6"
      const borderClass = isHighlighted ? "border-4 border-purple-500" : "border-2 border-white"
      const boxShadow = isHighlighted ? "0 0 10px #a855f7" : "0 0 4px #888"

      const el = document.createElement("div")
      el.className = `${sizeClass} ${colorClass} rounded-full ${borderClass} shadow-md cursor-pointer flex items-center justify-center text-xs relative z-20`
      el.innerText = "👤"
      el.style.boxShadow = boxShadow

      el.addEventListener("click", (e) => {
        e.stopPropagation()
        setHighlightedCluster(null)
        showSeniorPopup(s, assessment as "HIGH" | "MEDIUM" | "LOW")
        if (onSeniorClick) onSeniorClick(s.uid) // <-- Call the callback here
      })

      const marker = new mapboxgl.Marker(el).setLngLat([s.coords.lng, s.coords.lat]).addTo(map.current!)
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

    // Clicking elsewhere on the map unfocuses
    if (map.current && onMapUnfocus) {
      map.current.on("click", onMapUnfocus)
    }
    return () => {
      if (map.current && onMapUnfocus) {
        map.current.off("click", onMapUnfocus)
      }
    }
  }, [seniors, volunteers, clusters, highlightedSeniorId, mapLoaded, highlightedCluster, onMapUnfocus, onSeniorClick])

  // --- Helper function to create circle polygon ---
  interface CircleCenter {
    0: number // lng
    1: number // lat
    length: 2
  }

  type CirclePolygon = [number, number][]

  interface CreateCirclePolygonFn {
    (
      center: CircleCenter,
      radiusKm: number,
      points?: number
    ): CirclePolygon
  }

  const createCirclePolygon: CreateCirclePolygonFn = (center, radiusKm, points = 64) => {
    const coords: CirclePolygon = []
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
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
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
    if (source && "setData" in source) {
      (source as mapboxgl.GeoJSONSource).setData({
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
      // console.log(s.overall_wellbeing)
      if (!s.coords) return
      const levels = {
        1: "HIGH",
        2: "MEDIUM",
        3: "LOW"
      };
      const assessment = levels[s.overall_wellbeing] || "LOW";
      const isInHighlightedCluster =
        highlightedCluster !== null &&
        clusters[highlightedCluster]?.seniors.some((clusterSenior) => clusterSenior.uid === s.uid)
      const colorClass = priorityColors[(assessment || "LOW") as "HIGH" | "MEDIUM" | "LOW"]
      const sizeClass = isInHighlightedCluster ? "w-8 h-8" : "w-6 h-6"
      const borderClass = isInHighlightedCluster ? "border-4 border-purple-500" : "border-2 border-white"

      const el = document.createElement("div")
      el.className =               
      `${sizeClass} ${colorClass} rounded-full ${borderClass} shadow-md cursor-pointer flex items-center justify-center text-xs relative z-20`
      el.innerText = "👤"
      // Store reference to this element for highlighting
      seniorMarkerElements.set(s.uid, el)

      const marker = new mapboxgl.Marker(el).setLngLat([s.coords.lng, s.coords.lat]).addTo(map.current!)
      el.addEventListener("click", (e) => {
        e.stopPropagation()
        setHighlightedCluster(null)
        showSeniorPopup(s, assessment as "HIGH" | "MEDIUM" | "LOW")
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

  const createSeniorPopupHTML = (senior: Senior, priority: "HIGH" | "MEDIUM" | "LOW", wellbeingLabels: Record<number, string>) => {
  const lastVisit = senior.last_visit ? new Date(senior.last_visit).toLocaleDateString() : "N/A"
  
  const priorityStyles = {
    HIGH: "bg-red-100 text-red-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    LOW: "bg-green-100 text-green-800"
  }
  
  const wellbeingIcon = (score: number | undefined) => {
    if (score === undefined) return "❓"
    if (score <= 2) return "🔴"
    if (score <= 3) return "🟡"
    return "🟢"
  }
  
  const escapeHtml = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
  
  const wellbeingItems = [
    { icon: wellbeingIcon(senior.physical), label: 'Physical Health', value: senior.physical },
    { icon: wellbeingIcon(senior.mental), label: 'Mental Health', value: senior.mental },
    { icon: wellbeingIcon(senior.community), label: 'Community', value: senior.community }
  ]
  
  return `
    <div class="w-60 p-0 bg-white rounded-lg">
      <div class="pb-1">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
            👤
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-base text-gray-900">${escapeHtml(senior.name || senior.uid)}</h3>
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityStyles[priority]}">
              ${priority} Priority
            </span>
          </div>
        </div>
        
        <div class="space-y-2">
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">Wellbeing Status</h4>
            <div class="space-y-2">
              ${wellbeingItems.map(item => `
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600 flex items-center gap-2">
                    ${item.icon} ${item.label}
                  </span>
                  <span class="text-sm font-medium">
                    ${item.value !== undefined ? wellbeingLabels[6 - item.value] : "Unknown"}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="pt-2 border-t border-gray-100">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 flex items-center gap-2">
                📅 Last Visit
              </span>
              <span class="text-sm font-medium">${lastVisit}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

const createVolunteerPopupHTML = (volunteer: Volunteer, assignment?: Assignment) => {
  const available = typeof volunteer.available === "boolean" 
    ? volunteer.available 
    : volunteer.available.length > 0

  const escapeHtml = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  const availabilityStyle = available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
  const availabilityText = available ? "Available" : "Unavailable"
  
  const skillIcon = (skill: number) => {
    if (skill >= 3) return "⭐"
    if (skill >= 2) return "🟡"
    return "🔴"
  }

  return `
    <div class="w-60 p-0 bg-white rounded-lg">
      <div class="pb-1">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
            🙋
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-base text-gray-900">${escapeHtml(volunteer.name || volunteer.vid)}</h3>
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${availabilityStyle}">
              ${availabilityText}
            </span>
          </div>
        </div>
        
        <div class="space-y-2">
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">Volunteer Details</h4>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 flex items-center gap-2">
                  ${skillIcon(volunteer.skill)} Skill Level
                </span>
                <span class="text-sm font-medium">
                  ${volunteer.skill}/3
                </span>
              </div>
              ${assignment ? `
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600 flex items-center gap-2">
                    📍 Assignment
                  </span>
                  <span class="text-sm font-medium">
                    Cluster ${assignment.cluster}
                  </span>
                </div>
              ` : `
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600 flex items-center gap-2">
                    📍 Assignment
                  </span>
                  <span class="text-sm font-medium">
                    Not Assigned
                  </span>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}


  // --- Popups ---
const showSeniorPopup = (s: Senior, priority?: "HIGH" | "MEDIUM" | "LOW") => {
  if (!map.current) return

  if (popupRef.current) {
    popupRef.current.remove()
    popupRef.current = null
  }

  const displayPriority = priority || "LOW"
  const popupHTML = createSeniorPopupHTML(s, displayPriority, wellbeingLabels)

  popupRef.current = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: true,
    closeOnMove: true,
    focusAfterOpen: true,
    maxWidth: "500",
    className: ""
  })
    .setLngLat([s.coords.lng, s.coords.lat])
    .setHTML(popupHTML)
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
  const popupHTML = createVolunteerPopupHTML(v, assignment)

  popupRef.current = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: true,
    closeOnMove: true,
    focusAfterOpen: true,
    maxWidth: "500",
    className: ""
  })
    .setLngLat([v.coords.lng, v.coords.lat])
    .setHTML(popupHTML)
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
