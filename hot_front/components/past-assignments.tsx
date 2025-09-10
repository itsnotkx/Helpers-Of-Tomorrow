"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ChevronDown,
  ChevronUp,
  History,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";

interface ArchivedAssignment {
  aid: string;
  vid: string; // Changed from volunteer_id to vid
  sid: string; // Changed from senior_id to sid
  senior_name?: string;
  senior_address?: string;
  date: string;
  start_time: string;
  end_time: string;
  status?: string;
  cluster?: number;
  priority_score?: number;
  completion_notes?: string;
  completed_at?: string;
  has_visited?: boolean;
}

interface Volunteer {
  vid: string;
  email: string;
  name?: string;
}

interface Senior {
  uid: string;
  name?: string;
  address?: string;
}

export function PastAssignments() {
  const [assignments, setAssignments] = useState<ArchivedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "senior">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [volunteerVid, setVolunteerVid] = useState<string | null>(null);
  const [seniors, setSeniors] = useState<Senior[]>([]);

  // Visit confirmation state
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(
    null
  );
  const [confirmingVisit, setConfirmingVisit] = useState<string | null>(null);

  const { user } = useUser();

  const fetchVolunteerAndAssignments = useCallback(async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    try {
      setLoading(true);
      setError(null);
      const BASE_URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const userEmail = user.primaryEmailAddress.emailAddress;

      // First, get all volunteers and find the one with matching email
      const volunteerResponse = await fetch(`${BASE_URL}/volunteers`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!volunteerResponse.ok) {
        throw new Error("Failed to fetch volunteers");
      }

      const volunteerResult = await volunteerResponse.json();

      // Debug: Log volunteers data structure
      console.log("📋 Volunteers API Response:", volunteerResult);
      if (volunteerResult.volunteers && volunteerResult.volunteers.length > 0) {
        console.log(
          "📋 Volunteer Columns:",
          Object.keys(volunteerResult.volunteers[0])
        );
        console.log("📋 Sample Volunteer:", volunteerResult.volunteers[0]);
      }

      // Find the volunteer with matching email
      const volunteer = volunteerResult.volunteers.find(
        (vol: Volunteer) => vol.email === userEmail
      );

      console.log("🔍 Looking for email:", userEmail);
      console.log("🔍 Found volunteer:", volunteer);

      if (!volunteer) {
        throw new Error("Volunteer not found");
      }

      const volunteerVid = volunteer.vid;
      setVolunteerVid(volunteerVid);

      // Fetch seniors data for matching names and addresses
      const seniorsResponse = await fetch(`${BASE_URL}/seniors`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!seniorsResponse.ok) {
        throw new Error("Failed to fetch seniors");
      }

      const seniorsResult = await seniorsResponse.json();
      setSeniors(seniorsResult.seniors || []);

      // Then fetch archived assignments
      const assignmentResponse = await fetch(`${BASE_URL}/assignmentarchive`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!assignmentResponse.ok) {
        throw new Error("Failed to fetch past assignments");
      }

      const assignmentResult = await assignmentResponse.json();

      // Debug: Log assignments_archive data structure
      console.log("📋 Assignments Archive API Response:", assignmentResult);
      if (
        assignmentResult.assignment_archive &&
        assignmentResult.assignment_archive.length > 0
      ) {
        console.log(
          "📋 Assignment Archive Columns:",
          Object.keys(assignmentResult.assignment_archive[0])
        );
        console.log(
          "📋 Sample Assignment:",
          assignmentResult.assignment_archive[0]
        );
      }

      console.log("🔍 Filtering by vid:", volunteerVid);

      // Filter assignments for current volunteer using vid
      const userAssignments = assignmentResult.assignment_archive.filter(
        (assignment: ArchivedAssignment) => assignment.vid === volunteerVid
      );

      console.log("🔍 Filtered assignments:", userAssignments);
      console.log(
        "🔍 Found",
        userAssignments.length,
        "assignments for volunteer",
        volunteerVid
      );

      setAssignments(userAssignments);
    } catch (err) {
      console.error("Error fetching past assignments:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVolunteerAndAssignments();
  }, [fetchVolunteerAndAssignments]);

  // Helper function to get senior details by sid
  const getSeniorDetails = (sid: string) => {
    const senior = seniors.find((s) => s.uid === sid);
    return {
      name: senior?.name || `Senior ${sid}`,
      address: senior?.address || null,
    };
  };

  // Handle visit confirmation
  const handleConfirmVisit = async (aid: string) => {
    try {
      setConfirmingVisit(aid);
      const BASE_URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const response = await fetch(`${BASE_URL}/confirm-visit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ aid }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update the local assignment state
        setAssignments((prev) =>
          prev.map((assignment) =>
            assignment.aid === aid
              ? { ...assignment, has_visited: true }
              : assignment
          )
        );
        setShowConfirmDialog(null);
        alert("Visit confirmed successfully!");
      } else {
        console.error("Failed to confirm visit:", result);
        alert(`Failed to confirm visit: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error confirming visit:", error);
      alert(
        `Error confirming visit: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setConfirmingVisit(null);
    }
  };

  const handleSort = (column: "date" | "senior") => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("desc");
    }
  };

  const sortedAssignments = [...assignments].sort((a, b) => {
    let comparison = 0;

    if (sortBy === "date") {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      comparison = dateA.getTime() - dateB.getTime();
    } else {
      const nameA = getSeniorDetails(a.sid).name;
      const nameB = getSeniorDetails(b.sid).name;
      comparison = nameA.localeCompare(nameB);
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Completed
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "no-show":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            No Show
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  const displayedAssignments = isExpanded
    ? sortedAssignments
    : sortedAssignments.slice(0, 5);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load past assignments</p>
        <Button
          variant="outline"
          onClick={fetchVolunteerAndAssignments}
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div>
        {assignments.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No past assignments found</p>
            <p className="text-sm text-gray-500 mt-2">
              Your completed assignments will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sort controls and expand button */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <Button
                  variant={sortBy === "date" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSort("date")}
                >
                  Sort by Date{" "}
                  {sortBy === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant={sortBy === "senior" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSort("senior")}
                >
                  Sort by Senior{" "}
                  {sortBy === "senior" && (sortDirection === "asc" ? "↑" : "↓")}
                </Button>
              </div>

              {assignments.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show All ({assignments.length})
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Assignments list */}
            <div className="space-y-3">
              {displayedAssignments.map((assignment) => {
                const seniorDetails = getSeniorDetails(assignment.sid);
                return (
                  <Card
                    key={assignment.aid}
                    className="shadow-lg border-l-4 border-l-blue-500 hover:shadow-xl transition-shadow duration-200"
                  >
                    <CardHeader className="pb-0">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="h-5 w-5 text-blue-600" />
                            {seniorDetails.name}
                          </CardTitle>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {assignment.status &&
                            getStatusBadge(assignment.status)}
                          {assignment.has_visited && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Visit Confirmed
                            </Badge>
                          )}
                          {assignment.cluster && (
                            <Badge variant="outline" className="text-xs">
                              Cluster {assignment.cluster}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">
                            {new Date(assignment.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">
                            {assignment.start_time} - {assignment.end_time}
                          </span>
                        </div>
                        {seniorDetails.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {seniorDetails.address}
                            </p>
                          </div>
                        )}
                        {assignment.priority_score && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              Priority: {assignment.priority_score}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    {(assignment.completion_notes ||
                      assignment.completed_at ||
                      !assignment.has_visited) && (
                      <div className="px-6 pb-4 space-y-2">
                        {assignment.completion_notes && (
                          <div className="p-3 bg-gray-50 rounded text-sm">
                            <strong>Notes:</strong>{" "}
                            {assignment.completion_notes}
                          </div>
                        )}
                        {assignment.completed_at && (
                          <div className="text-xs text-gray-500">
                            Completed:{" "}
                            {new Date(assignment.completed_at).toLocaleString()}
                          </div>
                        )}
                        {!assignment.has_visited && (
                          <div className="pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">
                                Did you complete this visit?
                              </span>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setShowConfirmDialog(assignment.aid)
                                }
                                disabled={confirmingVisit === assignment.aid}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                {confirmingVisit === assignment.aid ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Confirming...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Confirm Visit
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        {assignment.has_visited && (
                          <div className="pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                Visit completed
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {assignments.length > 5 && !isExpanded && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={() => setIsExpanded(true)}>
                  View {assignments.length - 5} More Assignments
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!showConfirmDialog}
        onOpenChange={() => setShowConfirmDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Visit Completion</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this visit as completed? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                showConfirmDialog && handleConfirmVisit(showConfirmDialog)
              }
              disabled={!!confirmingVisit}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {confirmingVisit ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Confirm Visit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
