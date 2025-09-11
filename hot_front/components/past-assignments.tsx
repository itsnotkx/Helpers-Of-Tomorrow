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
  FileText,
  Edit3,
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
  report?: string; // Add report field
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

interface VolunteersApiResponse {
  volunteers: Volunteer[];
}

interface SeniorsApiResponse {
  seniors: Senior[];
}

interface AssignmentArchiveApiResponse {
  assignment_archive: ArchivedAssignment[];
}

interface ConfirmVisitApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  assignment_id?: string;
  senior_id?: string;
  visit_date?: string;
}

interface SubmitReportApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  assignment_id?: string;
}

export function PastAssignments() {
  const [assignments, setAssignments] = useState<ArchivedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "senior">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [seniors, setSeniors] = useState<Senior[]>([]);

  // Visit confirmation state
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(
    null
  );
  const [confirmingVisit, setConfirmingVisit] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

  // Guidelines dialog state
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Report submission state
  const [showReportDialog, setShowReportDialog] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");
  const [submittingReport, setSubmittingReport] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

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

      const volunteerResult: VolunteersApiResponse =
        await volunteerResponse.json();

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

      const seniorsResult: SeniorsApiResponse = await seniorsResponse.json();
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

      const assignmentResult: AssignmentArchiveApiResponse =
        await assignmentResponse.json();

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
  }, [user?.primaryEmailAddress?.emailAddress]);

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
      setConfirmError(null);
      setConfirmSuccess(null);
      const BASE_URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const response = await fetch(`${BASE_URL}/confirm-visit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ aid }),
      });

      const result: ConfirmVisitApiResponse = await response.json();

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
        setConfirmSuccess("Visit confirmed successfully!");

        // Clear success message after 3 seconds
        setTimeout(() => setConfirmSuccess(null), 3000);
      } else {
        console.error("Failed to confirm visit:", result);
        setConfirmError(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error confirming visit:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setConfirmError(`Error confirming visit: ${errorMessage}`);
    } finally {
      setConfirmingVisit(null);
    }
  };

  // Handle report submission
  const handleSubmitReport = async (aid: string) => {
    try {
      setSubmittingReport(aid);
      setReportError(null);
      setReportSuccess(null);
      const BASE_URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const response = await fetch(`${BASE_URL}/submit-report`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ aid, report: reportText }),
      });

      const result: SubmitReportApiResponse = await response.json();

      if (response.ok && result.success) {
        // Update the local assignment state
        setAssignments((prev) =>
          prev.map((assignment) =>
            assignment.aid === aid
              ? { ...assignment, report: reportText }
              : assignment
          )
        );
        setShowReportDialog(null);
        setReportText("");
        setReportSuccess("Report submitted successfully!");

        // Clear success message after 3 seconds
        setTimeout(() => setReportSuccess(null), 3000);
      } else {
        console.error("Failed to submit report:", result);
        setReportError(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setReportError(`Error submitting report: ${errorMessage}`);
    } finally {
      setSubmittingReport(null);
    }
  };

  // Helper function to check if assignment is eligible for report
  const isEligibleForReport = (assignment: ArchivedAssignment) => {
    if (!assignment.has_visited) {
      console.log(`Assignment ${assignment.aid}: Not visited`);
      return false;
    }

    const assignmentDate = new Date(assignment.date);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1); // 1 month window for reporting

    console.log(`Assignment ${assignment.aid}:`, {
      date: assignment.date,
      assignmentDate: assignmentDate.toDateString(),
      oneMonthAgo: oneMonthAgo.toDateString(),
      isEligible: assignmentDate >= oneMonthAgo,
      daysDifference: Math.floor(
        (new Date().getTime() - assignmentDate.getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    });

    return assignmentDate >= oneMonthAgo;
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
        {/* Header with Report Guidelines button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Past Assignments
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              View your completed assignments and confirm visits
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowGuidelines(true)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <FileText className="h-4 w-4 mr-2" />
            Report Guidelines
          </Button>
        </div>

        {/* Error and Success Messages */}
        {confirmError && (
          <div className="mb-4 p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
            <p className="font-medium">Error:</p>
            <p>{confirmError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {confirmSuccess && (
          <div className="mb-4 p-4 rounded-md bg-green-50 border border-green-200 text-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <p className="font-medium">{confirmSuccess}</p>
            </div>
          </div>
        )}

        {reportError && (
          <div className="mb-4 p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
            <p className="font-medium">Report Error:</p>
            <p>{reportError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {reportSuccess && (
          <div className="mb-4 p-4 rounded-md bg-green-50 border border-green-200 text-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <p className="font-medium">{reportSuccess}</p>
            </div>
          </div>
        )}

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
                      !assignment.has_visited ||
                      assignment.has_visited) && (
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
                          <div className="pt-3 border-t border-gray-100 space-y-3">
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                Visit completed
                              </span>
                            </div>

                            {/* Report section - Always show for visited assignments */}
                            {(() => {
                              const isEligible =
                                isEligibleForReport(assignment);
                              console.log(
                                `🔍 Assignment ${assignment.aid} visited=${assignment.has_visited}, eligible=${isEligible}`
                              );
                              return isEligible;
                            })() && (
                              <div className="space-y-2">
                                {assignment.report ? (
                                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                                    <div className="flex items-center justify-between mb-2">
                                      <strong className="text-blue-800">
                                        Your Report:
                                      </strong>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setReportText(
                                            assignment.report || ""
                                          );
                                          setShowReportDialog(assignment.aid);
                                        }}
                                        className="h-6 px-2 text-xs"
                                      >
                                        <Edit3 className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                    </div>
                                    <p className="text-blue-700">
                                      {assignment.report}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">
                                      Submit a report for this visit
                                    </span>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setReportText("");
                                        setShowReportDialog(assignment.aid);
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-3 text-xs"
                                    >
                                      <FileText className="h-3 w-3 mr-1" />
                                      Write Report
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
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

      {/* Report Guidelines Dialog */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              Report Guidelines
            </DialogTitle>
            <DialogDescription className="text-base">
              Important guidelines for submitting reports to the District
              Leaders
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-3">
                When sending in a report for the DLs to view, please describe
                the following:
              </h4>
              <div className="text-red-700 leading-relaxed">
                <p>
                  - The physical state of the senior (according to the 6
                  Activities of Daily Living:
                  <strong>
                    {" "}
                    washing, toileting, dressing, feeding, mobility, and
                    transferring
                  </strong>
                  (in and out of a bed or a chair))
                  <br /> - The mental health of the senior (whether he/she can
                  converse well/remember things etc) <br /> - How bonded he/she
                  currently is to the community <br /> - Whether the senior has
                  received support from government schemes <br /> - The extent
                  to which the senior is making ends meet <br /> - What his/her
                  living conditions are like.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowGuidelines(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Submission Dialog */}
      <Dialog
        open={!!showReportDialog}
        onOpenChange={() => setShowReportDialog(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {assignments.find((a) => a.aid === showReportDialog)?.report
                ? "Edit Report"
                : "Write Report"}
            </DialogTitle>
            <DialogDescription>
              {showReportDialog &&
                (() => {
                  const assignment = assignments.find(
                    (a) => a.aid === showReportDialog
                  );
                  const seniorDetails = assignment
                    ? getSeniorDetails(assignment.sid)
                    : null;
                  return `Report for visit to ${
                    seniorDetails?.name || "Senior"
                  } on ${
                    assignment
                      ? new Date(assignment.date).toLocaleDateString()
                      : ""
                  }`;
                })()}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="text-yellow-800">
                  <strong>Tip:</strong> Use the Report Guidelines for
                  comprehensive reporting. Include physical state, mental
                  health, community connection, government support, financial
                  situation, and living conditions.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Report Content
                </label>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Describe your visit and observations about the senior's wellbeing..."
                  className="w-full min-h-[200px] p-3 border border-gray-300 rounded-md resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={submittingReport === showReportDialog}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowReportDialog(null);
                setReportText("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                showReportDialog && handleSubmitReport(showReportDialog)
              }
              disabled={
                !reportText.trim() || submittingReport === showReportDialog
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submittingReport === showReportDialog ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3 mr-1" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
