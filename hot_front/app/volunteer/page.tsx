"use client"
import { WeeklyTimeSlotForm } from "@/components/weekly-time-slot-form"
import { DashboardHeader } from "@/components/dashboard-header"
import { useRouter } from "next/navigation"


export default function Home() {
  const router = useRouter()
  
  const refresh = () => {
      router.refresh()
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <DashboardHeader
          title="Volunteer Availability Submission"
          subtitle={`Managing care for Singapore`}
          selectedDistrict="Singapore"
          usingMockData={false}
          onTryConnectApi={refresh}
          onRefresh={refresh}
        />
        <WeeklyTimeSlotForm />
      </div>
    </main>
  )
}
