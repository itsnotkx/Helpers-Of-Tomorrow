"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Plus, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TimeSlot {
  id: string
  startTime: string
  startPeriod: string
  endTime: string
  endPeriod: string
}

interface WeeklySchedule {
  [key: string]: TimeSlot[]
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const getCurrentWeekDates = () => {
  const today = new Date()
  const currentDay = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1))

  const weekDates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    weekDates.push(date)
  }
  return weekDates
}

const generateTimeOptions = () => {
  const times = []
  for (let hour = 1; hour <= 12; hour++) {
    const timeString = `${hour.toString().padStart(2, "0")}:00`
    times.push({ value: timeString, display: timeString })
  }
  return times.sort((a, b) => Number.parseInt(a.value) - Number.parseInt(b.value))
}

const TIME_OPTIONS = generateTimeOptions()
const AM_PM_OPTIONS = [
  { value: "AM", display: "AM" },
  { value: "PM", display: "PM" },
]

const isValidTimeRange = (time: string, period: string) => {
  if (!time || !period) return true // Don't validate incomplete selections

  const hour = Number.parseInt(time.split(":")[0])
  const hour24 = period === "AM" ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12

  return hour24 >= 8 && hour24 <= 22 // 8am (8) to 10pm (22)
}

const isEndTimeAfterStartTime = (slot: TimeSlot) => {
  if (!slot.startTime || !slot.startPeriod || !slot.endTime || !slot.endPeriod) {
    return true // Don't validate incomplete selections
  }

  const startHour = Number.parseInt(slot.startTime.split(":")[0])
  const endHour = Number.parseInt(slot.endTime.split(":")[0])

  const startHour24 =
    slot.startPeriod === "AM" ? (startHour === 12 ? 0 : startHour) : startHour === 12 ? 12 : startHour + 12
  const endHour24 = slot.endPeriod === "AM" ? (endHour === 12 ? 0 : endHour) : endHour === 12 ? 12 : endHour + 12

  return endHour24 > startHour24
}

const hasTimeClash = (daySlots: TimeSlot[], currentSlotId?: string) => {
  const validSlots = daySlots.filter(
    (slot) =>
      slot.startTime &&
      slot.startPeriod &&
      slot.endTime &&
      slot.endPeriod &&
      isValidTimeRange(slot.startTime, slot.startPeriod) &&
      isValidTimeRange(slot.endTime, slot.endPeriod) &&
      isEndTimeAfterStartTime(slot) &&
      slot.id !== currentSlotId, // Exclude current slot from clash check
  )

  for (let i = 0; i < validSlots.length; i++) {
    for (let j = i + 1; j < validSlots.length; j++) {
      const slot1 = validSlots[i]
      const slot2 = validSlots[j]

      // Convert to 24-hour format for comparison
      const slot1Start = convertTo24Hour(slot1.startTime, slot1.startPeriod)
      const slot1End = convertTo24Hour(slot1.endTime, slot1.endPeriod)
      const slot2Start = convertTo24Hour(slot2.startTime, slot2.startPeriod)
      const slot2End = convertTo24Hour(slot2.endTime, slot2.endPeriod)

      // Check for overlap: slot1 starts before slot2 ends AND slot2 starts before slot1 ends
      if (slot1Start < slot2End && slot2Start < slot1End) {
        return true
      }
    }
  }
  return false
}

const convertTo24Hour = (time: string, period: string) => {
  const hour = Number.parseInt(time.split(":")[0])
  return period === "AM" ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12
}

export function WeeklyTimeSlotForm() {
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => {
    const initialSchedule: WeeklySchedule = {}
    DAYS_OF_WEEK.forEach((day) => {
      initialSchedule[day] = []
    })
    return initialSchedule
  })

  const [weekDates, setWeekDates] = useState<Date[]>([])
  const [isClient, setIsClient] = useState(false)
  const [openDays, setOpenDays] = useState<{ [key: string]: boolean }>(() => {
    const initialOpen: { [key: string]: boolean } = {}
    DAYS_OF_WEEK.forEach((day) => {
      initialOpen[day] = true // All days start open
    })
    return initialOpen
  })

  useEffect(() => {
    setWeekDates(getCurrentWeekDates())
    setIsClient(true)
  }, [])

  const addTimeSlot = (day: string) => {
    const newSlot: TimeSlot = {
      id: `${day}-${Date.now()}`,
      startTime: "",
      startPeriod: "AM", // Added default AM period
      endTime: "",
      endPeriod: "AM", // Added default AM period
    }

    setSchedule((prev) => ({
      ...prev,
      [day]: [...prev[day], newSlot],
    }))
  }

  const removeTimeSlot = (day: string, slotId: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].filter((slot) => slot.id !== slotId),
    }))
  }

  const updateTimeSlot = (
    day: string,
    slotId: string,
    field: "startTime" | "endTime" | "startPeriod" | "endPeriod",
    value: string,
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)),
    }))
  }

  const isSlotValid = (slot: TimeSlot) => {
    const startValid = isValidTimeRange(slot.startTime, slot.startPeriod)
    const endValid = isValidTimeRange(slot.endTime, slot.endPeriod)
    const hasAllFields = slot.startTime && slot.startPeriod && slot.endTime && slot.endPeriod
    const endAfterStart = isEndTimeAfterStartTime(slot)
    return hasAllFields && startValid && endValid && endAfterStart
  }

  const isDayValid = (day: string) => {
    const daySlots = schedule[day]
    return daySlots.length === 0 || (daySlots.every((slot) => isSlotValid(slot)) && !hasTimeClash(daySlots))
  }

  const isScheduleValid = () => {
    return Object.values(schedule).every(
      (daySlots) => daySlots.length === 0 || (daySlots.every((slot) => isSlotValid(slot)) && !hasTimeClash(daySlots)),
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isScheduleValid()) {
      return
    }
    console.log("Weekly Schedule:", schedule)
    // Handle form submission here
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center mb-6">
          <img src="/hotlogo.png" alt="Helpers of Tomorrow Logo" width={128} height={128} />
        </div>
      <h1 className="text-3xl font-bold text-center mb-8">Weekly Schedule</h1>
      <div className="text-center space-y-4">

        <h1 className="text-2xl font-bold">Time Slots</h1>
        <p className="text-muted-foreground">
          From {weekDates[0]?.toLocaleDateString() || ""} to {weekDates[6]?.toLocaleDateString() || ""}
        </p>
      </div>

      <div className="bg-muted/30 p-4 space-y-2">
        {DAYS_OF_WEEK.map((day, index) => (
          <Card key={day} className="w-full border-0 shadow-sm bg-background/80">
            <Collapsible
              open={openDays[day]}
              onOpenChange={(isOpen) => setOpenDays((prev) => ({ ...prev, [day]: isOpen }))}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex flex-col items-start">
                      <span>{day}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {weekDates[index]?.toLocaleDateString() || ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {schedule[day].length} slot{schedule[day].length !== 1 ? "s" : ""}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          openDays[day] ? "rotate-0" : "rotate-180"
                        }`}
                      />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {schedule[day].map((slot) => (
                      <div key={slot.id} className="flex items-center gap-3 p-3 border bg-muted/20">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`${slot.id}-start`} className="text-sm">
                              Start Time
                            </Label>
                            <div className="flex gap-2">
                              <Select
                                value={slot.startTime}
                                onValueChange={(value) => updateTimeSlot(day, slot.id, "startTime", value)}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Time" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem key={time.value} value={time.value}>
                                      {time.display}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={slot.startPeriod}
                                onValueChange={(value) => updateTimeSlot(day, slot.id, "startPeriod", value)}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AM_PM_OPTIONS.map((period) => (
                                    <SelectItem key={period.value} value={period.value}>
                                      {period.display}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {slot.startTime &&
                              slot.startPeriod &&
                              !isValidTimeRange(slot.startTime, slot.startPeriod) && (
                                <p className="text-xs text-destructive">Time must be between 8am and 10pm</p>
                              )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">End Time</Label>
                            <div className="flex gap-2">
                              <Select
                                value={slot.endTime}
                                onValueChange={(value) => updateTimeSlot(day, slot.id, "endTime", value)}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Time" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem key={time.value} value={time.value}>
                                      {time.display}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={slot.endPeriod}
                                onValueChange={(value) => updateTimeSlot(day, slot.id, "endPeriod", value)}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AM_PM_OPTIONS.map((period) => (
                                    <SelectItem key={period.value} value={period.value}>
                                      {period.display}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {slot.endTime && slot.endPeriod && !isValidTimeRange(slot.endTime, slot.endPeriod) && (
                              <p className="text-xs text-destructive">Time must be between 8am and 10pm</p>
                            )}
                            {slot.startTime &&
                              slot.startPeriod &&
                              slot.endTime &&
                              slot.endPeriod &&
                              isValidTimeRange(slot.endTime, slot.endPeriod) &&
                              !isEndTimeAfterStartTime(slot) && (
                                <p className="text-xs text-destructive">End time must be after start time</p>
                              )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeTimeSlot(day, slot.id)}
                          className="shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {hasTimeClash(schedule[day]) && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        ⚠️ Time slots are overlapping. Please adjust the times to avoid conflicts.
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addTimeSlot(day)}
                      className="w-full"
                      disabled={!isDayValid(day)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Time Slot
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      <div className="flex justify-center pt-6">
        <Button type="submit" size="lg" className="px-8" disabled={!isScheduleValid()}>
          Save Schedule
        </Button>
      </div>
    </form>
  )
}
