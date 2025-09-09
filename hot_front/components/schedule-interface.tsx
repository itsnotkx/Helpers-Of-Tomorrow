"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  Calendar,
  Clock,
  User,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Interfaces remain unchanged
interface Assignment {
  volunteer: string;
  cluster: string;
  distance: number;
}

interface Schedule {
  volunteer: string;
  senior: string;
  cluster: number | string;
  date: string;
  start_time: string;
  end_time: string;
  priority_score: number;
  is_acknowledged: boolean;
}

interface Volunteer {
  vid: string;
  name: string;
  coords: { lat: number; lng: number };
  skill: number;
  available: boolean | string[];
  constituency_name?: string;
}

interface Senior {
  uid: string;
  name: string;
  address?: string;
  constituency_name?: string;
}

interface ScheduleProps {
  assignments: Assignment[];
  selectedDistrict?: string;
}

export function ScheduleInterface({
  assignments,
  selectedDistrict,
}: ScheduleProps) {
  // helper: tell the map to zoom & highlight a volunteer
  const focusVolunteerOnMap = (vid: string) => {
    window.dispatchEvent(
      new CustomEvent("focus-volunteer", { detail: { vid } })
    );
  };

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [seniors, setSeniors] = useState<Senior[]>([]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Format utilities
  const formatTime = (timeString: string) =>
    timeString ? timeString.split(":").slice(0, 2).join(":") : timeString;
  const formatDate = (dateString: string) => {
    if (!dateString) return dateString;
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, "0")}-${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-${date.getFullYear()}`;
  };

  // Reusable acknowledgment badge component
  const AcknowledgmentBadge = ({
    isAcknowledged,
  }: {
    isAcknowledged: boolean;
  }) => (
    <Badge
      variant={isAcknowledged ? "default" : "secondary"}
      className={
        isAcknowledged
          ? "bg-green-600 hover:bg-green-700 text-white"
          : "bg-orange-100 text-orange-700 border-orange-200"
      }
    >
      {isAcknowledged ? "Acknowledged" : "Pending"}
    </Badge>
  );

  // Reusable person info card
  const PersonCard = ({
    type,
    name,
    color,
  }: {
    type: string;
    name: string;
    color: "blue" | "red";
  }) => {
    const colorClasses = {
      blue: {
        bg: "bg-blue-50",
        border: "border-l-blue-500",
        icon: "text-blue-600",
        typeText: "text-blue-700",
        nameText: "text-blue-900",
      },
      red: {
        bg: "bg-red-50",
        border: "border-l-red-500",
        icon: "text-red-600",
        typeText: "text-red-700",
        nameText: "text-red-900",
      },
    };

    const classes = colorClasses[color];

    return (
      <div
        className={`flex items-center gap-2 p-2 ${classes.bg} rounded border-l-4 ${classes.border}`}
      >
        <User className={`h-4 w-4 ${classes.icon}`} />
        <div>
          <div
            className={`text-xs font-medium ${classes.typeText} uppercase tracking-wide`}
          >
            {type}
          </div>
          <div className={`font-medium ${classes.nameText}`}>{name}</div>
        </div>
      </div>
    );
  };

  // Generate time slots (9 AM to 6 PM)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 9; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour < 18) slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return slots;
  }, []);

  // Fetch from backend
  useEffect(() => {
    const fetchData = async (retryCount = 0) => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000; // 1 second

      try {
        const BASE_URL =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 10000);

        const schedulesResponse = await fetch(`${BASE_URL}/assignments`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: timeoutController.signal,
        });
        clearTimeout(timeoutId);

        if (!schedulesResponse.ok) {
          throw new Error(
            `Failed to fetch schedules: ${schedulesResponse.status} ${schedulesResponse.statusText}`
          );
        }
        const schedulesData = await schedulesResponse.json();

        const volunteersController = new AbortController();
        const volunteersTimeoutId = setTimeout(
          () => volunteersController.abort(),
          10000
        );

        const volunteersResponse = await fetch(`${BASE_URL}/volunteers`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: volunteersController.signal,
        });
        clearTimeout(volunteersTimeoutId);

        if (!volunteersResponse.ok) {
          throw new Error(
            `Failed to fetch volunteers: ${volunteersResponse.status} ${volunteersResponse.statusText}`
          );
        }
        const volunteersData = await volunteersResponse.json();

        const seniorsController = new AbortController();
        const seniorsTimeoutId = setTimeout(
          () => seniorsController.abort(),
          10000
        );

        const seniorsResponse = await fetch(`${BASE_URL}/seniors`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: seniorsController.signal,
        });
        clearTimeout(seniorsTimeoutId);

        if (!seniorsResponse.ok) {
          throw new Error(
            `Failed to fetch seniors: ${seniorsResponse.status} ${seniorsResponse.statusText}`
          );
        }
        const seniorsData = await seniorsResponse.json();

        const assignmentsArray =
          schedulesData.assignments || schedulesData || [];
        const mappedSchedules = assignmentsArray.map(
          (assignment: {
            vid?: string;
            volunteer_id?: string;
            volunteer?: string;
            sid?: string;
            senior_id?: string;
            senior?: string;
            cluster_id?: number | string;
            cluster?: number | string;
            date?: string;
            scheduled_date?: string;
            start_time?: string;
            end_time?: string;
            priority_score?: number;
            is_acknowledged?: boolean;
          }) => ({
            volunteer:
              assignment.vid || assignment.volunteer_id || assignment.volunteer,
            senior: assignment.sid || assignment.senior_id || assignment.senior,
            cluster: assignment.cluster_id || assignment.cluster,
            date: assignment.date || assignment.scheduled_date,
            start_time: formatTime(assignment.start_time || "09:00"),
            end_time: formatTime(assignment.end_time || "10:00"),
            priority_score: assignment.priority_score || 1,
            is_acknowledged: assignment.is_acknowledged || false,
          })
        );

        setSchedules(mappedSchedules);
        setVolunteers(volunteersData.volunteers || volunteersData || []);
        setSeniors(seniorsData.seniors || seniorsData || []);

        if (process.env.NODE_ENV === "development") {
          console.log("Successfully fetched all data");
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            `Failed to fetch data (attempt ${retryCount + 1}):`,
            error
          );
        }

        if (retryCount < MAX_RETRIES - 1) {
          if (process.env.NODE_ENV === "development") {
            console.log(`Retrying in ${RETRY_DELAY}ms...`);
          }
          setTimeout(() => {
            fetchData(retryCount + 1);
          }, RETRY_DELAY * (retryCount + 1));
        }
      }
    };

    fetchData();
  }, []);

  // Helpers - simplified inline lookups with district filtering
  const getVolunteerName = (vid: string) =>
    volunteers.find((v) => v.vid === vid)?.name || vid;
  const getSeniorName = (uid: string) =>
    seniors.find((s) => s.uid === uid)?.name || uid;
  const getSeniorAddress = (uid: string) =>
    seniors.find((s) => s.uid === uid)?.address || "Address not available";

  // District filtering helper
  const filterByDistrict = <T extends { constituency_name?: string }>(
    items: T[]
  ): T[] => {
    if (!selectedDistrict || selectedDistrict === "All") {
      return items;
    }
    return items.filter((item) => item.constituency_name === selectedDistrict);
  };

  // Apply district filtering to data
  const filteredVolunteers = filterByDistrict(volunteers);
  const filteredSeniors = filterByDistrict(seniors);

  // Filter schedules to only include those with volunteers/seniors from selected district
  const filteredSchedules = schedules.filter((schedule) => {
    if (!selectedDistrict || selectedDistrict === "All") {
      return true;
    }

    const volunteer = volunteers.find((v) => v.vid === schedule.volunteer);
    const senior = seniors.find((s) => s.uid === schedule.senior);

    // Include schedule if either volunteer or senior is from selected district
    // This ensures we don't miss cross-district assignments
    return (
      volunteer?.constituency_name === selectedDistrict ||
      senior?.constituency_name === selectedDistrict
    );
  });

  // Week days (7 days from Monday to Sunday)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const startOfWeek = new Date(today);

    let daysBack: number;
    if (dayOfWeek === 0) {
      daysBack = 6;
    } else {
      daysBack = dayOfWeek - 1;
    }

    startOfWeek.setDate(today.getDate() - daysBack);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }

    return days;
  }, []);

  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[weekDays.length - 1];
    if (!start || !end) return "";
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [weekDays]);

  // Helper function to format date without timezone issues
  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Schedules grouped by date (using filtered schedules)
  const weekSchedules = useMemo(() => {
    const weekData: Record<string, Schedule[]> = {};
    weekDays.forEach((day) => {
      const dayKey = formatDateKey(day);
      weekData[dayKey] = filteredSchedules.filter((s) => {
        const scheduleDate = s.date;
        const normalizedScheduleDate = scheduleDate?.split("T")[0];
        return normalizedScheduleDate === dayKey;
      });
    });

    if (process.env.NODE_ENV === "development") {
      console.log("Week schedules:", weekData);
    }

    return weekData;
  }, [filteredSchedules, weekDays]);

  const openDayDrawer = (dayKey: string) => {
    setSelectedDay(dayKey);
    setIsDrawerOpen(true);
  };

  // Drawer day navigation (within this week)
  const changeDay = (delta: number) => {
    if (!selectedDay) return;
    const idx = weekDays.findIndex((d) => formatDateKey(d) === selectedDay);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= weekDays.length) return;
    setSelectedDay(formatDateKey(weekDays[newIdx]));
  };

  const selectedDateObj = selectedDay ? new Date(selectedDay) : null;
  const selectedIndex = selectedDay
    ? weekDays.findIndex((d) => formatDateKey(d) === selectedDay)
    : -1;

  // Simplified weekly assignment helpers (using filtered schedules)
  const getVolunteerWeeklyAssignments = (volunteerId: string) => {
    const weekDayKeys = weekDays.map((day) => formatDateKey(day));
    return filteredSchedules.filter(
      (s) =>
        s.volunteer === volunteerId &&
        weekDayKeys.includes(s.date?.split("T")[0])
    ).length;
  };
  const isVolunteerActiveThisWeek = (volunteerId: string) =>
    getVolunteerWeeklyAssignments(volunteerId) > 0;

  // Filter volunteer schedules to current week only (using filtered schedules)
  const getVolunteerWeeklySchedules = (volunteerId: string) => {
    const weekDayKeys = weekDays.map((day) => formatDateKey(day));
    return filteredSchedules.filter(
      (s) =>
        s.volunteer === volunteerId &&
        weekDayKeys.includes(s.date?.split("T")[0])
    );
  };

  return (
    <div className="">
      <Tabs defaultValue="weekly" className="w-full gap-0">
        <TabsList className="grid w-full grid-cols-2 rounded-none">
          <TabsTrigger value="weekly">Weekly Overview</TabsTrigger>
          <TabsTrigger value="volunteers">By Volunteer</TabsTrigger>
        </TabsList>

        {/* Weekly Overview */}
        <TabsContent value="weekly">
          <Card className="rounded-t-none border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Weekly Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {weekDays.map((day, index) => {
                  const dayKey = formatDateKey(day);
                  const daySchedules = weekSchedules[dayKey] || [];
                  const isToday =
                    day.toDateString() === new Date().toDateString();

                  return (
                    <Card
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                        isToday ? "bg-primary/10 border-primary" : "bg-card"
                      }`}
                      onClick={() => openDayDrawer(dayKey)}
                    >
                      <div className="text-center mb-2">
                        <div className="text-sm font-medium">
                          {day.toLocaleDateString("en-SG", {
                            weekday: "short",
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {day.getDate()}
                        </div>
                      </div>

                      {/* Collapsed summary */}
                      {daySchedules.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          No visits
                        </div>
                      ) : (
                        <>
                          <div className="text-xs font-medium text-center mb-1">
                            {daySchedules.length} visits
                          </div>
                          {daySchedules
                            .sort((a, b) => {
                              // Sort by start time (earliest first)
                              const timeA = new Date(
                                `1970-01-01T${a.start_time}:00`
                              );
                              const timeB = new Date(
                                `1970-01-01T${b.start_time}:00`
                              );
                              return timeA.getTime() - timeB.getTime();
                            })
                            .slice(0, 3)
                            .map((schedule, idx) => (
                              <div
                                key={idx}
                                className="text-xs p-1 bg-muted rounded text-center mb-1"
                              >
                                <div>{formatTime(schedule.start_time)}</div>
                                <div className="text-muted-foreground">
                                  {getSeniorName(schedule.senior)}
                                </div>
                              </div>
                            ))}
                          {daySchedules.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{daySchedules.length - 3} more
                            </div>
                          )}
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Drawer for daily details */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetContent
              side="right"
              // Full-screen drawer + clean padding
              className="w-screen sm:max-w-[100vw] p-0 overflow-y-auto"
            >
              {/* Sticky header inside drawer */}
              <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="mx-auto max-w-3xl px-4 md:px-6">
                  <SheetHeader>
                    <SheetTitle className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-1"
                          onClick={() => changeDay(-1)}
                          disabled={selectedIndex <= 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex flex-col">
                          <span className="text-base md:text-lg font-semibold">
                            {selectedDateObj &&
                              selectedDateObj.toLocaleDateString("en-SG", {
                                weekday: "long",
                                day: "numeric",
                                month: "short",
                              })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {weekRangeLabel}
                            {selectedVolunteer
                              ? ` • ${getVolunteerName(selectedVolunteer)}`
                              : ""}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => changeDay(1)}
                          disabled={selectedIndex >= weekDays.length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsDrawerOpen(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </SheetTitle>
                  </SheetHeader>
                </div>
              </div>

              {/* Drawer body */}
              <div className="mx-auto w-full max-w-3xl px-4 md:px-6 pb-12 pt-4">
                <div className="space-y-2">
                  {selectedDay &&
                    (() => {
                      const daySchedules = weekSchedules[selectedDay] || [];

                      if (daySchedules.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <div className="text-sm text-muted-foreground italic">
                              No visits scheduled for this day
                            </div>
                          </div>
                        );
                      }

                      // Group schedules by start time
                      const schedulesByTime = daySchedules.reduce(
                        (acc, schedule) => {
                          const time = formatTime(schedule.start_time);
                          if (!acc[time]) {
                            acc[time] = [];
                          }
                          acc[time].push(schedule);
                          return acc;
                        },
                        {} as Record<string, Schedule[]>
                      );

                      // Sort times chronologically
                      const sortedTimes = Object.keys(schedulesByTime).sort(
                        (a, b) => {
                          const timeA = new Date(`1970-01-01T${a}:00`);
                          const timeB = new Date(`1970-01-01T${b}:00`);
                          return timeA.getTime() - timeB.getTime();
                        }
                      );

                      return sortedTimes.map((timeSlot) => {
                        const schedulesAtTime = schedulesByTime[timeSlot];
                        return (
                          <div
                            key={timeSlot}
                            className="flex items-start gap-4 p-3 md:p-4 border-b border-border/50"
                          >
                            <div className="w-16 text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeSlot}
                            </div>
                            <div className="flex-1">
                              <div className="space-y-2">
                                {schedulesAtTime.map((schedule, idx) => (
                                  <div
                                    key={idx}
                                    className="p-4 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors border border-border/30"
                                  >
                                    {/* Time and address header */}
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">
                                          {formatTime(schedule.start_time)} –{" "}
                                          {formatTime(schedule.end_time)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-chart-2" />
                                        <span className="text-xs text-muted-foreground">
                                          {getSeniorAddress(schedule.senior)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Volunteer and Senior info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <PersonCard
                                        type="Volunteer"
                                        name={getVolunteerName(
                                          schedule.volunteer
                                        )}
                                        color="blue"
                                      />
                                      <PersonCard
                                        type="Senior"
                                        name={getSeniorName(schedule.senior)}
                                        color="red"
                                      />
                                    </div>

                                    {/* Acknowledgement Status */}
                                    <div className="mt-3 pt-3 border-t border-border/20">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                          Acknowledgement Status:
                                        </span>
                                        <AcknowledgmentBadge
                                          isAcknowledged={
                                            schedule.is_acknowledged
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* Volunteers */}
        <TabsContent value="volunteers">
          <Card className="rounded-t-none border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Volunteer Schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Search bar */}
              <div className="mb-4">
                <Input
                  placeholder="Search volunteers by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Volunteer selector */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={selectedVolunteer === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedVolunteer(null)}
                >
                  All Volunteers
                </Button>
                {filteredVolunteers
                  .filter((v) =>
                    v.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((volunteer) => (
                    <Button
                      key={volunteer.vid}
                      variant={
                        selectedVolunteer === volunteer.vid
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        setSelectedVolunteer(volunteer.vid);
                        focusVolunteerOnMap(volunteer.vid); // NEW
                      }}
                    >
                      {volunteer.name}
                    </Button>
                  ))}
              </div>

              {/* Volunteer schedules */}
              <div className="space-y-4">
                {filteredVolunteers
                  .filter(
                    (vol) =>
                      (selectedVolunteer === null ||
                        vol.vid === selectedVolunteer) &&
                      vol.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((volunteer) => {
                    const volunteerSchedules = getVolunteerWeeklySchedules(
                      volunteer.vid
                    );
                    const weeklyAssignments = getVolunteerWeeklyAssignments(
                      volunteer.vid
                    );
                    const isActive = isVolunteerActiveThisWeek(volunteer.vid);

                    // Get cluster assignment for this volunteer
                    const volunteerCluster =
                      volunteerSchedules.length > 0
                        ? volunteerSchedules[0].cluster
                        : null;

                    // Sort schedules by date and time
                    const sortedSchedules = [...volunteerSchedules].sort(
                      (a, b) => {
                        const dateA = new Date(`${a.date}T${a.start_time}`);
                        const dateB = new Date(`${b.date}T${b.start_time}`);
                        return dateA.getTime() - dateB.getTime();
                      }
                    );

                    return (
                      <Card key={volunteer.vid}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-chart-4 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <h4 className="font-medium">
                                  {volunteer.name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {weeklyAssignments > 0
                                    ? `${weeklyAssignments} assignment${
                                        weeklyAssignments > 1 ? "s" : ""
                                      } this week`
                                    : "No assignment"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {volunteerCluster && (
                                <Badge variant="outline" className="h-6">
                                  Cluster {volunteerCluster}
                                </Badge>
                              )}
                              <Badge
                                variant={isActive ? "default" : "secondary"}
                                className={
                                  isActive
                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                    : "bg-gray-400 hover:bg-gray-500 text-white"
                                }
                              >
                                {isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {sortedSchedules.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">
                              No scheduled visits
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {sortedSchedules.map((schedule, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-muted/30 rounded"
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">
                                      {formatDate(schedule.date)}
                                    </span>
                                    <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                                    <span className="text-sm">
                                      {formatTime(schedule.start_time)}
                                    </span>
                                    <User className="h-4 w-4 text-muted-foreground ml-2" />
                                    <span className="text-sm">
                                      {getSeniorName(schedule.senior)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <AcknowledgmentBadge
                                      isAcknowledged={schedule.is_acknowledged}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
