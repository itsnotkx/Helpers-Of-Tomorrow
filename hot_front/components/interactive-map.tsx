"use client";

import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Assignment, Cluster, Senior, Volunteer } from "@/app/page";

interface Schedule {
  volunteer: string;
  cluster: number;
  datetime: string;
  duration: number;
  seniors: string[];
}

const priorityColors: Record<"HIGH" | "MEDIUM" | "LOW", string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-green-500",
};

// Unified priority and wellbeing utilities
const getPriorityLevel = (wellbeing: 1 | 2 | 3): "HIGH" | "MEDIUM" | "LOW" => {
  return wellbeing === 1 ? "HIGH" : wellbeing === 2 ? "MEDIUM" : "LOW";
};

const wellbeingLabels: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Normal",
  4: "Good",
  5: "Very Good",
};

export function InteractiveMap({
  highlightedSeniorId,
  highlightedVolunteerId,
  onMapUnfocus,
  centerCoordinates = [103.8198, 1.3521], // Default to Singapore center
  initialZoom = 11,
  seniors: seniorsProp,
  volunteers: volunteersProp,
  assignments: assignmentsProp,
  clusters: clustersProp,
  selectedDistrict = "All",
}: {
  highlightedSeniorId?: string | null;
  highlightedVolunteerId?: string | null;
  onMapUnfocus?: () => void;
  onSeniorClick?: (seniorId: string) => void;
  onVolunteerClick?: (volunteerId: string) => void;
  centerCoordinates?: [number, number];
  initialZoom?: number;
  seniors?: Senior[];
  volunteers?: Volunteer[];
  assignments?: Assignment[];
  clusters?: Cluster[];
  selectedDistrict?: string;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [highlightedCluster, setHighlightedCluster] = useState<number | null>(
    null
  );

  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);

  // NEW: local focused senior id (for clicks from map or external events)
  const [locallyFocusedSeniorId, setLocallyFocusedSeniorId] = useState<
    string | null
  >(null);

  // NEW: local focused volunteer id (for clicks from map or external events)
  const [locallyFocusedVolunteerId, setLocallyFocusedVolunteerId] = useState<
    string | null
  >(null);

  // --- Update internal state when props change ---
  useEffect(() => {
    if (seniorsProp && volunteersProp && assignmentsProp && clustersProp) {
      const filterByDistrict = (item: { constituency_name?: string }) => {
        // console.log(item.constituency_name);
        return (
          !selectedDistrict ||
          selectedDistrict === "All" ||
          item.constituency_name === selectedDistrict
        );
      };
      // Get current week boundaries
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const currentDay = now.getDay();
      const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - daysToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // Filter seniors: show only those with assignments THIS WEEK
      const filteredSeniors = seniorsProp
        .filter(filterByDistrict)
        .filter((senior) => {
          // Check if senior has assignment this week
          return assignmentsProp.some((assignment) => {
            // Check if senior ID matches
            const seniorMatches = [
              (assignment as any).sid,
              (assignment as any).senior_id,
              (assignment as any).senior,
            ].includes(senior.uid);

            if (!seniorMatches) return false;

            // Check if assignment is for this week
            const assignmentDate = new Date(
              (assignment as any).date ||
                (assignment as any).scheduled_date ||
                new Date().toISOString().split("T")[0]
            );
            assignmentDate.setHours(0, 0, 0, 0);

            return assignmentDate >= startOfWeek && assignmentDate <= endOfWeek;
          });
        });

      // Filter volunteers: only show those with assignments THIS WEEK
      const volunteersWithAssignments = volunteersProp
        .filter(filterByDistrict)
        .filter((volunteer) => {
          return assignmentsProp.some((assignment: any) => {
            // Check if volunteer ID matches
            const volunteerMatches = [
              assignment.vid,
              assignment.volunteer_id,
              assignment.volunteer,
            ].includes(volunteer.vid);

            if (!volunteerMatches) return false;

            // Check if assignment is for this week
            const assignmentDate = new Date(
              assignment.date ||
                assignment.scheduled_date ||
                new Date().toISOString().split("T")[0]
            );
            assignmentDate.setHours(0, 0, 0, 0);

            return assignmentDate >= startOfWeek && assignmentDate <= endOfWeek;
          });
        });

      // Process assignments and schedules
      const schedulesFromAssignments: Schedule[] = Object.values(
        assignmentsProp.reduce((acc: any, assignment: any) => {
          const volunteerId =
            assignment.vid || assignment.volunteer_id || assignment.volunteer;
          const clusterId = assignment.cluster_id || assignment.cluster;
          const date =
            assignment.date || new Date().toISOString().split("T")[0];
          const startTime = assignment.start_time || "09:00";

          const start = new Date(`1970-01-01T${startTime}`);
          const end = new Date(`1970-01-01T${assignment.end_time || "10:00"}`);
          const duration = (end.getTime() - start.getTime()) / (1000 * 60);

          const key = `${volunteerId}-${clusterId}-${date}T${startTime}`;

          if (!acc[key]) {
            acc[key] = {
              volunteer: volunteerId,
              cluster: clusterId,
              datetime: `${date}T${startTime}`,
              duration,
              seniors: [],
            };
          }

          acc[key].seniors.push(
            assignment.sid || assignment.senior_id || assignment.senior
          );
          return acc;
        }, {})
      );

      const assignmentsFromData = assignmentsProp.map((assignment: any) => ({
        volunteer:
          assignment.vid || assignment.volunteer_id || assignment.volunteer,
        cluster: assignment.cluster_id || assignment.cluster,
        distance: assignment.distance || 0,
      }));

      // Process clusters
      const processedClusters = clustersProp
        .map((cluster: any) => {
          const centroid =
            typeof cluster.centroid === "string"
              ? JSON.parse(cluster.centroid)
              : cluster.centroid || cluster.center;

          const radiusInKm = (cluster.radius || 0.01) * 111; // Convert to km

          // Collect senior objects from schedules
          const clusterSeniors = schedulesFromAssignments
            .filter((schedule) => schedule.cluster === cluster.id)
            .flatMap((schedule) =>
              schedule.seniors
                .map((sid) => filteredSeniors.find((s) => s.uid === sid))
                .filter((s): s is Senior => !!s)
            );

          return {
            id: cluster.id,
            center: centroid,
            radius: radiusInKm,
            seniors: clusterSeniors,
          };
        })
        .filter((cluster) => {
          if (!selectedDistrict || selectedDistrict === "All") return true;
          // ✅ keep cluster only if all seniors belong to the district
          return (
            cluster.seniors &&
            cluster.seniors.length > 0 &&
            cluster.seniors.every(
              (s) => s.constituency_name === selectedDistrict
            )
          );
        });

      setSeniors(filteredSeniors);
      setVolunteers(volunteersWithAssignments);
      setAssignments(assignmentsFromData);
      setSchedules(schedulesFromAssignments);
      setClusters(processedClusters);
    }
  }, [
    seniorsProp,
    volunteersProp,
    assignmentsProp,
    clustersProp,
    selectedDistrict,
  ]);

  // --- Initialize Mapbox ---
  useEffect(() => {
    if (!mapContainer.current) return;

    const initializeMap = async () => {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapboxgl.accessToken = token;
        const singaporeBounds: [number, number, number, number] = [
          103.605,
          1.214, // west, south
          104.045,
          1.478, // east, north
        ];
        // console.log("Center Coordinates:", centerCoordinates);
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: "mapbox://styles/wzinl/cmf5f4has01rh01pj8ajb1993",
          center: centerCoordinates,
          zoom: 13,
        });
        map.current.on("load", () => {
          setMapLoaded(true);
          // Add cluster circle source and layer
          if (map.current) {
            map.current.setMaxBounds(singaporeBounds);
            map.current.setMinZoom(10);

            // Only add source if it doesn't already exist
            if (!map.current.getSource("cluster-circles")) {
              map.current.addSource("cluster-circles", {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: [],
                },
              });
            }
          }
          // Add circle layer for cluster boundaries (added as the bottommost layers)
          // Try to insert before existing layers to ensure they stay at the bottom
          const layerIds =
            map.current!.getStyle().layers?.map((layer) => layer.id) || [];
          const beforeLayer =
            layerIds.find(
              (id) =>
                id.includes("building") ||
                id.includes("road") ||
                id.includes("label")
            ) || undefined;

          if (!map.current!.getLayer("cluster-circles-layer")) {
            map.current!.addLayer(
              {
                id: "cluster-circles-layer",
                type: "fill",
                source: "cluster-circles",
                layout: {},
                paint: {
                  "fill-color": "#8B5CF6", // Purple color matching cluster markers
                  "fill-opacity": 0.2,
                  "fill-outline-color": "#8B5CF6",
                },
              },
              beforeLayer
            );
          }

          // Add circle outline layer
          if (!map.current!.getLayer("cluster-circles-outline")) {
            map.current!.addLayer(
              {
                id: "cluster-circles-outline",
                type: "line",
                source: "cluster-circles",
                layout: {},
                paint: {
                  "line-color": "#8B5CF6",
                  "line-width": 2,
                  "line-opacity": 0.8,
                },
              },
              beforeLayer
            );
          }

          renderMarkers();
        });
        map.current.on("error", (e) => {
          if (process.env.NODE_ENV === "development") {
            console.error("Map error:", e);
          }
          setMapError((e as any).message || "Failed to load map");
        });
      } catch (error) {
        setMapError(
          error instanceof Error
            ? error.message
            : "Failed to initialize map. Please check your Mapbox configuration."
        );
      }
    };

    initializeMap();

    return () => {
      if (map.current) {
        // Clean up markers
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        // Clean up popup
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }

        // Remove layers and sources before removing map
        try {
          if (map.current.getLayer("cluster-circles-outline")) {
            map.current.removeLayer("cluster-circles-outline");
          }
          if (map.current.getLayer("cluster-circles-layer")) {
            map.current.removeLayer("cluster-circles-layer");
          }
          if (map.current.getSource("cluster-circles")) {
            map.current.removeSource("cluster-circles");
          }
        } catch (error) {
          // Ignore cleanup errors
          if (process.env.NODE_ENV === "development") {
            console.warn("Map cleanup warning:", error);
          }
        }

        map.current.remove();
      }
    };
  }, []);

  // Focus when highlightedSeniorId prop changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !highlightedSeniorId) return;

    const s = seniors.find((x) => x.uid === highlightedSeniorId);
    if (!s?.coords) return;

    setHighlightedCluster(null);
    setLocallyFocusedSeniorId(s.uid);

    const assessment = getPriorityLevel(s.overall_wellbeing);
    showSeniorPopup(s, assessment);

    const bounds = new mapboxgl.LngLatBounds().extend([
      s.coords.lng,
      s.coords.lat,
    ]);
    map.current.fitBounds(bounds, { padding: 80, maxZoom: 15 });
  }, [highlightedSeniorId, mapLoaded, seniors]);


  // Listen for cross-component focus events
  useEffect(() => {
    if (!mapLoaded) return;

    const onFocusSenior = (e: any) => {
      const uid = e?.detail?.uid as string | undefined;
      if (!uid) return;
      const s = seniors.find((x) => x.uid === uid);
      if (!s?.coords) return;

      setHighlightedCluster(null);
      setLocallyFocusedSeniorId(s.uid);

      const assessment = getPriorityLevel(s.overall_wellbeing);
      showSeniorPopup(s, assessment);

      map.current?.flyTo({
        center: [s.coords.lng, s.coords.lat],
        zoom: Math.max(map.current!.getZoom(), 15),
        essential: true,
      });
    };

    const onFocusVolunteer = (e: any) => {
      if (process.env.NODE_ENV === "development") {
        // console.log("Received focus-volunteer event:", e);
      }
      const vid = e?.detail?.vid as string | undefined;
      if (!vid) return;
      const v = volunteers.find((x) => x.vid === vid);
      if (!v?.coords) return;

      setHighlightedCluster(null);
      setLocallyFocusedSeniorId(null);
      setLocallyFocusedVolunteerId(vid);

      map.current?.flyTo({
        center: [v.coords.lng, v.coords.lat],
        zoom: Math.max(map.current!.getZoom(), 14),
        essential: true,
      });
      showVolunteerPopup(v);
    };

    const onFocusDistrict = (e: any) => {
      if (process.env.NODE_ENV === "development") {
        console.log("Received district focus event:", e);
      }
      const coords = e?.detail?.center as [number, number] | undefined;
      if (!coords) return;
      setHighlightedCluster(null);
      setLocallyFocusedSeniorId(null);
      setLocallyFocusedVolunteerId(null);

      map.current?.flyTo({
        center: [coords[0], coords[1]],
        zoom: e?.detail?.district === "All" ? 10.5 :  Math.max(map.current!.getZoom(), 14),
        essential: true,
      });
      // showVolunteerPopup(v);
    };

    window.addEventListener("focus-senior", onFocusSenior as EventListener);
    window.addEventListener("focus-volunteer", onFocusVolunteer as EventListener);

    window.addEventListener("focus-district", onFocusDistrict as EventListener);


    return () => {
      window.removeEventListener("focus-senior", onFocusSenior as EventListener);
      window.removeEventListener("focus-volunteer", onFocusVolunteer as EventListener);
      window.removeEventListener("focus-district", onFocusDistrict as EventListener);
    };
  }, [mapLoaded, seniors, volunteers]);

  // --- Re-render markers when data changes ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    renderMarkers();

    // Clicking elsewhere on the map unfocuses
    if (map.current && onMapUnfocus) {
      map.current.on("click", () => {
        setLocallyFocusedSeniorId(null);
        setLocallyFocusedVolunteerId(null);
        onMapUnfocus();
      });
    }
    return () => {
      if (map.current && onMapUnfocus) {
        map.current.off("click", onMapUnfocus);
      }
    };
  }, [
    seniors,
    volunteers,
    clusters,
    highlightedSeniorId,
    highlightedVolunteerId,
    mapLoaded,
    highlightedCluster,
    onMapUnfocus,
    locallyFocusedSeniorId,
    locallyFocusedVolunteerId,
  ]);

  // Helper function to create circle polygon
  const createCirclePolygon = (
    center: [number, number],
    radiusKm: number,
    points = 64
  ): [number, number][] => {
    const coords: [number, number][] = [];
    const distanceX =
      radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180));
    const distanceY = radiusKm / 110.54;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([center[0] + x, center[1] + y]);
    }
    coords.push(coords[0]); // Close the polygon
    return coords;
  };

  // --- Update cluster circles ---
  const updateClusterCircles = () => {
    if (!map.current || !mapLoaded) return;

    const features = clusters.map((cluster) => ({
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          createCirclePolygon(
            [cluster.center.lng, cluster.center.lat],
            cluster.radius // Now properly converted to km
          ),
        ],
      },
      properties: {
        clusterId: cluster.id,
        seniorCount: cluster.seniors?.length || 0,
        radius: cluster.radius,
      },
    }));

    const source = map.current.getSource("cluster-circles");
    if (source && "setData" in source) {
      (source as mapboxgl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: features,
      });
    }
  };

  // --- Render all markers ---
  const renderMarkers = () => {
    if (!map.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Update cluster circles first
    updateClusterCircles();

    // Cluster markers
    clusters.forEach((cluster, idx) => {
      const el = document.createElement("div");
      el.className =
        "w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg cursor-pointer relative z-10";
      el.innerText = cluster.id.toString(); // Show actual cluster ID instead of senior count
      el.style.zIndex = "10"; // Reduced from 1000 so dialogs (z-50) overlay these

      // Add hover effect to highlight corresponding circle
      el.addEventListener("mouseenter", () => {
        map.current?.setPaintProperty("cluster-circles-layer", "fill-opacity", [
          "case",
          ["==", ["get", "clusterId"], cluster.id],
          0.4, // Highlighted opacity
          0.2, // Default opacity
        ]);
        map.current?.setPaintProperty("cluster-circles-outline", "line-width", [
          "case",
          ["==", ["get", "clusterId"], cluster.id],
          3, // Highlighted width
          2, // Default width
        ]);
      });

      el.addEventListener("mouseleave", () => {
        map.current?.setPaintProperty(
          "cluster-circles-layer",
          "fill-opacity",
          0.2
        );
        map.current?.setPaintProperty(
          "cluster-circles-outline",
          "line-width",
          2
        );
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([cluster.center.lng, cluster.center.lat])
        .addTo(map.current!);

      el.addEventListener("click", () => {
        setHighlightedCluster(idx);

        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }

        // Fit map to cluster bounds if seniors exist

        if (cluster.seniors && cluster.seniors.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          cluster.seniors.forEach((senior) => {
            if (senior.coords) {
              bounds.extend([senior.coords.lng, senior.coords.lat]);
            }
          });
          map.current?.fitBounds(bounds, { padding: 50 });
        }
      });

      markersRef.current.push(marker);
    });

    const seniorMarkerElements = new Map();

    // Senior markers
    seniors.forEach((s) => {
      if (!s.coords) return;

      const assessment = getPriorityLevel(s.overall_wellbeing);
      const isInHighlightedCluster =
        highlightedCluster !== null &&
        clusters[highlightedCluster]?.seniors?.some(
          (clusterSenior) => clusterSenior.uid === s.uid
        );

      const isIndividuallyHighlighted = s.uid === highlightedSeniorId;
      const isLocallyFocused = s.uid === locallyFocusedSeniorId;
      const focused =
        isInHighlightedCluster || isIndividuallyHighlighted || isLocallyFocused;

      const colorClass = priorityColors[assessment];
      const sizeClass = focused ? "w-8 h-8" : "w-6 h-6";
      const borderClass = focused
        ? "border-4 border-purple-500"
        : "border-2 border-white";

      const el = document.createElement("div");
      el.className = `${sizeClass} ${colorClass} rounded-full ${borderClass} shadow-md cursor-pointer flex items-center justify-center text-xs relative z-20`;
      el.style.zIndex = "1001"; // Ensure it's above cluster circles and layers
      el.innerText = "👤";
      seniorMarkerElements.set(s.uid, el);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([s.coords.lng, s.coords.lat])
        .addTo(map.current!);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setHighlightedCluster(null);
        setLocallyFocusedSeniorId(s.uid);
        setLocallyFocusedVolunteerId(null);

        map.current?.flyTo({
          center: [s.coords.lng, s.coords.lat],
          zoom: Math.max(map.current!.getZoom(), 15),
          essential: true,
        });

        showSeniorPopup(s, assessment);
      });
      markersRef.current.push(marker);
    });

    // Volunteer markers
    volunteers.forEach((v) => {
      if (!v.coords) return;

      const isIndividuallyHighlighted = v.vid === highlightedVolunteerId;
      const isLocallyFocused = v.vid === locallyFocusedVolunteerId;
      const focused = isIndividuallyHighlighted || isLocallyFocused;

      const sizeClass = focused ? "w-8 h-8" : "w-6 h-6";
      const borderClass = focused
        ? "border-4 border-purple-500"
        : "border-2 border-white";

      const el = document.createElement("div");
      el.className = `${sizeClass} bg-blue-500 rounded-full ${borderClass} shadow-md cursor-pointer flex items-center justify-center text-xs relative z-20`;
      el.style.zIndex = "1001"; // Ensure it's above cluster circles and layers
      el.innerText = "🙋";

      const marker = new mapboxgl.Marker(el)
        .setLngLat([v.coords.lng, v.coords.lat])
        .addTo(map.current!);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setHighlightedCluster(null);
        setLocallyFocusedSeniorId(null);
        setLocallyFocusedVolunteerId(v.vid);

        map.current?.flyTo({
          center: [v.coords.lng, v.coords.lat],
          zoom: Math.max(map.current!.getZoom(), 15),
          essential: true,
        });

        showVolunteerPopup(v);
      });
      markersRef.current.push(marker);
    });
  };

  // Helper to calculate week boundaries with Sunday special case
  const getWeekBoundaries = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    let startOfWeek: Date;

    if (currentDay === 0) {
      // If today is Sunday, start from today (Sunday)
      startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
    } else {
      // For any other day, get Monday of current week
      startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - currentDay + 1); // Monday of this week
      startOfWeek.setHours(0, 0, 0, 0);
    }

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // 6 days later
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek };
  };

  // Helper to check if volunteer is active this week
  const isVolunteerActiveThisWeek = (volunteerId: string) => {
    const { startOfWeek, endOfWeek } = getWeekBoundaries();

    return schedules.some((schedule) => {
      if (schedule.volunteer !== volunteerId) return false;

      const scheduleDate = new Date(schedule.datetime.split("T")[0]);
      return scheduleDate >= startOfWeek && scheduleDate <= endOfWeek;
    });
  };

  // Helper functions for popups
  const escapeHtml = (text: string) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const getWellbeingIcon = (score: number | undefined) => {
    if (score === undefined) return "❓";
    if (score <= 2) return "🔴";
    if (score <= 3) return "🟡";
    return "🟢";
  };

  const getSkillIcon = (skill: number) => {
    if (skill >= 3) return "⭐";
    if (skill >= 2) return "🟡";
    return "🔴";
  };

  const createSeniorPopupHTML = (
    senior: Senior,
    priority: "HIGH" | "MEDIUM" | "LOW"
  ) => {
    const lastVisit = senior.last_visit
      ? new Date(senior.last_visit).toLocaleDateString()
      : "Never visited";

    const priorityStyles = {
      HIGH: "bg-red-100 text-red-800",
      MEDIUM: "bg-yellow-100 text-yellow-800",
      LOW: "bg-green-100 text-green-800",
    };

    const wellbeingItems = [
      {
        icon: getWellbeingIcon(senior.physical),
        label: "Physical Health",
        value: senior.physical,
      },
      {
        icon: getWellbeingIcon(senior.mental),
        label: "Mental Health",
        value: senior.mental,
      },
      {
        icon: getWellbeingIcon(senior.community),
        label: "Community",
        value: senior.community,
      },
    ];

    const visitStatus = senior.last_visit
      ? `Last visited: ${lastVisit}`
      : "Never visited - needs attention";

    return `
    <div class="w-60 p-0 bg-white rounded-lg">
      <div class="pb-1">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">👤</div>
          <div class="flex-1">
            <h3 class="font-semibold text-base text-gray-900">${escapeHtml(
              senior.name || senior.uid
            )}</h3>
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              priorityStyles[priority]
            }">
              ${priority} Priority
            </span>
          </div>
        </div>
        
        <div class="space-y-2">
          <div class="p-2 bg-orange-50 border border-orange-200 rounded">
            <span class="text-xs text-orange-800 font-medium">📅 ${visitStatus}</span>
          </div>
          
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">Wellbeing Status</h4>
            <div class="space-y-2">
              ${wellbeingItems
                .map(
                  (item) => `
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600 flex items-center gap-2">
                    ${item.icon} ${item.label}
                  </span>
                  <span class="text-sm font-medium">
                    ${
                      item.value !== undefined
                        ? wellbeingLabels[item.value]
                        : "Unknown"
                    }
                  </span>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
          
          ${
            senior.cluster
              ? `
          <div class="pt-2 border-t border-gray-100">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 flex items-center gap-2">📍 Cluster</span>
              <span class="text-sm font-medium">${senior.cluster}</span>
            </div>
          </div>
          `
              : ""
          }
        </div>
      </div>
    </div>
  `;
  };

  const createVolunteerPopupHTML = (
    volunteer: Volunteer,
    assignment?: Assignment
  ) => {
    const isActive = isVolunteerActiveThisWeek(volunteer.vid);
    const availabilityStyle = isActive
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-800";
    const availabilityText = isActive ? "Active" : "Inactive";

    return `
    <div class="w-60 p-0 bg-white rounded-lg">
      <div class="pb-1">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">🙋</div>
          <div class="flex-1">
            <h3 class="font-semibold text-base text-gray-900">${escapeHtml(
              volunteer.name || volunteer.vid
            )}</h3>
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
                  ${getSkillIcon(volunteer.skill)} Skill Level
                </span>
                <span class="text-sm font-medium">${volunteer.skill}/3</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 flex items-center gap-2">📍 Assignment</span>
                <span class="text-sm font-medium">
                  ${
                    assignment
                      ? `Cluster ${assignment.cluster}`
                      : "Not Assigned"
                  }
                </span>
              </div>
              ${
                assignment && assignment.distance
                  ? `
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 flex items-center gap-2">📏 Distance</span>
                <span class="text-sm font-medium">${assignment.distance.toFixed(
                  1
                )} km</span>
              </div>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  };

  // --- Popups ---
  const showSeniorPopup = (s: Senior, priority?: "HIGH" | "MEDIUM" | "LOW") => {
    if (!map.current) return;
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    const displayPriority = priority || "LOW";
    const popupHTML = createSeniorPopupHTML(s, displayPriority);

    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: true,
      closeOnMove: false,
      focusAfterOpen: true,
      maxWidth: "500",
      className: "popup-above-circles",
    })
      .setLngLat([s.coords.lng, s.coords.lat])
      .setHTML(popupHTML)
      .addTo(map.current);

    // Ensure popup is above all markers
    const popupElement = popupRef.current.getElement();
    if (popupElement) {
      popupElement.style.zIndex = "10000";
    }

    popupRef.current.on("close", () => {
      popupRef.current = null;
    });
  };

  const showVolunteerPopup = (v: Volunteer) => {
    if (!map.current) return;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    // Get assignment from current week's schedules only
    const { startOfWeek, endOfWeek } = getWeekBoundaries();
    const currentWeekSchedule = schedules.find((schedule) => {
      if (schedule.volunteer !== v.vid) return false;
      const scheduleDate = new Date(schedule.datetime.split("T")[0]);
      return scheduleDate >= startOfWeek && scheduleDate <= endOfWeek;
    });

    // Create assignment object from current week's schedule
    const assignment = currentWeekSchedule
      ? {
          volunteer: currentWeekSchedule.volunteer,
          cluster: currentWeekSchedule.cluster.toString(),
          distance:
            assignments.find((a) => a.volunteer === v.vid)?.distance || 0,
        }
      : undefined;

    const popupHTML = createVolunteerPopupHTML(v, assignment);

    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: true,
      closeOnMove: false,
      focusAfterOpen: true,
      maxWidth: "500",
      className: "popup-above-circles",
    })
      .setLngLat([v.coords.lng, v.coords.lat])
      .setHTML(popupHTML)
      .addTo(map.current);

    // Ensure popup is above all markers
    const popupElement = popupRef.current.getElement();
    if (popupElement) {
      popupElement.style.zIndex = "10000";
    }

    popupRef.current.on("close", () => {
      popupRef.current = null;
    });
  };

  return (
    <div className="w-full h-[600px] relative overflow-hidden">
      <style jsx>{`
        :global(.mapboxgl-popup) {
          z-index: 10000 !important;
        }
        :global(.mapboxgl-popup-content) {
          z-index: 10001 !important;
        }
        :global(.popup-above-circles .mapboxgl-popup-content) {
          background: white !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3) !important;
          border-radius: 8px !important;
        }
      `}</style>
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <div className="text-center p-4 max-w-md">
            <p className="text-destructive font-medium">
              Map Configuration Required:
            </p>
            <p className="text-sm text-muted-foreground mt-2">{mapError}</p>
          </div>
        </div>
      )}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      )}
      <div
        ref={mapContainer}
        className="w-full h-full rounded-lg"
        style={{ position: "relative", zIndex: 1 }}
      />

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg"
        style={{ zIndex: 10 }}
      >
        <h4 className="text-xs font-medium mb-2">Legend</h4>
        <div className="space-y-1">
          <LegendItem color="bg-red-500" label="High Priority Senior" />
          <LegendItem color="bg-yellow-500" label="Medium Priority Senior" />
          <LegendItem color="bg-green-500" label="Low Priority Senior" />
          <LegendItem color="bg-blue-500" label="Volunteer" />
          <LegendItem color="bg-purple-500" label="Cluster" />
        </div>
        {highlightedCluster !== null && clusters[highlightedCluster] && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs text-purple-600 font-medium mb-1">
              Cluster {clusters[highlightedCluster].id} in focus
            </div>
            {(() => {
              const seniors = clusters[highlightedCluster].seniors || [];
              const high = seniors.filter(
                (s) => s && s.overall_wellbeing === 1
              ).length;
              const medium = seniors.filter(
                (s) => s && s.overall_wellbeing === 2
              ).length;
              const low = seniors.filter(
                (s) => s && s.overall_wellbeing === 3
              ).length;
              return (
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full inline-block" />{" "}
                    High: {high}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full inline-block" />{" "}
                    Medium: {medium}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />{" "}
                    Low: {low}
                  </div>
                  <div className="mt-1">Total seniors: {seniors.length}</div>
                </div>
              );
            })()}
            <div className="text-xs text-gray-500 mt-1">
              Click elsewhere to clear
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 ${color} rounded-full`} />
      <span className="text-xs">{label}</span>
    </div>
  );
}
