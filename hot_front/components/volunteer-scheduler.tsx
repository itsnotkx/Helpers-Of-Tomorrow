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
      const BASE_URL = "http://localhost:8000";
      console.log(email);
      if (email != "") {
        // Fetch all assignments
        const assignmentsRes = await fetch(`${BASE_URL}/assignments`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const assignmentsData = await assignmentsRes.json();

        // Fetch seniors to get names
        const seniorsRes = await fetch(`${BASE_URL}/seniors`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const seniorsData = await seniorsRes.json();

        // Filter assignments by user email and map to userSchedule format
        const userAssignments = assignmentsData.assignments
          .filter((assignment: any) => assignment.volunteer_email === email)
          .map((assignment: any) => {
            const senior = seniorsData.seniors.find(
              (s: any) => s.uid === assignment.sid
            );
            return {
              aid: assignment.aid || assignment.id, // Use appropriate ID field
              date: assignment.date,
              start_time: formatTime(assignment.start_time),
              end_time: formatTime(assignment.end_time),
              is_acknowledged: assignment.is_acknowledged || false,
              senior_name: senior?.name || assignment.sid,
              address: senior?.address || "Address not available",
            };
          });

        console.log("Fetched schedules:", userAssignments);
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

      console.log("Acknowledged IDs:", jsonFormat);

      // Example: send to backend (Supabase, API, etc.)
      const BASE_URL = "http://localhost:8000";
      const response = await fetch(`${BASE_URL}/acknowledgements`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonFormat),
      });

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
              <Badge variant="destructive" className="text-base px-4 py-2">
                New Assignments
              </Badge>
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
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="h-5 w-5 text-blue-600" />
                            {s.senior_name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 text-base">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span>
                                {s.date[8]}
                                {s.date[9]}-{s.date[5]}
                                {s.date[6]}-{s.date[0]}
                                {s.date[1]}
                                {s.date[2]}
                                {s.date[3]}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span>
                                {s.start_time} - {s.end_time}
                              </span>
                            </div>
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200"
                        >
                          New
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {s.address}
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-3 bg-gray-50/50">
                      <label className="flex items-center gap-3 cursor-pointer ml-auto">
                        <input
                          type="checkbox"
                          checked={!!acknowledged[s.aid]}
                          onChange={() => handleCheckboxChange(s.aid)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Acknowledge Assignment
                        </span>
                      </label>
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
              className="px-8 mb-6"
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
            <Badge variant="secondary" className="text-base px-4 py-2">
              Outstanding Assignments
            </Badge>
          </div>
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
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="h-5 w-5 text-blue-600" />
                            {s.senior_name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 text-base">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span>
                                {s.date[8]}
                                {s.date[9]}-{s.date[5]}
                                {s.date[6]}-{s.date[0]}
                                {s.date[1]}
                                {s.date[2]}
                                {s.date[3]}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span>
                                {s.start_time} - {s.end_time}
                              </span>
                            </div>
                          </CardDescription>
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
                    <CardContent className="py-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {s.address}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
            ) : (
              <Card className="text-center py-8 border-dashed border-2">
                <CardContent>
                  <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">
                    No outstanding assignments available.
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
