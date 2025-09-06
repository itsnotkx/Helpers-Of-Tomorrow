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

  return (
    <div className="max-w-4xl mx-auto">
      <DashboardHeader
        title="Your Volunteer Schedule"
        subtitle="Managing care for Singapore"
        selectedDistrict=""
       />

      {/* Change colour here */}
      <div className="flex justify-end mt-4 mb-6">
        <Button
          onClick={push}
          className="bg-red-600 hover:bg-red-700 text-white text-lg px-6 py-3 rounded-lg shadow-md"
        >
          <Activity className="h-5 w-5 mr-2" />
          Indicate Your Availability
        </Button>
      </div>

      <VolunteerSchedule />
    </div>
  )
}
