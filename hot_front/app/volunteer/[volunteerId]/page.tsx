
import type React from "react"
import VolunteerSchedule from "@/components/volunteer-scheduler" 

export default async function Scheduler({
  params,
}: {
  params: Promise<{ volunteerId: string }>
}) {
  const { volunteerId } = await params

  return <VolunteerSchedule userId={volunteerId} />
}
