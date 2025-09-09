"use client"

import VolunteerSchedule from "@/components/volunteer-scheduler"
import { DashboardHeader } from "@/components/dashboard-header"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Activity } from "lucide-react"

export default function Scheduler() {
  const router = useRouter()

  const push = () => {
    router.push("/indicate-availability")
  }

  // Check if today is Sunday
  const today = new Date()
  const isSunday = today.getDay() === 0

  return (
    <div className="max-w-4xl mx-auto">
      <DashboardHeader
        title="Your Volunteer Schedule"
        subtitle="Managing care for Singapore"
        selectedDistrict="Singapore"
        onDistrictChange={() => {}} // No-op since this is volunteer view
      />

      {/* Change colour here */}
      <div className="flex flex-col items-end mt-4 mb-6">
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
          {isSunday ? (
            "⚠️ Availability submission is not available on Sundays"
          ) : (
            "Please submit your availability by Saturday 11:59 PM"
          )}
        </p>
      </div>

      <VolunteerSchedule />
    </div>
  )
}
