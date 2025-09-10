"use client"
import { WeeklyTimeSlotForm } from "@/components/weekly-time-slot-form"
import { DashboardHeader } from "@/components/dashboard-header"
import { useRouter } from "next/navigation"


export default function Home() {

  const router = useRouter()
  
  const push = () => {
    router.push('/volunteer')
  }

  // Check if today is Sunday
  const today = new Date()
  const isSunday = today.getDay() === 0

  return (
    <main className="container mx-auto pb-8 px-4">

      <div className="max-w-4xl mx-auto">
        <DashboardHeader  
          title="Volunteer Availability"
          subtitle={`Managing care for Singapore`}
          selectedDistrict="Singapore"
          onDistrictChange={() => {}} // No-op since this is volunteer view
          />
          {isSunday && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
    <p className="text-yellow-800 text-center">
      ⚠️ <strong>Availability submission is not available on Sundays.</strong><br />
      Please return on Monday to submit your availability for the upcoming week.
    </p>
  </div>
)}

{!isSunday && (
  <p className="text-center text-gray-600 mb-6">
    Please save your availability by <strong>Saturday 11:59 PM</strong>
  </p>
)}

        <WeeklyTimeSlotForm />
        {isSunday && (
          <div className="text-center py-8">
            <p className="text-lg text-gray-600">
              Availability submission is closed on Sundays. Please return tomorrow to set your schedule.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
