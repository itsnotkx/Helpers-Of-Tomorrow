"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MapPin, Users, Calendar, AlertTriangle, Activity, ChevronDown, ChevronUp } from "lucide-react"
import { InteractiveMap } from "@/components/interactive-map"
import { ScheduleInterface } from "@/components/schedule-interface"
import { DashboardHeader } from "@/components/dashboard-header"
// import { useOrganization } from "@clerk/nextjs"
// import { useRouter } from "next/navigation"


interface Senior {
  uid: string
  name?: string
  coords: { lat: number; lng: number }
  physical?: number
  mental?: number
  community?: number
  last_visit?: string
  cluster?: number
  overall_wellbeing?: 1 | 2 | 3
}

interface Volunteer {
  vid: string
  email?: string
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
  const [isScheduleCollapsed, setIsScheduleCollapsed] = useState(false)
  const [isAssignmentsCollapsed, setIsAssignmentsCollapsed] = useState(false)
  const [showHighRiskModal, setShowHighRiskModal] = useState(false)
  // const { isLoaded, membership } = useOrganization()
  // const router = useRouter()
  const wellbeingLabels: Record<number, string> = {
    1: "Very Poor",
    2: "Poor",
    3: "Normal",
    4: "Good",
    5: "Very Good",
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const BASE_URL = "http://localhost:8000"

      const [seniorsRes, volunteersRes] = await Promise.all([
        fetch(`${BASE_URL}/seniors`).then((r) => r.json()),
        fetch(`${BASE_URL}/volunteers`).then((r) => r.json()),
      ])

      setSeniors(seniorsRes.seniors)
      setVolunteers(volunteersRes.volunteers)

      const assessmentsRes = await fetch(`${BASE_URL}/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seniors: seniorsRes.seniors }),
      }).then((r) => r.json())

      setAssessments(assessmentsRes.assessments)

      const allocationRes = await fetch(`${BASE_URL}/assignments`).then((r) => r.json())
      setAssignments(allocationRes.assignments)

      const scheduleRes = await fetch(`${BASE_URL}/schedules`).then((r) => r.json())
      setSchedules(scheduleRes.schedules)
    } catch (err) {
      console.error("Failed to load dashboard data", err)
    } finally {
      setLoading(false)
    }
  }

  // useEffect(() => {
  //   if (membership != undefined && membership.role == 'org:member') {
  //     router.push('/volunteer')
  //   }
  // }, [isLoaded, membership])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const levels: Record<1 | 2 | 3, string> = {
    1: "LOW",
    2: "MEDIUM",
    3: "HIGH",
  }

  const highPrioritySeniors = seniors.filter((s) => levels[s.overall_wellbeing] === "HIGH")
  const highRiskCount = highPrioritySeniors.length
  const activeVolunteers = volunteers.filter((v) => v.available && v.available.length > 0).length
  const todaySchedules = schedules.filter((s) => new Date(s.datetime).toDateString() === new Date().toDateString())

  // if (!isLoaded) {
  //     return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  //   }

  // if (!membership) {
  //   return <div className="flex justify-center items-center min-h-screen">You are not a member of this organization.</div>
  // }

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

          <Dialog open={showHighRiskModal} onOpenChange={setShowHighRiskModal}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader className="flex justify-between pb-2">
                  <CardTitle className="text-sm font-medium">High Priority</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{highRiskCount}</div>
                  <p className="text-xs text-muted-foreground">need immediate care</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  High Risk Seniors ({highRiskCount})
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {highPrioritySeniors.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No high-risk seniors at this time.</p>
                ) : (
                  highPrioritySeniors.map((senior) => (
                    <Card key={senior.uid} className="border-l-4 border-l-destructive">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{senior.name || `Senior ${senior.uid}`}</h3>
                            <p className="text-sm text-muted-foreground">ID: {senior.uid}</p>
                          </div>
                          <Badge variant="destructive">HIGH RISK</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-sm font-medium">Physical Health</p>
                            <p className="text-sm text-muted-foreground">
                              {senior.physical ? `${wellbeingLabels[6 - senior.physical]}` : "Not assessed"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Mental Health</p>
                            <p className="text-sm text-muted-foreground">
                              {senior.mental ? `${wellbeingLabels[6 - senior.mental]}` : "Not assessed"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Community Support</p>
                            <p className="text-sm text-muted-foreground">
                              {senior.community ? `${wellbeingLabels[6 - senior.community]}` : "Not assessed"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Last Visit</p>
                            <p className="text-sm text-muted-foreground">
                              {senior.last_visit ? new Date(senior.last_visit).toLocaleDateString() : "Never"}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">Location</p>
                            <p className="text-sm text-muted-foreground">
                              {senior.coords.lat.toFixed(4)}, {senior.coords.lng.toFixed(4)}
                            </p>
                          </div>
                          {senior.cluster && <Badge variant="outline">Cluster {senior.cluster}</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="lg:col-span-2 mb-8">
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
              <InteractiveMap
                seniors={seniors}
                volunteers={volunteers}
                assignments={assignments}
                schedules={schedules}
              />
            </CardContent>
          )}
        </div>

        <Card className={`lg:col-span-2 ${!isScheduleCollapsed ? "pb-0" : ""}`}>
          <CardHeader className="flex justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Scheduling Overview
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsScheduleCollapsed(!isScheduleCollapsed)}>
              {isScheduleCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {!isScheduleCollapsed && (
            <ScheduleInterface schedules={schedules} volunteers={volunteers} assignments={assignments} />
          )}
        </Card>

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