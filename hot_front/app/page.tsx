"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MapPin,
  Users,
  Calendar,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { InteractiveMap } from "@/components/interactive-map";
import { ScheduleInterface } from "@/components/schedule-interface";
import { DashboardHeader } from "@/components/dashboard-header";
import { useRef } from "react";
import { useUser } from "@clerk/nextjs";

// Add neighbourhood mapping
const SINGAPORE_NEIGHBOURHOODS = {
  yishun: [103.8454, 1.4382],
  tampines: [103.9568, 1.3496],
  jurong: [103.7436, 1.3404],
  bedok: [103.9273, 1.3236],
  hougang: [103.8924, 1.3612],
  sembawang: [103.8184, 1.4491],
  woodlands: [103.789, 1.4382],
  angMoKio: [103.8454, 1.3691],
  bishan: [103.8454, 1.3506],
  punggol: [103.9021, 1.4043],
  toapayoh: [103.8476, 1.3343],
  clementi: [103.7649, 1.3162],
  pasirRis: [103.9492, 1.3721],
  serangoon: [103.8698, 1.3554],
  bukit_batok: [103.7437, 1.3587],
  choa_chu_kang: [103.7444, 1.384],
  bukit_panjang: [103.7718, 1.3774],
  queenstown: [103.8057, 1.2966],
  kallang: [103.8614, 1.3111],
  marine_parade: [103.9057, 1.3017],
} as const;

type NeighbourhoodKey = keyof typeof SINGAPORE_NEIGHBOURHOODS;

interface Senior {
  uid: string;
  name: string;
  coords: { lat: number; lng: number };
  physical?: number;
  mental?: number;
  community?: number;
  last_visit?: string;
  cluster?: number;
  overall_wellbeing: 1 | 2 | 3;
}

interface Assessment {
  uid: string;
  risk: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  needscare: boolean;
}

interface Assignment {
  volunteer: string;
  cluster: string;
  distance: number;
}

interface Volunteer {
  vid: string;
  name: string;
  coords: { lat: number; lng: number };
  skill: number;
  available: boolean | string[];
}

interface Schedule {
  volunteer: string;
  senior: string;
  cluster: number;
  date: string;
  start_time: string;
  end_time: string;
  priority_score: number;
}

const getNeighbourhoodDisplayName = (key: NeighbourhoodKey): string => {
  const names: Record<NeighbourhoodKey, string> = {
    yishun: "Yishun",
    tampines: "Tampines",
    jurong: "Jurong",
    bedok: "Bedok",
    hougang: "Hougang",
    sembawang: "Sembawang",
    woodlands: "Woodlands",
    angMoKio: "Ang Mo Kio",
    bishan: "Bishan",
    punggol: "Punggol",
    toapayoh: "Toa Payoh",
    clementi: "Clementi",
    pasirRis: "Pasir Ris",
    serangoon: "Serangoon",
    bukit_batok: "Bukit Batok",
    choa_chu_kang: "Choa Chu Kang",
    bukit_panjang: "Bukit Panjang",
    queenstown: "Queenstown",
    kallang: "Kallang",
    marine_parade: "Marine Parade",
  };
  return names[key];
};

export default function VolunteerDashboard() {
  const [selectedNeighbourhood, setSelectedNeighbourhood] =
    useState<NeighbourhoodKey>("sembawang");
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);
  const [isScheduleCollapsed, setIsScheduleCollapsed] = useState(false);
  const [isAssignmentsCollapsed, setIsAssignmentsCollapsed] = useState(false);
  const [showHighRiskModal, setShowHighRiskModal] = useState(false);
  const [highlightedSeniorId, setHighlightedSeniorId] = useState<string | null>(
    null
  );
  const [highlightedVolunteerId, setHighlightedVolunteerId] = useState<
    string | null
  >(null);
  const [seniorMarkerElements, setSeniorMarkerElements] = useState<
    Map<string, HTMLElement>
  >(new Map());
  const [volunteerMarkerElements, setVolunteerMarkerElements] = useState<
    Map<string, HTMLElement>
  >(new Map());
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const { isLoaded, isSignedIn, user } = useUser();
  const [dlisLoading, setDLIsLoading] = useState(true);
  const [userSchedule, setUserSchedule] = useState<Volunteer>();
  const [userCoordinates, setUserCoordinates] = useState<[number, number]>([
    103.8198, 1.3521,
  ]);
  const [constituencyName, setConstituencyName] = useState<string>("Singapore");

  const wellbeingLabels: Record<number, string> = {
    1: "Very Poor",
    2: "Poor",
    3: "Normal",
    4: "Good",
    5: "Very Good",
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const BASE_URL = "http://localhost:8000";

      const [seniorsRes, volunteersRes, assignmentsRes] = await Promise.all([
        fetch(`${BASE_URL}/seniors`).then((r) => r.json()),
        fetch(`${BASE_URL}/volunteers`).then((r) => r.json()),
        fetch(`${BASE_URL}/assignments`).then((r) => r.json()),
      ]);

      setSeniors(seniorsRes.seniors);
      setVolunteers(volunteersRes.volunteers);
      setAssignments(assignmentsRes.assignments);

      // Derive assessments from seniors data
      const derivedAssessments = seniorsRes.seniors.map((senior: Senior) => ({
        uid: senior.uid,
        risk: senior.overall_wellbeing,
        priority:
          senior.overall_wellbeing === 1
            ? "HIGH"
            : senior.overall_wellbeing === 2
            ? "MEDIUM"
            : "LOW",
        needscare: senior.overall_wellbeing <= 2,
      }));
      setAssessments(derivedAssessments);

      // Derive schedules from assignments data
      const derivedSchedules = assignmentsRes.assignments.map(
        (assignment: any) => ({
          volunteer:
            assignment.vid || assignment.volunteer_id || assignment.volunteer,
          senior: assignment.sid || assignment.senior_id || assignment.senior,
          cluster: assignment.cluster_id || assignment.cluster,
          date:
            assignment.date ||
            assignment.scheduled_date ||
            new Date().toISOString().split("T")[0],
          start_time: assignment.start_time || "09:00",
          end_time: assignment.end_time || "10:00",
          priority_score: assignment.priority_score || 1,
        })
      );
      setSchedules(derivedSchedules);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      fetch_dl_details(user.primaryEmailAddress.emailAddress);
    }
  }, [isLoaded, isSignedIn, user]);

  async function fetch_dl_details(email: string) {
    try {
      setDLIsLoading(true);
      const BASE_URL = "http://localhost:8000";
      console.log(email);
      if (email != "") {
        const res = await fetch(`${BASE_URL}/dl/${email}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }).then((res) => res.json());

        console.log("Fetched user information:", res.dl_info[0]);
        if (res.dl_info[0] != null) {
          if (res.dl_info[0].coords) {
            setUserCoordinates([
              res.dl_info[0].coords.lng,
              res.dl_info[0].coords.lat,
            ]);
          }
          if (res.dl_info[0].constituency_name) {
            setConstituencyName(res.dl_info[0].constituency_name);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setDLIsLoading(false);
    }
  }

  if (!isLoaded && dlisLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Dashboard...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Function to handle volunteer card click
  const handleVolunteerCardClick = (volunteerId: string) => {
    const volunteer = volunteers.find((v) => v.vid === volunteerId);
    if (!volunteer) return;

    // Set highlighted volunteer
    setHighlightedVolunteerId(volunteerId);

    // Expand map if collapsed
    if (isMapCollapsed) {
      setIsMapCollapsed(false);
    }

    // Clear any senior highlights
    setHighlightedSeniorId(null);

    // Find the volunteer's marker and click it to show popup
    setTimeout(() => {
      const markerEl = volunteerMarkerElements.get(volunteerId);
      if (markerEl) {
        markerEl.click();
      }

      // Fly to volunteer's location
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [volunteer.coords.lng, volunteer.coords.lat],
          zoom: 18,
          essential: true,
        });
      }
    }, 100); // Small delay to ensure map is expanded
  };

  // Function to handle senior card click
  const handleSeniorCardClick = (seniorId: string) => {
    const senior = seniors.find((s) => s.uid === seniorId);
    if (!senior) return;

    // Set highlighted senior
    setHighlightedSeniorId(seniorId);

    // Expand map if collapsed
    if (isMapCollapsed) {
      setIsMapCollapsed(false);
    }

    // Clear any volunteer highlights
    setHighlightedVolunteerId(null);

    // Find the senior's marker and click it to show popup
    setTimeout(() => {
      const markerEl = seniorMarkerElements.get(seniorId);
      if (markerEl) {
        markerEl.click();
      }

      // Fly to senior's location
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [senior.coords.lng, senior.coords.lat],
          zoom: 18,
          essential: true,
        });
      }
    }, 100); // Small delay to ensure map is expanded
  };

  const levels: Record<1 | 2 | 3, string> = {
    3: "LOW", // Changed: wellbeing 3 = priority LOW
    2: "MEDIUM", // Changed: wellbeing 2 = priority MEDIUM
    1: "HIGH", // Changed: wellbeing 1 = priority HIGH
  };

  const highPrioritySeniors = seniors.filter(
    (s) => levels[s.overall_wellbeing] === "HIGH"
  );
  const highRiskCount = highPrioritySeniors.length;
  const activeVolunteers = volunteers.filter(
    (v) => Array.isArray(v.available) && v.available.length > 0
  ).length;
  const todaySchedules = schedules.filter(
    (s) => new Date(s.start_time).toDateString() === new Date().toDateString()
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Senior Care Volunteer Dashboard"
        subtitle={`Managing care for ${getNeighbourhoodDisplayName(
          selectedNeighbourhood
        )}`}
        selectedDistrict={getNeighbourhoodDisplayName(selectedNeighbourhood)}
        needButton={true}
        textToInput="Refresh Data"
        onRefresh={loadDashboardData}
      />

      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Seniors
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{seniors.length}</div>
              <p className="text-xs text-muted-foreground">
                {highRiskCount} high risk
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Active Volunteers
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeVolunteers}</div>
              <p className="text-xs text-muted-foreground">
                of {volunteers.length} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Visits
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todaySchedules.length}</div>
              <p className="text-xs text-muted-foreground">scheduled visits</p>
            </CardContent>
          </Card>

          <Dialog open={showHighRiskModal} onOpenChange={setShowHighRiskModal}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader className="flex justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    High Priority
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {highRiskCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    need immediate care
                  </p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  High Risk Seniors ({highRiskCount})
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {highPrioritySeniors.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No high-risk seniors at this time.
                  </p>
                ) : (
                  highPrioritySeniors.map((senior) => (
                    <div
                      key={senior.uid}
                      className="cursor-pointer rounded-lg border border-purple-500 p-4 hover:bg-purple-50 transition"
                      onClick={() => {
                        handleSeniorCardClick(senior.uid);
                        setShowHighRiskModal(false); // Close the modal
                      }}
                    >
                      <Card
                        key={senior.uid}
                        className="border-l-4 border-l-destructive"
                      >
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">
                                {senior.name || `Senior ${senior.uid}`}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                ID: {senior.uid}
                              </p>
                            </div>
                            <Badge variant="destructive">HIGH RISK</Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-sm font-medium">
                                Physical Health
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {senior.physical
                                  ? `${wellbeingLabels[senior.physical]}`
                                  : "Not assessed"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                Mental Health
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {senior.mental
                                  ? `${wellbeingLabels[senior.mental]}`
                                  : "Not assessed"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                Community Support
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {senior.community
                                  ? `${wellbeingLabels[senior.community]}`
                                  : "Not assessed"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Last Visit</p>
                              <p className="text-sm text-muted-foreground">
                                {senior.last_visit
                                  ? new Date(
                                      senior.last_visit
                                    ).toLocaleDateString()
                                  : "Never"}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium">Location</p>
                              <p className="text-sm text-muted-foreground">
                                {senior.coords.lat.toFixed(4)},{" "}
                                {senior.coords.lng.toFixed(4)}
                              </p>
                            </div>
                            {senior.cluster && (
                              <Badge variant="outline">
                                Cluster {senior.cluster}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="lg:col-span-2 mb-8">
          <CardHeader className="flex justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" /> District Map & Clusters
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMapCollapsed(!isMapCollapsed)}
            >
              {isMapCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {!isMapCollapsed && (
            <CardContent>
              <InteractiveMap
                // seniors={seniors}
                // volunteers={volunteers}
                // assignments={assignments}
                // schedules={schedules}
                highlightedSeniorId={highlightedSeniorId}
                // highlightedVolunteerId={highlightedVolunteerId}
                onMapUnfocus={() => {
                  setHighlightedSeniorId(null);
                  setHighlightedVolunteerId(null);
                }}
                centerCoordinates={
                  selectedNeighbourhood
                    ? (SINGAPORE_NEIGHBOURHOODS[selectedNeighbourhood] as [
                        number,
                        number
                      ])
                    : undefined
                }
                // onSeniorClick={() => setExpandedDay(null)} // <-- This closes the expanded card
                // seniorMarkerElements={seniorMarkerElements}
                // setSeniorMarkerElements={setSeniorMarkerElements}
                // volunteerMarkerElements={volunteerMarkerElements}
                // setVolunteerMarkerElements={setVolunteerMarkerElements}
                // mapRef={mapRef}
              />
            </CardContent>
          )}
        </div>
        <Card className={`lg:col-span-2 ${!isScheduleCollapsed ? "pb-0" : ""}`}>
          <CardHeader className="flex justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Scheduling Overview
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsScheduleCollapsed(!isScheduleCollapsed)}
            >
              {isScheduleCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {!isScheduleCollapsed && (
            <ScheduleInterface assignments={assignments} />
          )}
        </Card>
        <Card className="mt-6">
          <CardHeader className="flex justify-between">
            <CardTitle>Volunteer Dashboard</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAssignmentsCollapsed(!isAssignmentsCollapsed)}
            >
              {isAssignmentsCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {!isAssignmentsCollapsed && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {volunteers.map((v, i) => {
                  const assigned = assignments.filter(
                    (a) => a.volunteer === v.vid
                  );
                  const numSeniors = schedules.filter(
                    (s) => s.volunteer === v.vid
                  ).length;
                  const cluster = assigned[0]?.cluster ?? "-";
                  const distance = assigned[0]?.distance ?? "N/A";
                  const isHighlighted = highlightedVolunteerId === v.vid;

                  return (
                    <div
                      key={i}
                      className={`p-4 border rounded-lg cursor-pointer hover:bg-muted transition ${
                        isHighlighted
                          ? "border-blue-500 bg-blue-50 shadow-lg"
                          : ""
                      }`}
                      onClick={() => handleVolunteerCardClick(v.vid)}
                    >
                      <div className="flex justify-between mb-2">
                        <h4 className="font-medium">
                          {v.name || "Unknown Volunteer"}
                        </h4>
                        <Badge variant="secondary" className="h-6">
                          Cluster {cluster}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Seniors Assigned: {numSeniors}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Skill Level: {v.skill ?? "N/A"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Distance to Cluster: {distance} km
                      </p>
                      {isHighlighted && (
                        <div className="text-xs text-blue-600 mt-2 font-medium">
                          📍 Located on map
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
