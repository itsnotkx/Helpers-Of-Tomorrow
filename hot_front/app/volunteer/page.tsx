"use client"
import { WeeklyTimeSlotForm } from "@/components/weekly-time-slot-form"

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <WeeklyTimeSlotForm />
      </div>
    </main>
  )
}
