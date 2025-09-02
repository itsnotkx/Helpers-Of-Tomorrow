"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Users, Calendar, AlertTriangle, Activity, ChevronDown, ChevronUp } from "lucide-react"
import { InteractiveMap } from "@/components/interactive-map"
import { ScheduleInterface } from "@/components/schedule-interface"
import { DashboardHeader } from "@/components/dashboard-header"

interface Senior {
  uid: string
  name?: string
  coords: { lat: number; lng: number }
  physical?: number
  mental?: number
  community?: number
  last_visit?: string
  cluster?: number
}

interface Volunteer {
  vid: string
  name?: string
  coords: { lat: number; lng: number }
  skill?: number
  available?: string[]
}

interface Assessment {
  uid: string
  risk: number
  priority: "HIGH" | "MEDIUM" | "LOW"
  needscare: boolean
}

interface Assignment {
  volunteer: string
  cluster: number
  weighted_distance: number
}

interface Schedule {
  volunteer: string
  senior: string
  cluster: number
  datetime: string
  duration: number
}

export default function VolunteerDashboard() {
  const [seniors, setSeniors] = useState<Senior[]>([])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDistrict, setSelectedDistrict] = useState("Central Singapore")
  const [isMapCollapsed, setIsMapCollapsed] = useState(false)
  const [isAssignmentsCollapsed, setIsAssignmentsCollapsed] = useState(false)

  // -------------------------------
  // Load Data from API
  // -------------------------------
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const BASE_URL = "http://localhost:8000"

      // 1. Fetch seniors and volunteers
      const [seniorsRes, volunteersRes] = await Promise.all([
        fetch(`${BASE_URL}/seniors`).then(r => r.json()),
        fetch(`${BASE_URL}/volunteers`).then(r => r.json())
      ])

      setSeniors(seniorsRes.seniors)
      setVolunteers(volunteersRes.volunteers)

      // 2. Fetch risk assessments
      const assessmentsRes = await fetch(`${BASE_URL}/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seniors: seniorsRes.seniors })
      }).then(r => r.json())

      setAssessments(assessmentsRes.assessments)

      // 3. Fetch assignments & clusters
      const allocationRes = await fetch(`${BASE_URL}/assignments`).then(r => r.json())
      setAssignments(allocationRes.assignments)

      // 4. Fetch schedules
      const scheduleRes = await fetch(`${BASE_URL}/schedules`).then(r => r.json())
      setSchedules(scheduleRes.schedules)

    } catch (err) {
      console.error("Failed to load dashboard data", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // -------------------------------
  // Dashboard Stats
  // -------------------------------
  const highPrioritySeniors = seniors.filter(s =>
    assessments?.find(a => a.uid === s.uid)?.priority === "HIGH"
  )
  const highRiskCount = highPrioritySeniors.length
  const activeVolunteers = volunteers.filter(v => v.available && v.available.length > 0).length
  const todaySchedules = schedules.filter(s => new Date(s.datetime).toDateString() === new Date().toDateString())

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Senior Care Volunteer Dashboard"
        subtitle={`Managing care for ${selectedDistrict}`}
        selectedDistrict={selectedDistrict}
        usingMockData={false}
        onTryConnectApi={loadDashboardData}
        onRefresh={loadDashboardData}
      />

      <div className="container mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Seniors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{seniors.length}</div>
              <p className="text-xs text-muted-foreground">{highRiskCount} high risk</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Volunteers</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeVolunteers}</div>
              <p className="text-xs text-muted-foreground">of {volunteers.length} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todaySchedules.length}</div>
              <p className="text-xs text-muted-foreground">scheduled visits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{highRiskCount}</div>
              <p className="text-xs text-muted-foreground">need immediate care</p>
            </CardContent>
          </Card>
        </div>

        {/* Map Section */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" /> District Map & Clusters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsMapCollapsed(!isMapCollapsed)}>
              {isMapCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {!isMapCollapsed && (
            <CardContent>
              <InteractiveMap seniors={seniors} volunteers={volunteers} assignments={assignments} schedules={schedules} />
            </CardContent>
          )}
        </Card>

        {/* Schedule */}
        <ScheduleInterface schedules={schedules} volunteers={volunteers} assignments={assignments} />

        {/* Assignments */}
        <Card className="mt-6">
          <CardHeader className="flex justify-between">
            <CardTitle>Volunteer Assignments</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsAssignmentsCollapsed(!isAssignmentsCollapsed)}>
              {isAssignmentsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {!isAssignmentsCollapsed && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignments.map((a, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <div className="flex justify-between mb-2">
                      <h4 className="font-medium">{a.volunteer}</h4>
                      <Badge variant="secondary">{a.cluster}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Distance: {a.weighted_distance} km</p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
