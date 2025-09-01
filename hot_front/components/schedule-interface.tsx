"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, User, MapPin, ChevronLeft, ChevronRight } from "lucide-react"

interface ScheduleProps {
  schedules: Array<{
    volunteer: string
    cluster: string
    datetime: string
    duration: number
  }>
  volunteers: Array<{
    vid: string
    name: string
    coords: { lat: number; lng: number }
    skill: number
    available: boolean | string[]
  }>
  assignments: Array<{
    volunteer: string
    cluster: string
    distance: number
  }>
}

export function ScheduleInterface({ schedules, volunteers, assignments }: ScheduleProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(null)

  // Generate time slots for the day (9 AM to 6 PM)
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = 9; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`)
      if (hour < 18) {
        slots.push(`${hour.toString().padStart(2, "0")}:30`)
      }
    }
    return slots
  }, [])

  // Filter schedules for selected date
  const daySchedules = useMemo(() => {
    return schedules.filter((schedule) => {
      const scheduleDate = new Date(schedule.datetime)
      return scheduleDate.toDateString() === selectedDate.toDateString()
    })
  }, [schedules, selectedDate])

  // Group schedules by time slot
  const schedulesByTime = useMemo(() => {
    const grouped: Record<string, typeof daySchedules> = {}

    daySchedules.forEach((schedule) => {
      const time = new Date(schedule.datetime).toLocaleTimeString("en-SG", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })

      if (!grouped[time]) {
        grouped[time] = []
      }
      grouped[time].push(schedule)
    })

    return grouped
  }, [daySchedules])

  // Get volunteer name from ID
  const getVolunteerName = (vid: string) => {
    const volunteer = volunteers.find((v) => v.vid === vid)
    return volunteer?.name || vid
  }

  // Get next 7 days for week view
  const weekDays = useMemo(() => {
    const days = []
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      days.push(date)
    }
    return days
  }, [])

  // Get schedules for the week
  const weekSchedules = useMemo(() => {
    const weekData: Record<string, typeof schedules> = {}

    weekDays.forEach((day) => {
      const dayKey = day.toDateString()
      weekData[dayKey] = schedules.filter((schedule) => {
        const scheduleDate = new Date(schedule.datetime)
        return scheduleDate.toDateString() === dayKey
      })
    })

    return weekData
  }, [schedules, weekDays])

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate)
    newDate.setDate(selectedDate.getDate() + (direction === "next" ? 1 : -1))
    setSelectedDate(newDate)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Overview</TabsTrigger>
          <TabsTrigger value="volunteers">By Volunteer</TabsTrigger>
        </TabsList>

        {/* Daily Schedule View */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Daily Schedule
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Badge variant="outline" className="px-3">
                    {selectedDate.toLocaleDateString("en-SG", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => navigateDate("next")}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {timeSlots.map((timeSlot) => {
                  const schedulesAtTime = schedulesByTime[timeSlot] || []
                  return (
                    <div key={timeSlot} className="flex items-start gap-4 p-2 border-b border-border/50">
                      <div className="w-16 text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeSlot}
                      </div>
                      <div className="flex-1">
                        {schedulesAtTime.length === 0 ? (
                          <div className="text-sm text-muted-foreground italic">No visits scheduled</div>
                        ) : (
                          <div className="space-y-2">
                            {schedulesAtTime.map((schedule, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-chart-4" />
                                    <span className="font-medium">{getVolunteerName(schedule.volunteer)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-chart-2" />
                                    <span className="text-sm">{schedule.cluster}</span>
                                  </div>
                                </div>
                                <Badge variant="secondary">{schedule.duration} min</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Overview */}
        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, index) => {
                  const daySchedules = weekSchedules[day.toDateString()] || []
                  const isToday = day.toDateString() === new Date().toDateString()

                  return (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg ${isToday ? "bg-primary/10 border-primary" : "bg-card"}`}
                    >
                      <div className="text-center mb-2">
                        <div className="text-sm font-medium">
                          {day.toLocaleDateString("en-SG", { weekday: "short" })}
                        </div>
                        <div className="text-xs text-muted-foreground">{day.getDate()}</div>
                      </div>

                      <div className="space-y-1">
                        {daySchedules.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-2">No visits</div>
                        ) : (
                          <>
                            <div className="text-xs font-medium text-center mb-1">{daySchedules.length} visits</div>
                            {daySchedules.slice(0, 3).map((schedule, idx) => (
                              <div key={idx} className="text-xs p-1 bg-muted rounded text-center">
                                {new Date(schedule.datetime).toLocaleTimeString("en-SG", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                })}
                              </div>
                            ))}
                            {daySchedules.length > 3 && (
                              <div className="text-xs text-muted-foreground text-center">
                                +{daySchedules.length - 3} more
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Volunteer-specific schedules */}
        <TabsContent value="volunteers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Volunteer Schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Volunteer selector */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedVolunteer === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedVolunteer(null)}
                  >
                    All Volunteers
                  </Button>
                  {volunteers.map((volunteer) => (
                    <Button
                      key={volunteer.vid}
                      variant={selectedVolunteer === volunteer.vid ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedVolunteer(volunteer.vid)}
                    >
                      {getVolunteerName(volunteer.vid)}
                    </Button>
                  ))}
                </div>

                {/* Volunteer schedules */}
                <div className="space-y-4">
                  {volunteers
                    .filter((vol) => selectedVolunteer === null || vol.vid === selectedVolunteer)
                    .map((volunteer) => {
                      const volunteerSchedules = schedules.filter((s) => s.volunteer === volunteer.vid)
                      const assignment = assignments.find((a) => a.volunteer === volunteer.vid)

                      return (
                        <Card key={volunteer.vid}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-chart-4 rounded-full flex items-center justify-center">
                                  <User className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{getVolunteerName(volunteer.vid)}</h4>
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
                              <p className="text-muted-foreground text-center py-4">No scheduled visits</p>
                            ) : (
                              <div className="space-y-2">
                                {volunteerSchedules.map((schedule, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm">
                                        {new Date(schedule.datetime).toLocaleDateString("en-SG")}
                                      </span>
                                      <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                                      <span className="text-sm">
                                        {new Date(schedule.datetime).toLocaleTimeString("en-SG", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">{schedule.cluster}</Badge>
                                      <span className="text-xs text-muted-foreground">{schedule.duration}min</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
