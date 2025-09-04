"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Interfaces remain unchanged
interface ScheduleProps {
  schedules: Array<{
    volunteer: string;
    senior: string;
    cluster: number | string;
    date: string;
    start_time: string;
    end_time: string;
    priority_score: number;
  }>;
  volunteers: Array<{
    vid: string;
    name: string;
    coords: { lat: number; lng: number };
    skill: number;
    available: boolean | string[];
  }>;
  seniors: Array<{
    uid: string;
    name: string;
  }>;
  assignments: Array<{
    volunteer: string;
    cluster: string;
    distance: number;
  }>;
}

export function ScheduleInterface({
  schedules,
  volunteers,
  seniors = [],
  assignments,
}: ScheduleProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Generate time slots (9 AM to 6 PM)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 9; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour < 18) slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return slots;
  }, []);

  // Helpers
  const getVolunteerName = (vid: string) =>
    volunteers.find((v) => v.vid === vid)?.name || vid;

  const getSeniorName = (uid: string) =>
    seniors.find((s) => s.uid === uid)?.name || uid;

  // Week days (7 days from today)
  const weekDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  }, []);

  // Schedules grouped by date
  const weekSchedules = useMemo(() => {
    const weekData: Record<string, typeof schedules> = {};
    weekDays.forEach((day) => {
      const dayKey = day.toISOString().split("T")[0];
      weekData[dayKey] = schedules.filter((s) => s.date === dayKey);
    });
    return weekData;
  }, [schedules, weekDays]);

  const openDayDrawer = (dayKey: string) => {
    setSelectedDay(dayKey);
    setIsDrawerOpen(true);
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
                <Calendar className="h-5 w-5" /> Weekly Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, index) => {
                  const dayKey = day.toISOString().split("T")[0];
                  const daySchedules = weekSchedules[dayKey] || [];
                  const isToday =
                    day.toDateString() === new Date().toDateString();

                  return (
                    <Card
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
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
                              <div>{schedule.start_time}</div>
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
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  <span>
                    {selectedDay &&
                      new Date(selectedDay).toLocaleDateString("en-SG", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-2">
                {selectedDay &&
                  timeSlots.map((timeSlot) => {
                    const schedulesAtTime = (weekSchedules[selectedDay] || []).filter(
                      (s) => s.start_time === timeSlot
                    );
                    return (
                      <div
                        key={timeSlot}
                        className="flex items-start gap-4 p-2 border-b border-border/50"
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
                                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
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
                                      {schedule.start_time} - {schedule.end_time}
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
                        selectedVolunteer === volunteer.vid
                          ? "default"
                          : "outline"
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
                      (selectedVolunteer === null ||
                        vol.vid === selectedVolunteer) &&
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
                                  {assignment
                                    ? `Assigned to ${assignment.cluster}`
                                    : "No assignment"}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={
                                volunteer.available ? "default" : "secondary"
                              }
                            >
                              {volunteer.available
                                ? "Available"
                                : "Unavailable"}
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
                                    <span className="text-sm">
                                      {schedule.date}
                                    </span>
                                    <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                                    <span className="text-sm">
                                      {schedule.start_time}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                      Cluster: {schedule.cluster}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Senior: {getSeniorName(schedule.senior)}
                                    </span>
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