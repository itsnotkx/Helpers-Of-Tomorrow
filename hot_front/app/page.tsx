"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { useUser } from "@clerk/nextjs";

export interface Senior {
  uid: string;
  name: string;
  coords: { lat: number; lng: number };
  physical?: number;
  mental?: number;
  community?: number;
  last_visit?: string;
  cluster?: number;
  overall_wellbeing: 1 | 2 | 3;
  address?: string;
}

export interface Assignment {
  volunteer: string;
  cluster: string;
  distance: number;
}

export interface Volunteer {
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

export interface Cluster {
  id: number;
  center: { lat: number; lng: number };
  radius: number;
  seniors?: Senior[];
}

export default function VolunteerDashboard() {
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const { isLoaded, isSignedIn, user } = useUser();
  const [dlisLoading, setDLIsLoading] = useState(true);
  const [userCoordinates, setUserCoordinates] = useState<[number, number]>();
  const [constituencyName, setConstituencyName] = useState<string>("Singapore");
  const [hasLoadedUserDetails, setHasLoadedUserDetails] = useState(false);

  const wellbeingLabels: Record<number, string> = {
    1: "Very Poor",
    2: "Poor", 
    3: "Normal",
    4: "Good",
    5: "Very Good",
  };

  // Unified priority mapping
  const getPriorityLevel = (wellbeing: 1 | 2 | 3): "HIGH" | "MEDIUM" | "LOW" => {
    return wellbeing === 1 ? "HIGH" : wellbeing === 2 ? "MEDIUM" : "LOW";
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const [seniorsRes, volunteersRes, assignmentsRes, clusterRes] = await Promise.all([
        fetch(`${BASE_URL}/seniors`).then((r) => r.json()),
        fetch(`${BASE_URL}/volunteers`).then((r) => r.json()),
        fetch(`${BASE_URL}/assignments`).then((r) => r.json()),
        fetch(`${BASE_URL}/clusters`).then((r) => r.json()),
      ]);

      setSeniors(seniorsRes.seniors);
      setVolunteers(volunteersRes.volunteers);
      setAssignments(assignmentsRes.assignments);
      setClusters(clusterRes.clusters);

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
    if (user?.primaryEmailAddress?.emailAddress && !hasLoadedUserDetails) {
      fetch_dl_details(user.primaryEmailAddress.emailAddress);
    }
  }, [isLoaded, isSignedIn, user, hasLoadedUserDetails]);

  // Memoize centerCoordinates to prevent unnecessary re-renders
  const memoizedCenterCoordinates = useMemo(() => {
    return userCoordinates ? (userCoordinates as [number, number]) : undefined;
  }, [userCoordinates]);

async function fetch_dl_details(email: string) {
  try {
    setDLIsLoading(true);
    const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    if (email != "") {
      const res = await fetch(`${BASE_URL}/dl/${email}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }).then((res) => res.json());

      console.log("Fetched user information:", res.dl_info[0]);
      if (res.dl_info[0] != null) {
        if (
          res.dl_info[0].constituency.centre_lat &&
          res.dl_info[0].constituency.centre_long
        ) {
          const coordinates: [number, number] = [
            res.dl_info[0].constituency.centre_long,
            res.dl_info[0].constituency.centre_lat,
          ];
          setUserCoordinates(coordinates);
          console.log("Setting user coordinates to:", coordinates); // Log the actual values being set
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
    setHasLoadedUserDetails(true); // Mark as loaded to prevent re-fetching
  }
}

  if (dlisLoading && !hasLoadedUserDetails) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Dashboard...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Unified function to handle map focus for both seniors and volunteers
  const handleMapFocus = (type: 'senior' | 'volunteer', id: string) => {
    const target = type === 'senior' 
      ? seniors.find((s) => s.uid === id)
      : volunteers.find((v) => v.vid === id);
    
    if (!target || !target.coords) return;

    // Set appropriate highlights
    if (type === 'senior') {
      setHighlightedSeniorId(id);
      setHighlightedVolunteerId(null);
    } else {
      setHighlightedVolunteerId(id);
      setHighlightedSeniorId(null);
    }

    // Expand map if collapsed
    if (isMapCollapsed) {
      setIsMapCollapsed(false);
    }

    // Dispatch custom event for map to handle
    setTimeout(() => {
      if (type === 'senior') {
        window.dispatchEvent(new CustomEvent('focus-senior', { detail: { uid: id } }));
      } else {
        window.dispatchEvent(new CustomEvent('focus-volunteer', { detail: { vid: id } }));
      }
    }, 100);
  };

  const highPrioritySeniors = seniors.filter(
    (s) => getPriorityLevel(s.overall_wellbeing) === "HIGH"
  );

  // Get current date boundaries for this week and this year
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const startOfWeek = new Date(now);

  if (currentDay === 0) {
    // If today is Sunday, start from today (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
  } else {
    // For any other day, get Monday of current week
    startOfWeek.setDate(now.getDate() - currentDay + 1); // Monday of this week
    startOfWeek.setHours(0, 0, 0, 0);
  }

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // 6 days later
  endOfWeek.setHours(23, 59, 59, 999);

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const today = new Date().toDateString();

  // Helper to get volunteer's assignments count for this week
  const getVolunteerWeeklyAssignments = (volunteerId: string) => {
    return schedules.filter((schedule) => {
      const scheduleDate = new Date(schedule.date);
      return (
        schedule.volunteer === volunteerId &&
        scheduleDate >= startOfWeek &&
        scheduleDate <= endOfWeek
      );
    }).length;
  };

  // Helper to check if volunteer is active this week
  const isVolunteerActiveThisWeek = (volunteerId: string) => {
    return getVolunteerWeeklyAssignments(volunteerId) > 0;
  };

  // Active volunteers: those with assignments this week
  const activeVolunteers = volunteers.filter((volunteer) =>
    isVolunteerActiveThisWeek(volunteer.vid)
  ).length;

  // Today's visits: schedules that match today's date
  const todaySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date).toDateString();
    return scheduleDate === today;
  });

  // Seniors needing immediate care: high priority AND not visited this year
  const seniorsNeedingImmediateCare = highPrioritySeniors.filter((senior) => {
    if (!senior.last_visit) return true; // Never visited
    const lastVisitDate = new Date(senior.last_visit);
    return lastVisitDate < startOfYear; // Not visited this year
  });

  const highRiskCount = highPrioritySeniors.length;
  const immediateCareCoun = seniorsNeedingImmediateCare.length;

  const sortedHighPrioritySeniors = [...highPrioritySeniors].sort((a, b) => {
    const aNeedsCare = seniorsNeedingImmediateCare.includes(a);
    const bNeedsCare = seniorsNeedingImmediateCare.includes(b);
    return aNeedsCare === bNeedsCare ? 0 : aNeedsCare ? -1 : 1;
  });
 
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Senior Care Volunteer Dashboard"
        subtitle={`Managing care for ${constituencyName}`}
        selectedDistrict={constituencyName}
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

          <Dialog open={showHighRiskModal} onOpenChange={setShowHighRiskModal}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader className="flex justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    High Risk Seniors
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {highRiskCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {immediateCareCoun} need immediate care
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
                  sortedHighPrioritySeniors.map((senior) => {
                    const needsImmediateCare =
                      seniorsNeedingImmediateCare.includes(senior);

                    return (
                      <div
                        key={senior.uid}
                        className="cursor-pointer rounded-lg border border-purple-500 p-4 hover:bg-purple-50 transition"
                        onClick={() => {
                          handleMapFocus('senior', senior.uid);
                          setShowHighRiskModal(false); // Close the modal
                        }}
                      >
                        <Card
                          className={`border-l-4 ${
                            needsImmediateCare
                              ? "border-l-red-600"
                              : "border-l-destructive"
                          }`}
                        >
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-semibold text-lg">
                                  {senior.name || `Senior ${senior.uid}`}
                                </h3>
                                {needsImmediateCare && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                    <span className="text-sm font-medium text-red-600">
                                      IMMEDIATE CARE NEEDED
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <Badge variant="destructive">HIGH RISK</Badge>
                              </div>
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
                                <p className="text-sm font-medium">
                                  Last Visit
                                </p>
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
                                  {senior.address ||
                                    `${senior.coords.lat.toFixed(
                                      4
                                    )}, ${senior.coords.lng.toFixed(4)}`}
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
                    );
                  })
                )}
              </div>
            </DialogContent>
          </Dialog>

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
                highlightedSeniorId={highlightedSeniorId}
                onMapUnfocus={() => {
                  setHighlightedSeniorId(null);
                  setHighlightedVolunteerId(null);
                }}
                centerCoordinates={memoizedCenterCoordinates}
                seniors={seniors}
                volunteers={volunteers}
                assignments={assignments}
                clusters={clusters}
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
                  const weeklyAssignments = getVolunteerWeeklyAssignments(
                    v.vid
                  );
                  const isActive = isVolunteerActiveThisWeek(v.vid);
                  const assigned = schedules.filter(
                    (a) => a.volunteer === v.vid
                  );
                  const cluster = assigned[0]?.cluster ?? "-";
                  const isHighlighted = highlightedVolunteerId === v.vid;
                  return (
                    <div
                      key={i}
                      className={`p-4 border rounded-lg cursor-pointer hover:bg-muted transition ${
                        isHighlighted
                          ? "border-blue-500 bg-blue-50 shadow-lg"
                          : ""
                      }`}
                      onClick={() => handleMapFocus('volunteer', v.vid)}
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
                        {weeklyAssignments > 0
                          ? `${weeklyAssignments} assignment${
                              weeklyAssignments > 1 ? "s" : ""
                            } this week`
                          : "No assignments this week"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Skill Level: {v.skill ?? "N/A"}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Status:{" "}
                        <Badge
                          variant={isActive ? "default" : "secondary"}
                          className={`text-xs ${
                            isActive
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "bg-gray-400 hover:bg-gray-500 text-white"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </Badge>
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
