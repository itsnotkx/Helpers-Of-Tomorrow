'use client'

import type React from "react"
import VolunteerSchedule from "@/components/volunteer-scheduler" 
import { DashboardHeader } from "@/components/dashboard-header"
import { useRouter } from "next/navigation"

export default function Scheduler() {
  const router = useRouter()

  const push = () => {
    router.push('/indicate-availability')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <DashboardHeader
        title="Your Volunteer Schedule"
        subtitle={`Managing care for Singapore`}
        selectedDistrict="Yishun"
        needButton={true}
        textToInput="Indicate Your Availability"
        onRefresh={push}
      />
      <VolunteerSchedule/>
    </div>
  )
}
