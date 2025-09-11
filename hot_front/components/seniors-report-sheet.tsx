"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  X,
  ArrowUpDown,
  Edit,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Shield,
} from "lucide-react";
import { Senior } from "@/app/page";
import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Extend Senior interface to include has_dl_intervened if not already present
interface ExtendedSenior extends Senior {
  has_dl_intervened?: boolean;
}

interface SeniorsReportSheetProps {
  filteredSeniors: ExtendedSenior[];
  selectedDistrict: string;
  constituencyName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSeniorClick: (seniorId: string) => void;
  children: React.ReactNode;
}

export function SeniorsReportSheet({
  filteredSeniors,
  selectedDistrict,
  constituencyName,
  isOpen,
  onOpenChange,
  onSeniorClick,
  children,
}: SeniorsReportSheetProps) {
  // Debug: Log a sample senior to see what fields are available
  if (filteredSeniors.length > 0) {
    console.log("Sample senior data:", filteredSeniors[0]);
    console.log("Available fields:", Object.keys(filteredSeniors[0]));
  }
  // Sorting state for the seniors table
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyComplete, setClassifyComplete] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [updateSeniorValues, setUpdateSeniorValues] = useState<
    Record<string, [number | null, number, string]>
  >({});

  // Wellbeing update state
  const [isUpdatingWellbeing, setIsUpdatingWellbeing] = useState<string | null>(
    null
  );
  const [showWellbeingDialog, setShowWellbeingDialog] = useState<string | null>(
    null
  );
  const [selectedWellbeing, setSelectedWellbeing] = useState<number | null>(
    null
  );

  // Reset intervention state
  const [isResettingIntervention, setIsResettingIntervention] = useState<
    string | null
  >(null);

  const wellbeingLabels: Record<number, string> = {
    1: "Poor", // High Risk
    2: "Normal", // Medium Risk
    3: "Good", // Low Risk
  };

  const healthLabels: Record<number, string> = {
    1: "Very Poor",
    2: "Poor",
    3: "Normal",
    4: "Good",
    5: "Very Good",
  };

  const livingConditionsLabels: Record<string, string> = {
    "1": "Very Poor",
    "2": "Poor",
    "3": "Adequate",
    "4": "Good",
    "5": "Excellent",
  };

  const makingEndsMeetLabels: Record<string, string> = {
    "1": "Very Difficult",
    "2": "Difficult",
    "3": "Managing",
    "4": "Comfortable",
    "5": "Very Comfortable",
  };

  // Handle wellbeing update confirmation
  const handleWellbeingUpdate = async (
    seniorId: string,
    newWellbeing: number
  ) => {
    try {
      console.log("=== WELLBEING UPDATE DEBUG ===");
      console.log("Senior ID being updated:", seniorId);
      console.log("New wellbeing value:", newWellbeing);
      console.log(
        "Senior object:",
        filteredSeniors.find((s) => s.uid === seniorId)
      );

      setIsUpdatingWellbeing(seniorId);

      const BASE_URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const requestBody = {
        sid: seniorId,
        overall_wellbeing: newWellbeing,
      };

      console.log("Request body being sent:", requestBody);
      console.log("Making request to:", `${BASE_URL}/wellbeing`);

      const response = await fetch(`${BASE_URL}/wellbeing`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      const result = await response.json();
      console.log("Response data:", result);

      if (response.ok && result.success) {
        // Close dialog and show success
        setShowWellbeingDialog(null);
        setSelectedWellbeing(null);
        alert(`Wellbeing updated successfully for senior ${seniorId}!`);
        // Update the local state instead of refreshing the page
        // This will keep the user on the sheet
        window.location.reload();
      } else {
        console.error("Failed to update wellbeing:", result);
        alert(
          `Failed to update wellbeing: ${
            result.message || result.error || "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("Error updating wellbeing:", error);
      alert(
        `Error updating wellbeing: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsUpdatingWellbeing(null);
    }
  };

  // Handle reset DL intervention
  const handleResetIntervention = async (seniorId: string) => {
    try {
      setIsResettingIntervention(seniorId);
      const BASE_URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const response = await fetch(`${BASE_URL}/reset-intervention`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sid: seniorId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert("DL intervention flag reset successfully!");
        window.location.reload();
      } else {
        console.error("Failed to reset intervention flag:", result);
        alert(
          `Failed to reset intervention flag: ${
            result.message || result.error || "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("Error resetting intervention flag:", error);
      alert(
        `Error resetting intervention flag: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsResettingIntervention(null);
    }
  };

  // Handle opening wellbeing dialog
  const handleOpenWellbeingDialog = (
    seniorId: string,
    currentWellbeing: number
  ) => {
    setShowWellbeingDialog(seniorId);

    // Auto-select the first available option that's different from current
    let firstAvailableOption: number;
    if (currentWellbeing === 1) {
      firstAvailableOption = 2; // Normal (Medium Risk) - different from current
    } else if (currentWellbeing === 2) {
      firstAvailableOption = 1; // Poor (High Risk) - different from current
    } else {
      firstAvailableOption = 1; // Poor (High Risk) - different from current
    }

    setSelectedWellbeing(firstAvailableOption);
  };

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Unified priority mapping
  const getPriorityLevel = (
    wellbeing: 1 | 2 | 3
  ): "HIGH" | "MEDIUM" | "LOW" => {
    return wellbeing === 1 ? "HIGH" : wellbeing === 2 ? "MEDIUM" : "LOW";
  };

  const handleSeniorRowClick = (seniorId: string) => {
    onSeniorClick(seniorId);
    onOpenChange(false);
  };

  const classifySeniors = async () => {
    setClassifyLoading(true);
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      }/assess`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (response.ok) {
      setClassifyLoading(false);
      const result = await response.json();
      const numEntries = result ? Object.keys(result).length : 0;
      if (numEntries === 0) {
        setUpdateCount(0);
      } else {
        setUpdateCount(numEntries);
        setUpdateSeniorValues(result);
        // if (Array.isArray(result)) {

        // } else {
        //   setUpdateSeniorValues([result]);
        // }
        console.log("Update Count:", updateCount);
        console.log("Classification result:", result);

        Object.entries(updateSeniorValues).map(([key, values]) => {
          console.log("Senior:", key, "Values:", values);
        });
      }
      setClassifyComplete(true);
      // alert(`Successfully classified ${Object.keys(result).length} seniors!`);
    }
  };

  const closeDialogue = () => {
    setClassifyComplete(false);
    window.location.reload();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-screen sm:max-w-[100vw] p-0 overflow-y-auto"
      >
        {/* Sticky header inside sheet */}
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-full px-4 md:px-6">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Seniors Report -{" "}
                  {selectedDistrict === "All"
                    ? "All Districts"
                    : constituencyName}{" "}
                  ({filteredSeniors.length} total)
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={classifySeniors}
                    className={
                      "text-lg px-6 py-3 cursor-pointer rounded-lg shadow-md bg-red-600 hover:bg-red-700 text-white"
                    }
                    title={`AI will reassess the wellbeing of seniors \nOnly those without manual intervention will be reassessed \nReset to allow AI reassessment`}
                  >
                    <Activity className="h-5 w-5 mr-2" />
                    {classifyLoading ? "Classifying..." : "Classify Seniors"}
                  </Button>
                  <text className="text-sm text-muted-foreground">Only those without manual intervention will be reassessed</text>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </SheetTitle>
            </SheetHeader>
          </div>
        </div>

        {/* Diagloug for wellbeing update */}
        <Dialog open={classifyComplete} onOpenChange={setClassifyComplete}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Seniors with Updated Wellbeing ({updateCount})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {updateCount === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No seniors had their risk assessments updated.
                </p>
              ) : (
                Object.entries(updateSeniorValues).map(([key, values]) => {
                  return (
                    <div key={values[2]} className="rounded-lg border">
                      <Card className=":border-l-4">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">
                                {key || `Senior ${values[2]}`}
                              </h3>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-sm font-medium">
                                Previous Wellbeing
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {values[0]
                                  ? wellbeingLabels[values[0]]
                                  : "Not assessed"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                Updated Wellbeing
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {wellbeingLabels[values[1]] ||
                                  `Level ${values[1]}`}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })
              )}
            </div>
            <DialogFooter>
              <Button onClick={closeDialogue} className="cursor-pointer w-full">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sheet body */}
        <div className="mx-auto w-full px-4 md:px-6 pb-12 pt-4">
          {filteredSeniors.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No seniors found for the selected district.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/20 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {
                      filteredSeniors.filter((s) => s.overall_wellbeing === 1)
                        .length
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">High Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {
                      filteredSeniors.filter((s) => s.overall_wellbeing === 2)
                        .length
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Medium Risk
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {
                      filteredSeniors.filter((s) => s.overall_wellbeing === 3)
                        .length
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Low Risk</div>
                </div>
              </div>

              {/* Seniors table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("name")}
                        >
                          Name
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("age")}
                        >
                          Age
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("overall_wellbeing")}
                        >
                          Overall Wellbeing
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("has_dl_intervened")}
                        >
                          Has Manual Intervention
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("physical")}
                        >
                          Physical Health
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("mental")}
                        >
                          Mental Health
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("community")}
                        >
                          Community Support
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("last_visit")}
                        >
                          Last Visit
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("dl_intervention")}
                        >
                          DL Intervention
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("rece_gov_sup")}
                        >
                          Govt Support
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("making_ends_meet")}
                        >
                          Making Ends Meet
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("living_situation")}
                        >
                          Living Situation
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button
                          className="flex items-center gap-1 hover:text-primary cursor-pointer"
                          onClick={() => handleSort("address")}
                        >
                          Address
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredSeniors]
                      .sort((a, b) => {
                        if (sortColumn) {
                          let aValue: string | number;
                          let bValue: string | number;

                          switch (sortColumn) {
                            case "name":
                              aValue = a.name || a.uid;
                              bValue = b.name || b.uid;
                              break;
                            case "age":
                              aValue = a.age || 0;
                              bValue = b.age || 0;
                              break;
                            case "overall_wellbeing":
                              aValue = a.overall_wellbeing;
                              bValue = b.overall_wellbeing;
                              break;
                            case "physical":
                              aValue = a.physical || 0;
                              bValue = b.physical || 0;
                              break;
                            case "mental":
                              aValue = a.mental || 0;
                              bValue = b.mental || 0;
                              break;
                            case "community":
                              aValue = a.community || 0;
                              bValue = b.community || 0;
                              break;
                            case "last_visit":
                              aValue = a.last_visit
                                ? new Date(a.last_visit).getTime()
                                : 0;
                              bValue = b.last_visit
                                ? new Date(b.last_visit).getTime()
                                : 0;
                              break;
                            case "dl_intervention":
                              aValue = a.dl_intervention ? 1 : 0;
                              bValue = b.dl_intervention ? 1 : 0;
                              break;
                            case "has_dl_intervened":
                              aValue = a.has_dl_intervened ? 1 : 0;
                              bValue = b.has_dl_intervened ? 1 : 0;
                              break;
                            case "rece_gov_sup":
                              aValue = a.rece_gov_sup ? 1 : 0;
                              bValue = b.rece_gov_sup ? 1 : 0;
                              break;
                            case "making_ends_meet":
                              aValue = a.making_ends_meet || "";
                              bValue = b.making_ends_meet || "";
                              break;
                            case "living_situation":
                              aValue = a.living_situation || "";
                              bValue = b.living_situation || "";
                              break;
                            case "address":
                              aValue = a.address || "";
                              bValue = b.address || "";
                              break;
                            default:
                              aValue = "";
                              bValue = "";
                          }

                          if (
                            typeof aValue === "string" &&
                            typeof bValue === "string"
                          ) {
                            return sortDirection === "asc"
                              ? aValue.localeCompare(bValue)
                              : bValue.localeCompare(aValue);
                          } else {
                            const numA =
                              typeof aValue === "number" ? aValue : 0;
                            const numB =
                              typeof bValue === "number" ? bValue : 0;
                            return sortDirection === "asc"
                              ? numA - numB
                              : numB - numA;
                          }
                        } else {
                          // Default sort: wellbeing (high risk first), then by name
                          if (a.overall_wellbeing !== b.overall_wellbeing) {
                            return a.overall_wellbeing - b.overall_wellbeing;
                          }
                          return (a.name || a.uid).localeCompare(
                            b.name || b.uid
                          );
                        }
                      })
                      .map((senior) => {
                        const priorityLevel = getPriorityLevel(
                          senior.overall_wellbeing
                        );
                        const priorityColors = {
                          HIGH: "bg-red-50 border-l-red-500",
                          MEDIUM: "bg-orange-50 border-l-orange-500",
                          LOW: "bg-green-50 border-l-green-500",
                        };

                        return (
                          <tr
                            key={senior.uid}
                            className={`border-b hover:bg-muted/20 transition-colors border-l-4 ${priorityColors[priorityLevel]}`}
                            // onClick={() => handleSeniorRowClick(senior.uid)}
                          >
                            <td className="p-3">
                              <div className="font-medium">
                                {senior.name || `Senior ${senior.uid}`}
                              </div>
                            </td>
                            <td className="p-3 text-sm">
                              {senior.age
                                ? `${senior.age} years`
                                : "Not recorded"}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    priorityLevel === "HIGH"
                                      ? "destructive"
                                      : priorityLevel === "MEDIUM"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className={
                                    priorityLevel === "MEDIUM"
                                      ? "bg-orange-100 text-orange-800 border-orange-200"
                                      : ""
                                  }
                                >
                                  {wellbeingLabels[senior.overall_wellbeing] ||
                                    "Unknown"}
                                </Badge>

                                <Dialog
                                  open={showWellbeingDialog === senior.uid}
                                  onOpenChange={(open) => {
                                    setShowWellbeingDialog(
                                      open ? senior.uid : null
                                    );
                                    if (!open) setSelectedWellbeing(null);
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-muted"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent row click
                                        handleOpenWellbeingDialog(
                                          senior.uid,
                                          senior.overall_wellbeing
                                        );
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                      <DialogTitle>
                                        Manual Wellbeing Override
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                          <span className="font-medium text-yellow-800">
                                            Important Notice
                                          </span>
                                        </div>
                                        <p className="text-sm text-yellow-700">
                                          Manual wellbeing changes are{" "}
                                          <strong>not recommended</strong> as
                                          they override the AI assessment
                                          system. Please ensure you have valid
                                          reasons for this change.
                                        </p>
                                      </div>

                                      <div className="text-sm">
                                        <strong>Senior:</strong>{" "}
                                        {senior.name || `Senior ${senior.uid}`}
                                      </div>

                                      <div className="text-sm">
                                        <strong>Current wellbeing:</strong>{" "}
                                        {
                                          wellbeingLabels[
                                            senior.overall_wellbeing
                                          ]
                                        }
                                      </div>

                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                          New wellbeing level:
                                        </label>
                                        <Select
                                          value={selectedWellbeing?.toString()}
                                          onValueChange={(value) =>
                                            setSelectedWellbeing(
                                              parseInt(value)
                                            )
                                          }
                                          disabled={
                                            isUpdatingWellbeing === senior.uid
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select new wellbeing level" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {senior.overall_wellbeing !== 1 && (
                                              <SelectItem value="1">
                                                Poor (High Risk)
                                              </SelectItem>
                                            )}
                                            {senior.overall_wellbeing !== 2 && (
                                              <SelectItem value="2">
                                                Normal (Medium Risk)
                                              </SelectItem>
                                            )}
                                            {senior.overall_wellbeing !== 3 && (
                                              <SelectItem value="3">
                                                Good (Low Risk)
                                              </SelectItem>
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="flex gap-2 pt-4">
                                        <Button
                                          onClick={() => {
                                            setShowWellbeingDialog(null);
                                            setSelectedWellbeing(null);
                                          }}
                                          variant="outline"
                                          className="flex-1"
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            if (selectedWellbeing !== null) {
                                              handleWellbeingUpdate(
                                                senior.uid,
                                                selectedWellbeing
                                              );
                                            }
                                          }}
                                          disabled={
                                            selectedWellbeing === null ||
                                            isUpdatingWellbeing === senior.uid
                                          }
                                          variant="destructive"
                                          className="flex-1"
                                        >
                                          {isUpdatingWellbeing ===
                                          senior.uid ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Updating...
                                            </>
                                          ) : (
                                            "Confirm Update"
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </td>
                            <td className="p-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    senior.has_dl_intervened
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className={
                                    senior.has_dl_intervened
                                      ? "bg-orange-600 text-white"
                                      : ""
                                  }
                                >
                                  {senior.has_dl_intervened
                                    ? "True"
                                    : "False"}
                                </Badge>
                                {senior.has_dl_intervened && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-muted"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent row click
                                      handleResetIntervention(senior.uid);
                                    }}
                                    disabled={
                                      isResettingIntervention === senior.uid
                                    }
                                    title="Reset to allow AI classification"
                                  >
                                    {isResettingIntervention === senior.uid ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-sm">
                              {senior.physical
                                ? healthLabels[senior.physical]
                                : "Not assessed"}
                            </td>
                            <td className="p-3 text-sm">
                              {senior.mental
                                ? healthLabels[senior.mental]
                                : "Not assessed"}
                            </td>
                            <td className="p-3 text-sm">
                              {senior.community
                                ? healthLabels[senior.community]
                                : "Not assessed"}
                            </td>
                            <td className="p-3 text-sm">
                              {senior.last_visit ? (
                                <div>
                                  <div>
                                    {new Date(
                                      senior.last_visit
                                    ).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {Math.floor(
                                      (new Date().getTime() -
                                        new Date(senior.last_visit).getTime()) /
                                        (1000 * 60 * 60 * 24)
                                    )}{" "}
                                    days ago
                                  </div>
                                </div>
                              ) : (
                                <span className="text-orange-600 font-medium">
                                  Never visited
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              <Badge
                                variant={
                                  senior.dl_intervention
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  senior.dl_intervention
                                    ? "bg-green-600 text-white"
                                    : ""
                                }
                              >
                                {senior.dl_intervention ? "Yes" : "No"}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm">
                              <Badge
                                variant={
                                  senior.rece_gov_sup ? "default" : "secondary"
                                }
                                className={
                                  senior.rece_gov_sup
                                    ? "bg-blue-600 text-white"
                                    : ""
                                }
                              >
                                {senior.rece_gov_sup ? "Yes" : "No"}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm">
                              {senior.making_ends_meet
                                ? makingEndsMeetLabels[
                                    senior.making_ends_meet
                                  ] || senior.making_ends_meet
                                : "Not recorded"}
                            </td>
                            <td className="p-3 text-sm">
                              {senior.living_situation
                                ? livingConditionsLabels[
                                    senior.living_situation
                                  ] || senior.living_situation
                                : "Not recorded"}
                            </td>
                            <td className="p-3 text-sm">
                              {senior.address || "Address not available"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
