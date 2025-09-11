"use client";

import VolunteerSchedule from "@/components/volunteer-scheduler";
import { PastAssignments } from "@/components/past-assignments";
import { DashboardHeader } from "@/components/dashboard-header";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Activity, History } from "lucide-react";
import { useState } from "react";

export default function Scheduler() {
  const router = useRouter();
  const [showPastAssignments, setShowPastAssignments] = useState(false);

  const push = () => {
    router.push("/indicate-availability");
  };

  // Check if today is Sunday
  const today = new Date();
  const isSunday = today.getDay() === 0;

  if (showPastAssignments) {
    return (
      <div className="max-w-4xl mx-auto">
        <DashboardHeader
          title="Your Past Assignments"
          subtitle="View your assignment history"
          selectedDistrict="Singapore"
          onSelectedDistrict={false}
          onDistrictChange={() => {}}
        />

        <div className="flex justify-start mt-4 mb-6">
          <Button
            onClick={() => setShowPastAssignments(false)}
            className="flex items-center gap-2 text-lg px-6 py-3 rounded-lg shadow-md bg-red-600 hover:bg-red-700 text-white"
          >
            ← Back to Current Schedule
          </Button>
        </div>

        <PastAssignments />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <DashboardHeader
        title="Your Volunteer Schedule"
        subtitle="Managing care for Singapore"
        selectedDistrict="Singapore"
        onSelectedDistrict={false}
        onDistrictChange={() => {}} // No-op since this is volunteer view
      />

      {/* Buttons section */}
      <div className="flex flex-col md:flex-row items-center justify-between mt-4 mb-6 gap-4">
        <Button
          onClick={() => setShowPastAssignments(true)}
          variant="outline"
          className="flex items-center gap-2 text-lg px-6 py-3 rounded-lg shadow-md bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
        >
          <History className="h-5 w-5" />
          View Past Assignments
        </Button>

        <div className="flex flex-col items-end">
          <Button
            onClick={push}
            disabled={isSunday}
            className={`text-lg px-6 py-3 rounded-lg shadow-md ${
              isSunday
                ? "bg-gray-400 cursor-not-allowed text-gray-600"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            <Activity className="h-5 w-5 mr-2" />
            Indicate Your Availability
          </Button>

          <p className="text-sm text-gray-600 mt-2 text-right">
            {isSunday
              ? "⚠️ Availability submission is not available on Sundays"
              : "Please submit your availability by Saturday 11:59 PM"}
          </p>
        </div>
      </div>

      <VolunteerSchedule />
    </div>
  );
}
