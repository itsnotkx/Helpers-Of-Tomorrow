"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading_icon";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, Loader2, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface TimeSlot {
  id: string;
  startTime: string;
  startPeriod: string;
  endTime: string;
  endPeriod: string;
}

interface WeeklySchedule {
  [key: string]: TimeSlot[];
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const getNextWeekDates = () => {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  // Add 7 days to get next week's Monday
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + 7);

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDates.push(date);
  }
  return weekDates;
};

const generateTimeOptions = () => {
  const times = [];
  for (let hour = 1; hour <= 12; hour++) {
    const timeString = `${hour.toString().padStart(2, "0")}:00`;
    times.push({ value: timeString, display: timeString });
  }
  return times.sort(
    (a, b) => Number.parseInt(a.value) - Number.parseInt(b.value)
  );
};

const TIME_OPTIONS = generateTimeOptions();
const AM_PM_OPTIONS = [
  { value: "AM", display: "AM" },
  { value: "PM", display: "PM" },
];

const isValidTimeRange = (time: string, period: string) => {
  if (!time || !period) return true; // Don't validate incomplete selections

  const hour = Number.parseInt(time.split(":")[0]);
  const hour24 =
    period === "AM" ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12;

  return hour24 >= 8 && hour24 <= 22; // 8am (8) to 10pm (22)
};

const isEndTimeAfterStartTime = (slot: TimeSlot) => {
  if (
    !slot.startTime ||
    !slot.startPeriod ||
    !slot.endTime ||
    !slot.endPeriod
  ) {
    return true; // Don't validate incomplete selections
  }

  const startHour = Number.parseInt(slot.startTime.split(":")[0]);
  const endHour = Number.parseInt(slot.endTime.split(":")[0]);

  const startHour24 =
    slot.startPeriod === "AM"
      ? startHour === 12
        ? 0
        : startHour
      : startHour === 12
      ? 12
      : startHour + 12;
  const endHour24 =
    slot.endPeriod === "AM"
      ? endHour === 12
        ? 0
        : endHour
      : endHour === 12
      ? 12
      : endHour + 12;

  return endHour24 > startHour24;
};

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
      slot.id !== currentSlotId // Exclude current slot from clash check
  );

  for (let i = 0; i < validSlots.length; i++) {
    for (let j = i + 1; j < validSlots.length; j++) {
      const slot1 = validSlots[i];
      const slot2 = validSlots[j];

      // Convert to 24-hour format for comparison
      const slot1Start = convertTo24Hour(slot1.startTime, slot1.startPeriod);
      const slot1End = convertTo24Hour(slot1.endTime, slot1.endPeriod);
      const slot2Start = convertTo24Hour(slot2.startTime, slot2.startPeriod);
      const slot2End = convertTo24Hour(slot2.endTime, slot2.endPeriod);

      // Check for overlap: slot1 starts before slot2 ends AND slot2 starts before slot1 ends
      if (slot1Start < slot2End && slot2Start < slot1End) {
        return true;
      }
    }
  }
  return false;
};

const convertTo24Hour = (time: string, period: string) => {
  const hour = Number.parseInt(time.split(":")[0]);
  return period === "AM"
    ? hour === 12
      ? 0
      : hour
    : hour === 12
    ? 12
    : hour + 12;
};

// Convert frontend slot format to API format
// Convert frontend slot format to API format
const convertSlotToApiFormat = (slot: TimeSlot, date: Date) => {
  console.log(slot);
  const startHour24 = convertTo24Hour(slot.startTime, slot.startPeriod);
  const endHour24 = convertTo24Hour(slot.endTime, slot.endPeriod);
  console.log(startHour24, endHour24);

  // Create datetime objects in local timezone
  const startDateTime = new Date(date);
  startDateTime.setHours(startHour24, 0, 0, 0);

  const endDateTime = new Date(date);
  endDateTime.setHours(endHour24, 0, 0, 0);

  // Format as ISO string but maintain local timezone
  const formatLocalISO = (dateTime: Date) => {
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, "0");
    const day = String(dateTime.getDate()).padStart(2, "0");
    const hours = String(dateTime.getHours()).padStart(2, "0");
    const minutes = String(dateTime.getMinutes()).padStart(2, "0");
    const seconds = String(dateTime.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const startTimeISO = formatLocalISO(startDateTime);
  const endTimeISO = formatLocalISO(endDateTime);

  return {
    start_time: startTimeISO,
    end_time: endTimeISO,
  };
};

const convertBackendToFrontendFormat = (
  backendSlots: any[],
  weekDates: Date[]
) => {
  const schedule: WeeklySchedule = {};

  // Initialize empty schedule
  DAYS_OF_WEEK.forEach((day) => {
    schedule[day] = [];
  });

  backendSlots.forEach((slot) => {
    // console.log(slot)
    // Parse the date from the slot
    const slotDate = new Date(slot.date);

    // Parse start and end times - they come as ISO strings
    const startTime = new Date(slot.start_time);
    const endTime = new Date(slot.end_time);

    // Find which day of the week this slot belongs to
    const dayIndex = weekDates.findIndex(
      (date) => date.toDateString() === slotDate.toDateString()
    );

    if (dayIndex !== -1) {
      const dayName = DAYS_OF_WEEK[dayIndex];

      // Helper function to format time for frontend
      const formatTimeFor12Hour = (date: Date) => {
        const hours = date.getHours();
        const displayHour =
          hours === 0
            ? 12
            : hours > 12
            ? hours - 12
            : hours === 12
            ? 12
            : hours;
        return `${displayHour.toString().padStart(2, "0")}:00`;
      };

      const getTimePeriod = (date: Date) => {
        return date.getHours() < 12 ? "AM" : "PM";
      };

      const timeSlot: TimeSlot = {
        id: `${dayName}-${Date.now()}-${Math.random()}`,
        startTime: formatTimeFor12Hour(startTime),
        startPeriod: getTimePeriod(startTime),
        endTime: formatTimeFor12Hour(endTime),
        endPeriod: getTimePeriod(endTime),
      };

      schedule[dayName].push(timeSlot);
    }
  });

  return schedule;
};

export function WeeklyTimeSlotForm() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  // const
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => {
    const initialSchedule: WeeklySchedule = {};
    DAYS_OF_WEEK.forEach((day) => {
      initialSchedule[day] = [];
    });
    return initialSchedule;
  });

  const [isSunday, setIsSunday] = useState(false); // Add Sunday state
  useEffect(() => {
    setIsClient(true);
    const today = new Date();
    if (today.getDay() === 0) {
      // Sunday
      setIsSunday(true);
      router.push("/");
      return;
    }

    if (isLoaded && isSignedIn && user) {
      loadSavedSlots();
    }
  }, [isLoaded, isSignedIn, user, router]);

  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({
    type: null,
    message: "",
  });
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [openDays, setOpenDays] = useState<{ [key: string]: boolean }>(() => {
    const initialOpen: { [key: string]: boolean } = {};
    DAYS_OF_WEEK.forEach((day) => {
      initialOpen[day] = true; // All days start open
    });
    return initialOpen;
  });

  const loadSavedSlots = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    try {
      const BASE_URL = "http://localhost:8000";
      const response = await fetch(
        `${BASE_URL}/get_slots/${user.primaryEmailAddress.emailAddress}`
      );
      const result = await response.json();

      if (response.ok && result.slots && result.slots.length > 0) {
        const currentWeekDates = getNextWeekDates();
        const populatedSchedule = convertBackendToFrontendFormat(
          result.slots,
          currentWeekDates
        );
        setSchedule(populatedSchedule);
        setWeekDates(currentWeekDates);
      } else {
        setWeekDates(getNextWeekDates());
      }
    } catch (error) {
      console.error("Error loading saved slots:", error);
      setWeekDates(getNextWeekDates());
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    setIsClient(true);
    if (isLoaded && isSignedIn && user) {
      loadSavedSlots();
    }
  }, [isLoaded, isSignedIn, user]);
  useEffect(() => {
    setWeekDates(getNextWeekDates());
    setIsClient(true);
  }, []);

  // Early return for authentication check
  if (!isLoaded || !isSignedIn) {
    return <Loading />;
  }
  if (!isClient || isSunday) {
    return <Loading />;
  }

  const addTimeSlot = (day: string) => {
    const newSlot: TimeSlot = {
      id: `${day}-${Date.now()}`,
      startTime: "",
      startPeriod: "AM", // Added default AM period
      endTime: "",
      endPeriod: "AM", // Added default AM period
    };

    setSchedule((prev) => ({
      ...prev,
      [day]: [...prev[day], newSlot],
    }));
  };

  const removeTimeSlot = (day: string, slotId: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].filter((slot) => slot.id !== slotId),
    }));
  };

  const updateTimeSlot = (
    day: string,
    slotId: string,
    field: "startTime" | "endTime" | "startPeriod" | "endPeriod",
    value: string
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].map((slot) =>
        slot.id === slotId ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const isSlotValid = (slot: TimeSlot) => {
    const startValid = isValidTimeRange(slot.startTime, slot.startPeriod);
    const endValid = isValidTimeRange(slot.endTime, slot.endPeriod);
    const hasAllFields =
      slot.startTime && slot.startPeriod && slot.endTime && slot.endPeriod;
    const endAfterStart = isEndTimeAfterStartTime(slot);
    return hasAllFields && startValid && endValid && endAfterStart;
  };

  const isDayValid = (day: string) => {
    const daySlots = schedule[day];
    return (
      daySlots.length === 0 ||
      (daySlots.every((slot) => isSlotValid(slot)) && !hasTimeClash(daySlots))
    );
  };

  const isScheduleValid = () => {
    return Object.values(schedule).every(
      (daySlots) =>
        daySlots.length === 0 ||
        (daySlots.every((slot) => isSlotValid(slot)) && !hasTimeClash(daySlots))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isScheduleValid()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      // Convert schedule to API format
      const apiSlots: Array<{ start_time: string; end_time: string }> = [];

      DAYS_OF_WEEK.forEach((day, dayIndex) => {
        const daySlots = schedule[day];
        const dayDate = weekDates[dayIndex];

        daySlots.forEach((slot) => {
          if (isSlotValid(slot)) {
            // console.log(slot)
            const apiSlot = convertSlotToApiFormat(slot, dayDate);
            apiSlots.push(apiSlot);
          }
        });
      });

      const BASE_URL = "http://localhost:8000";
      const emailId = user.primaryEmailAddress?.emailAddress;
      const response = await fetch(`${BASE_URL}/upload_slots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailId,
          slots: apiSlots,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccessMessage(
          `Your time slots have been saved and are now available for scheduling.`
        );
        setShowSuccessDialog(true);
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || "Failed to upload schedule",
        });
      }
    } catch (error) {
      console.error("Error submitting schedule:", error);
      setSubmitStatus({
        type: "error",
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Back button */}
        <div className="flex justify-start mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/volunteer")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Schedule
          </Button>
        </div>

        <h3 className="text-3xl font-bold text-center mb-8 mt-6">
          Weekly Schedule
        </h3>
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            From {weekDates[0]?.toLocaleDateString() || ""} to{" "}
            {weekDates[6]?.toLocaleDateString() || ""}
          </p>
        </div>

        {submitStatus.type === "error" && (
          <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
            <span className="font-medium">{submitStatus.message}</span>
          </div>
        )}

        <div className="bg-muted/30 p-4 space-y-2">
          {DAYS_OF_WEEK.map((day, index) => (
            <Card
              key={day}
              className="w-full border-0 shadow-sm bg-background/80"
            >
              <Collapsible
                open={openDays[day]}
                onOpenChange={(isOpen) =>
                  setOpenDays((prev) => ({ ...prev, [day]: isOpen }))
                }
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
                          {schedule[day].length} slot
                          {schedule[day].length !== 1 ? "s" : ""}
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
                        <div
                          key={slot.id}
                          className="flex items-start gap-3 p-3 border rounded-sm bg-muted/20"
                        >
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label
                                htmlFor={`${slot.id}-start`}
                                className="text-sm"
                              >
                                Start Time
                              </Label>
                              <div className="flex">
                                <Select
                                  value={slot.startTime}
                                  onValueChange={(value) =>
                                    updateTimeSlot(
                                      day,
                                      slot.id,
                                      "startTime",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger className="flex-1 rounded-r-none">
                                    <SelectValue placeholder="Time" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map((time) => (
                                      <SelectItem
                                        key={time.value}
                                        value={time.value}
                                      >
                                        {time.display}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={slot.startPeriod}
                                  onValueChange={(value) =>
                                    updateTimeSlot(
                                      day,
                                      slot.id,
                                      "startPeriod",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-20 rounded-l-none border-l-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {AM_PM_OPTIONS.map((period) => (
                                      <SelectItem
                                        key={period.value}
                                        value={period.value}
                                      >
                                        {period.display}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {slot.startTime &&
                                slot.startPeriod &&
                                !isValidTimeRange(
                                  slot.startTime,
                                  slot.startPeriod
                                ) && (
                                  <p className="text-xs text-destructive">
                                    Time must be between 8am and 10pm
                                  </p>
                                )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">End Time</Label>
                              <div className="flex">
                                <Select
                                  value={slot.endTime}
                                  onValueChange={(value) =>
                                    updateTimeSlot(
                                      day,
                                      slot.id,
                                      "endTime",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger className="flex-1 rounded-r-none">
                                    <SelectValue placeholder="Time" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map((time) => (
                                      <SelectItem
                                        key={time.value}
                                        value={time.value}
                                      >
                                        {time.display}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={slot.endPeriod}
                                  onValueChange={(value) =>
                                    updateTimeSlot(
                                      day,
                                      slot.id,
                                      "endPeriod",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-20 rounded-l-none border-l-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {AM_PM_OPTIONS.map((period) => (
                                      <SelectItem
                                        key={period.value}
                                        value={period.value}
                                      >
                                        {period.display}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {slot.endTime &&
                                slot.endPeriod &&
                                !isValidTimeRange(
                                  slot.endTime,
                                  slot.endPeriod
                                ) && (
                                  <p className="text-xs text-destructive">
                                    Time must be between 8am and 10pm
                                  </p>
                                )}
                              {slot.startTime &&
                                slot.startPeriod &&
                                slot.endTime &&
                                slot.endPeriod &&
                                isValidTimeRange(
                                  slot.endTime,
                                  slot.endPeriod
                                ) &&
                                !isEndTimeAfterStartTime(slot) && (
                                  <p className="text-xs text-destructive">
                                    End time must be after start time
                                  </p>
                                )}
                            </div>
                          </div>
                          <div className="flex items-center pt-7">
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
                        </div>
                      ))}

                      {hasTimeClash(schedule[day]) && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                          ⚠️ Time slots are overlapping. Please adjust the times
                          to avoid conflicts.
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
          <Button
            type="submit"
            size="lg"
            className="px-8"
            disabled={!isScheduleValid() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Schedule...
              </>
            ) : (
              "Save Schedule"
            )}
          </Button>
        </div>
      </form>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              Slots Saved Successfully!
            </DialogTitle>
            <DialogDescription className="text-base">
              {successMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setShowSuccessDialog(false)}
              className="w-full"
            >
              Okay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
