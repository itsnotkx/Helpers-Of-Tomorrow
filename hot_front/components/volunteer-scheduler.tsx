"use client"

import { useState, useEffect } from "react"
import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"


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


export default function VolunteerSchedule() {

    return (
        <div>
            
            <div className="flex justify-center mb-6">  
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
                    <CardFooter className="flex justify-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                        <span className="text-sm">Acknowledge</span>
                        </label>
                    </CardFooter>
                    </Card>
                ))}
            </div> 
    </div>
    )
}