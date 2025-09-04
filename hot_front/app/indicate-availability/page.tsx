"use client"
import { WeeklyTimeSlotForm } from "@/components/weekly-time-slot-form"
import { DashboardHeader } from "@/components/dashboard-header"
import { useRouter } from "next/navigation"


export default function Home() {

  const router = useRouter()
  
  const push = () => {
    router.push('/volunteer')
  }

  return (
    <main className="container mx-auto pb-8 px-4">

      <div className="max-w-4xl mx-auto">
        <DashboardHeader  
          title="Volunteer Availability"
          subtitle={`Managing care for Singapore`}
          selectedDistrict="Singapore"
          needButton={true}
          textToInput="See Your Schedule"
          onRefresh={push}
        />
        <WeeklyTimeSlotForm />
      </div>
    </main>
  )
}
