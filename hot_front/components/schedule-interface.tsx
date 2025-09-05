"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  CalendarDays, // new icon for "Weekly Overview"
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
interface ScheduleProps {
  assignments: Array<{
    volunteer: string;
    cluster: string;
    distance: number;
  }>;
}

export function ScheduleInterface({ assignments }: ScheduleProps) {
  const [schedules, setSchedules] = useState<
    Array<{
      volunteer: string;
      senior: string;
      cluster: number | string;
      date: string;
      start_time: string;
      end_time: string;
      priority_score: number;
    }>
  >([]);
  const [volunteers, setVolunteers] = useState<
    Array<{
      vid: string;
      name: string;
      coords: { lat: number; lng: number };
      skill: number;
      available: boolean | string[];
    }>
  >([]);
  const [seniors, setSeniors] = useState<
    Array<{
      uid: string;
      name: string;
    }>
  >([]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Format time as HH:MM (supports HH:MM:SS)
  const formatTime = (timeString: string) => {
    if (!timeString) return timeString;
    const [hh = "", mm = ""] = timeString.split(":");
    return `${hh}:${mm}`;
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
    const fetchData = async () => {
      try {
        const schedulesResponse = await fetch("http://localhost:8000/assignments");
        if (!schedulesResponse.ok) {
          console.error("Failed to fetch schedules:", schedulesResponse.status);
          return;
        }
        const schedulesData = await schedulesResponse.json();

        const volunteersResponse = await fetch("http://localhost:8000/volunteers");
        const volunteersData = await volunteersResponse.json();

        const seniorsResponse = await fetch("http://localhost:8000/seniors");
        const seniorsData = await seniorsResponse.json();

        // Map database fields to component interface
        const assignmentsArray = schedulesData.assignments || schedulesData || [];
        const mappedSchedules = assignmentsArray.map((assignment: any) => ({
          volunteer:
            assignment.vid || assignment.volunteer_id || assignment.volunteer,
          senior: assignment.sid || assignment.senior_id || assignment.senior,
          cluster: assignment.cluster_id || assignment.cluster,
          date: assignment.date || assignment.scheduled_date,
          start_time: formatTime(assignment.start_time || "09:00"),
          end_time: formatTime(assignment.end_time || "10:00"),
          priority_score: assignment.priority_score || 1,
        }));

        setSchedules(mappedSchedules);
        setVolunteers(volunteersData.volunteers || volunteersData || []);
        setSeniors(seniorsData.seniors || seniorsData || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    fetchData();
  }, []);

  // Helpers
  const getVolunteerName = (vid: string) =>
    volunteers.find((v) => v.vid === vid)?.name || vid;

  const getSeniorName = (uid: string) =>
    seniors.find((s) => s.uid === uid)?.name || uid;

  // Week days (7 days from today)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
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

  // Schedules grouped by date
  const weekSchedules = useMemo(() => {
    const weekData: Record<string, typeof schedules> = {};
    weekDays.forEach((day) => {
      const dayKey = day.toISOString().split("T")[0];
      weekData[dayKey] = schedules.filter((s) => {
        const scheduleDate = s.date;
        return scheduleDate === dayKey || scheduleDate?.startsWith(dayKey);
      });
    });
    return weekData;
  }, [schedules, weekDays]);

  const openDayDrawer = (dayKey: string) => {
    setSelectedDay(dayKey);
    setIsDrawerOpen(true);
  };

  // Drawer day navigation (within this week)
  const changeDay = (delta: number) => {
    if (!selectedDay) return;
    const idx = weekDays.findIndex(
      (d) => d.toISOString().split("T")[0] === selectedDay
    );
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= weekDays.length) return;
    setSelectedDay(weekDays[newIdx].toISOString().split("T")[0]);
  };

  const selectedDateObj = selectedDay ? new Date(selectedDay) : null;
  const selectedIndex = selectedDay
    ? weekDays.findIndex((d) => d.toISOString().split("T")[0] === selectedDay)
    : -1;

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
                  const dayKey = day.toISOString().split("T")[0];
                  const daySchedules = weekSchedules[dayKey] || [];
                  const isToday = day.toDateString() === new Date().toDateString();

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
                          {daySchedules.slice(0, 3).map((schedule, idx) => (
                            <div
                              key={idx}
                              className="text-xs p-1 bg-muted rounded text-center"
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
                    timeSlots.map((timeSlot) => {
                      const schedulesAtTime = (weekSchedules[selectedDay] || []).filter(
                        (s) => formatTime(s.start_time) === timeSlot
                      );
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
                            {schedulesAtTime.length === 0 ? (
                              <div className="text-sm text-muted-foreground italic">
                                No visits scheduled
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {schedulesAtTime.map((schedule, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-chart-4" />
                                        <span className="font-medium">
                                          {getVolunteerName(schedule.volunteer)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-chart-2" />
                                        <span className="text-sm">
                                          Cluster {schedule.cluster}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">
                                        {formatTime(schedule.start_time)} –{" "}
                                        {formatTime(schedule.end_time)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                {volunteers
                  .filter((v) =>
                    v.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((volunteer) => (
                    <Button
                      key={volunteer.vid}
                      variant={
                        selectedVolunteer === volunteer.vid ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setSelectedVolunteer(volunteer.vid)}
                    >
                      {volunteer.name}
                    </Button>
                  ))}
              </div>

              {/* Volunteer schedules */}
              <div className="space-y-4">
                {volunteers
                  .filter(
                    (vol) =>
                      (selectedVolunteer === null || vol.vid === selectedVolunteer) &&
                      vol.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((volunteer) => {
                    const volunteerSchedules = schedules.filter(
                      (s) => s.volunteer === volunteer.vid
                    );
                    const assignment = assignments.find(
                      (a) => a.volunteer === volunteer.vid
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
                                <h4 className="font-medium">{volunteer.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {assignment ? `Assigned to ${assignment.cluster}` : "No assignment"}
                                </p>
                              </div>
                            </div>
                            <Badge variant={volunteer.available ? "default" : "secondary"}>
                              {volunteer.available ? "Available" : "Unavailable"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {volunteerSchedules.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">
                              No scheduled visits
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {volunteerSchedules.map((schedule, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-muted/30 rounded"
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{schedule.date}</span>
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
                                    <Badge variant="outline">
                                      Cluster: {schedule.cluster}
                                    </Badge>
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
