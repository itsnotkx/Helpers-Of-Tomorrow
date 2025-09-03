"use client"

import { useState, useEffect } from "react"
import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { DashboardHeader } from "@/components/dashboard-header"
import { useRouter } from "next/navigation"


type Schedule = {
  id: string
  name: string
  day: string
  time: string
  task: string
}

const schedules: Schedule[] = [
  { id: "1", name: "John Doe", day: "Monday", time: "10:00 - 12:00", task: "Check-in calls" },
  { id: "2", name: "Jane Smith", day: "Tuesday", time: "14:00 - 16:00", task: "Grocery assistance" },
  { id: "3", name: "Alex Tan", day: "Friday", time: "09:00 - 11:00", task: "Community walk" },
]


export default function VolunteerSchedule({  userId }: { userId: string }) {
    const router = useRouter()

    const refresh = () => {
        router.refresh()
    }

    return (
        <div>
            <DashboardHeader
                title="Your Volunteer Schedule"
                subtitle={`Managing care for Singapore`}
                selectedDistrict="Singapore"
                usingMockData={false}
                onTryConnectApi={refresh}
                onRefresh={refresh}
            />
            <div className="flex justify-center mb-6">
                <div> {userId} </div>
            </div>

            <div className="max-w-lg mx-auto space-y-4">
                {schedules.map((s) => (
                    <Card key={s.id} className="shadow-md">
                    <CardHeader>
                        <CardTitle>{s.name}</CardTitle>
                        <CardDescription>
                        {s.day} — {s.time}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">{s.task}</p>
                    </CardContent>
                    <CardFooter>
                        <button className="text-red-600 text-sm hover:underline">Acknowledge</button>
                    </CardFooter>
                    </Card>
                ))}
            </div>      
    </div>
    )
}