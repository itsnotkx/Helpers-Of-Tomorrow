"use client";
import { useState, useEffect } from "react";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type userSchedule = {
  aid: string;
  date: string;
  start_time: string;
  end_time: string;
  is_acknowledged: boolean;
  senior_name: string;
  address: string;
};

export default function VolunteerSchedule() {
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSchedule, setUserSchedule] = useState<userSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({
    type: null,
    message: "",
  });

  const { isLoaded, isSignedIn, user } = useUser();

  // Format time as HH:MM (removes seconds if present)
  const formatTime = (timeString: string) => {
    if (!timeString) return timeString;
    const [hh = "", mm = ""] = timeString.split(":");
    return `${hh}:${mm}`;
  };

  // Format date as DD-MM-YYYY
  const formatDate = (dateString: string) => {
    return `${dateString[8]}${dateString[9]}-${dateString[5]}${dateString[6]}-${dateString[0]}${dateString[1]}${dateString[2]}${dateString[3]}`;
  };

  // Reusable function to fetch data from API
  const fetchFromAPI = async (endpoint: string) => {
    const BASE_URL =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return await response.json();
  };

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      fetchUserSchedules(user.primaryEmailAddress.emailAddress);
    }
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <h1 className="text-2xl font-bold">Loading</h1>
      </div>
    );
  }

  if (!isSignedIn || !user?.primaryEmailAddress?.emailAddress) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <h1 className="text-2xl font-bold">Not Signed In</h1>
      </div>
    );
  }

  async function fetchUserSchedules(email: string) {
    try {
      setIsLoading(true);
      if (email !== "") {
        // Fetch all assignments and seniors data
        const [assignmentsData, seniorsData] = await Promise.all([
          fetchFromAPI("/assignments"),
          fetchFromAPI("/seniors"),
        ]);

        // Calculate week boundaries for filtering
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        let startOfWeek: Date;

        if (dayOfWeek === 0) {
          // If today is Sunday, start from today (Sunday) and go to next Sunday
          startOfWeek = new Date(today);
        } else {
          // For any other day, get Monday of current week
          startOfWeek = new Date(today);
          const daysToMonday = 1 - dayOfWeek; // Days to get back to Monday
          startOfWeek.setDate(today.getDate() + daysToMonday);
        }

        // Generate 7 days from the start date
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i);
          weekDays.push(date.toISOString().split("T")[0]);
        }

        // Filter assignments by user email and current week, then map to userSchedule format
        const userAssignments = assignmentsData.assignments
          .filter(
            (assignment: any) =>
              assignment.volunteer_email === email &&
              weekDays.includes(assignment.date)
          )
          .map((assignment: any) => {
            const senior = seniorsData.seniors.find(
              (s: any) => s.uid === assignment.sid
            );
            return {
              aid: assignment.aid || assignment.id,
              date: assignment.date,
              start_time: formatTime(assignment.start_time),
              end_time: formatTime(assignment.end_time),
              is_acknowledged: assignment.is_acknowledged || false,
              senior_name: senior?.name || assignment.sid,
              address: senior?.address || "Address not available",
            };
          });

        setUserSchedule(userAssignments);
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Toggle acknowledgement
  const handleCheckboxChange = (id: string) => {
    setAcknowledged((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const closeDialog = () => {
    setShowSuccessDialog(false);
    window.location.reload();
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      // Extract acknowledged IDs
      setIsSubmitting(true);
      const acknowledgedIds = Object.keys(acknowledged).filter(
        (id) => acknowledged[id]
      );

      const jsonFormat = Object.fromEntries(
        acknowledgedIds.map((id) => [id, id])
      );

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
        }/acknowledgements`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(jsonFormat),
        }
      );

      const result = await response.json();
      if (result.success) {
        setSuccessMessage(`Your acknowledgement has been saved successfully!`);
        setShowSuccessDialog(true);
      } else {
        setSubmitStatus({
          type: "error",
          message:
            result.error ||
            "Failed to submit acknowledgement. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error submitting acknowledgement:", error);
      setSubmitStatus({
        type: "error",
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reusable Assignment Card Component
  const AssignmentCard = ({
    assignment,
    isNew = false,
  }: {
    assignment: userSchedule;
    isNew?: boolean;
  }) => (
    <Card
      key={assignment.aid}
      className={`shadow-lg border-l-4 ${
        isNew ? "border-l-red-500" : "border-l-green-500"
      } hover:shadow-xl transition-shadow duration-200`}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-blue-600" />
              {assignment.senior_name}
            </CardTitle>
          </div>
          <Badge
            variant={isNew ? "outline" : "secondary"}
            className={
              isNew
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-green-50 text-green-700 border-green-200"
            }
          >
            {isNew ? (
              "New"
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Acknowledged
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">
              {formatDate(assignment.date)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">
              {assignment.start_time} - {assignment.end_time}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 leading-relaxed">
              {assignment.address}
            </p>
          </div>
        </div>
      </CardContent>
      {isNew && (
        <CardFooter className="pt-3 border-t border-blue-100">
          <div className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex flex-col justify-center">
                <span className="text-sm font-semibold text-blue-800 mb-1">
                  Please acknowledge this assignment
                </span>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!acknowledged[assignment.aid]}
                  onChange={() => handleCheckboxChange(assignment.aid)}
                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-blue-700">
                  Acknowledge
                </span>
              </label>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );

  // Reusable section renderer
  const renderAssignmentSection = (
    title: string,
    badgeText: string,
    assignments: userSchedule[],
    isNew: boolean,
    emptyMessage: string
  ) => (
    <div className="w-full mx-auto space-y-4">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Badge
          variant={isNew ? "destructive" : "secondary"}
          className="text-base px-4 py-2"
        >
          {badgeText}
        </Badge>
      </div>
      {assignments.length > 0 ? (
        assignments
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((assignment) => (
            <AssignmentCard
              key={assignment.aid}
              assignment={assignment}
              isNew={isNew}
            />
          ))
      ) : (
        <Card className="text-center py-8 border-dashed border-2">
          <CardContent>
            <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">{emptyMessage}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div>
      <h3 className="text-2xl font-bold text-center mb-6 mt-6">
        Your Current Schedule
      </h3>

      {submitStatus.type === "error" && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
          <span className="font-medium">{submitStatus.message}</span>
        </div>
      )}

      {isLoading ? (
        <p className="text-lg text-center font-bold mb-4 text-red-500">
          {" "}
          Loading...
        </p>
      ) : (
        <>
          <div className="w-full mx-auto space-y-4">
            <div className="flex items-center justify-center gap-2 mb-6">
              <h4 className="text-xl font-semibold text-red-600">
                New Assignments
              </h4>
            </div>
            {userSchedule.filter(
              (s: userSchedule) => s.is_acknowledged === false
            ).length > 0 ? (
              userSchedule
                .filter((s: userSchedule) => s.is_acknowledged === false)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((s: userSchedule) => (
                  <Card
                    key={s.aid}
                    className="shadow-lg border-l-4 border-l-red-500 hover:shadow-xl transition-shadow duration-200"
                  >
                    <CardHeader className="pb-0">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="h-5 w-5 text-blue-600" />
                            {s.senior_name}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200"
                        >
                          New
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">
                            {s.date[8]}
                            {s.date[9]}-{s.date[5]}
                            {s.date[6]}-{s.date[0]}
                            {s.date[1]}
                            {s.date[2]}
                            {s.date[3]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">
                            {s.start_time} - {s.end_time}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {s.address}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-3 border-t border-blue-100">
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col justify-center">
                            <span className="text-sm font-semibold text-blue-800 mb-1">
                              Please acknowledge this assignment
                            </span>
                          </div>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!acknowledged[s.aid]}
                              onChange={() => handleCheckboxChange(s.aid)}
                              className="w-5 h-5 accent-blue-600 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-blue-700">
                              Acknowledge
                            </span>
                          </label>
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                ))
            ) : (
              <Card className="text-center py-8 border-dashed border-2">
                <CardContent>
                  <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No new assignments available.</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex justify-center pt-6">
            <Button
              type="submit"
              size="lg"
              className="px-8 mb-6 bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Acknowledgement...
                </>
              ) : (
                "Save Acknowledgement"
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6 mt-8">
            <h4 className="text-xl font-semibold text-red-600">
              Acknowledged Assignments
            </h4>
          </div>
          <div className="mb-4"></div>
          <div className="w-full mx-auto space-y-4">
            {userSchedule.filter(
              (s: userSchedule) => s.is_acknowledged === true
            ).length > 0 ? (
              userSchedule
                .filter((s: userSchedule) => s.is_acknowledged === true)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((s: userSchedule) => (
                  <Card
                    key={s.aid}
                    className="shadow-md border-l-4 border-l-green-500 hover:shadow-lg transition-shadow duration-200"
                  >
                    <CardHeader className="pb-0">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="h-5 w-5 text-blue-600" />
                            {s.senior_name}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Acknowledged
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">
                            {s.date[8]}
                            {s.date[9]}-{s.date[5]}
                            {s.date[6]}-{s.date[0]}
                            {s.date[1]}
                            {s.date[2]}
                            {s.date[3]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">
                            {s.start_time} - {s.end_time}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {s.address}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            ) : (
              <Card className="text-center py-8 border-dashed border-2">
                <CardContent>
                  <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">
                    No acknowledged assignments available.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
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
              Acknowledgement Recognised!
            </DialogTitle>
            <DialogDescription className="text-base">
              {successMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => closeDialog()} className="w-full">
              Okay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
