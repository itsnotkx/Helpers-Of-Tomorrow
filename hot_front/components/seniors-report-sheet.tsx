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
import { Users, X, ArrowUpDown } from "lucide-react";
import { Senior } from "@/app/page";

interface SeniorsReportSheetProps {
  filteredSeniors: Senior[];
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
  // Sorting state for the seniors table
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const wellbeingLabels: Record<number, string> = {
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
                          let aValue: any;
                          let bValue: any;

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

                          if (typeof aValue === "string") {
                            return sortDirection === "asc"
                              ? aValue.localeCompare(bValue)
                              : bValue.localeCompare(aValue);
                          } else {
                            return sortDirection === "asc"
                              ? aValue - bValue
                              : bValue - aValue;
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
                            className={`border-b hover:bg-muted/20 transition-colors cursor-pointer border-l-4 ${priorityColors[priorityLevel]}`}
                            onClick={() => handleSeniorRowClick(senior.uid)}
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
                            </td>
                            <td className="p-3 text-sm">
                              {senior.physical
                                ? wellbeingLabels[senior.physical]
                                : "Not assessed"}
                            </td>
                            <td className="p-3 text-sm">
                              {senior.mental
                                ? wellbeingLabels[senior.mental]
                                : "Not assessed"}
                            </td>
                            <td className="p-3 text-sm">
                              {senior.community
                                ? wellbeingLabels[senior.community]
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
