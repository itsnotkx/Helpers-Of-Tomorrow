"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Users, Calendar, AlertTriangle, Activity } from "lucide-react"
import { InteractiveMap } from "@/components/interactive-map"
import { ScheduleInterface } from "@/components/schedule-interface"
import { useOrganization } from "@clerk/nextjs"

// TypeScript interfaces for API data
interface Senior {
  uid: string
  name: string
  coords: { lat: number; lng: number }
  physical: number
  mental: number
  community: number
  last_visit: string
}

interface Volunteer {
  vid: string
  name: string
  coords: { lat: number; lng: number }
  skill: number
  available: boolean | string[]
}

interface Assessment {
  uid: string
  risk: number
  priority: "HIGH" | "MEDIUM" | "LOW"
  needscare: boolean
}

interface Assignment {
  volunteer: string
  cluster: string
  distance: number
}

interface Schedule {
  volunteer: string
  cluster: string
  datetime: string
  duration: number
}

export default function VolunteerDashboard() {
  const [seniors, setSeniors] = useState<Senior[]>([])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDistrict, setSelectedDistrict] = useState("Central Singapore")
  const [usingMockData, setUsingMockData] = useState(true)

  const { membership, isLoaded } = useOrganization();

  const generateMockData = () => {
    // Generate mock seniors
    const mockSeniors: Senior[] = Array.from({ length: 50 }, (_, i) => ({
      uid: `senior_${i}`,
      name: `Senior ${i + 1}`,
      coords: {
        lat: 1.16 + Math.random() * (1.47 - 1.16),
        lng: 103.6 + Math.random() * (104.0 - 103.6),
      },
      physical: Math.floor(Math.random() * 5) + 1,
      mental: Math.floor(Math.random() * 5) + 1,
      community: Math.floor(Math.random() * 5) + 1,
      last_visit: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    }))

    // Generate mock volunteers
    const mockVolunteers: Volunteer[] = Array.from({ length: 15 }, (_, i) => ({
      vid: `vol_${i}`,
      name: `Volunteer ${i + 1}`,
      coords: {
        lat: 1.16 + Math.random() * (1.47 - 1.16),
        lng: 103.6 + Math.random() * (104.0 - 103.6),
      },
      skill: Math.floor(Math.random() * 3) + 1,
      available: Math.random() > 0.3,
    }))

    // Generate mock assessments
    const mockAssessments: Assessment[] = mockSeniors.map((senior) => {
      const risk = Math.random()
      return {
        uid: senior.uid,
        risk: Math.round(risk * 100) / 100,
        priority: risk > 0.7 ? "HIGH" : risk > 0.4 ? "MEDIUM" : "LOW",
        needscare: risk > 0.6,
      }
    })

    // Generate mock assignments
    const clusters = ["area_0", "area_1", "area_2", "area_3", "area_4"]
    const mockAssignments: Assignment[] = mockVolunteers.map((vol) => ({
      volunteer: vol.vid,
      cluster: clusters[Math.floor(Math.random() * clusters.length)],
      distance: Math.random() * 0.1,
    }))

    // Generate mock schedules
    const mockSchedules: Schedule[] = []
    const timeSlots = ["09:00", "11:00", "14:00", "16:00"]

    mockAssignments.forEach((assignment) => {
      // Generate 2-3 schedules per volunteer for the next few days
      for (let day = 0; day < 3; day++) {
        if (Math.random() > 0.3) {
          // 70% chance of having a schedule
          const date = new Date()
          date.setDate(date.getDate() + day)
          const time = timeSlots[Math.floor(Math.random() * timeSlots.length)]
          date.setHours(Number.parseInt(time.split(":")[0]), Number.parseInt(time.split(":")[1]), 0, 0)

          mockSchedules.push({
            volunteer: assignment.volunteer,
            cluster: assignment.cluster,
            datetime: date.toISOString(),
            duration: 60,
          })
        }
      }
    })

    return {
      seniors: mockSeniors,
      volunteers: mockVolunteers,
      assessments: mockAssessments,
      assignments: mockAssignments,
      schedules: mockSchedules,
    }
  }

  const loadApiData = async () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

    // Generate demo data
    const [seniorsRes, volunteersRes] = await Promise.all([
      fetch(`${API_BASE}/demo/seniors?count=50`),
      fetch(`${API_BASE}/demo/volunteers?count=15`),
    ])

    const seniorsData = await seniorsRes.json()
    const volunteersData = await volunteersRes.json()

    setSeniors(seniorsData.seniors)
    setVolunteers(volunteersData.volunteers)

    // Assess seniors
    const assessRes = await fetch(`${API_BASE}/assess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seniorsData.seniors),
    })
    const assessData = await assessRes.json()
    setAssessments(assessData.assessments)

    // Allocate volunteers
    const allocateRes = await fetch(`${API_BASE}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        volunteers: volunteersData.volunteers,
        seniors: seniorsData.seniors,
      }),
    })
    const allocateData = await allocateRes.json()
    setAssignments(allocateData.assignments)

    // Create schedule
    const scheduleRes = await fetch(`${API_BASE}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments: allocateData.assignments }),
    })
    const scheduleData = await scheduleRes.json()
    setSchedules(scheduleData.schedules)
  }

  // Load initial data
  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Check if API URL is configured
      const apiUrl = process.env.NEXT_PUBLIC_API_URL

      if (apiUrl) {
        console.log("Attempting to connect to API:", apiUrl)
        await loadApiData()
        setUsingMockData(false)
        console.log("Successfully connected to API")
      } else {
        // Use mock data by default
        console.log("No API URL configured, using mock data")
        const mockData = generateMockData()
        setSeniors(mockData.seniors)
        setVolunteers(mockData.volunteers)
        setAssessments(mockData.assessments)
        setAssignments(mockData.assignments)
        setSchedules(mockData.schedules)
        setUsingMockData(true)
      }
    } catch (error) {
      console.error("Failed to load API data, falling back to mock data:", error)

      const mockData = generateMockData()
      setSeniors(mockData.seniors)
      setVolunteers(mockData.volunteers)
      setAssessments(mockData.assessments)
      setAssignments(mockData.assignments)
      setSchedules(mockData.schedules)
      setUsingMockData(true)
    } finally {
      setLoading(false)
    }
  }

  const tryConnectToApi = async () => {
    try {
      setLoading(true)
      await loadApiData()
      setUsingMockData(false)
    } catch (error) {
      console.error("Failed to connect to API:", error)
      // Keep using mock data
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const highRiskCount = assessments.filter((a) => a.priority === "HIGH").length
  const activeVolunteers = volunteers.filter((v) => v.available).length
  const todaySchedules = schedules.filter((s) => {
    const scheduleDate = new Date(s.datetime).toDateString()
    const today = new Date().toDateString()
    return scheduleDate === today
  })

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!membership) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">You are not a member of any organization.</p>
      </div>
    )
  }
  
  if (membership.role === "org:member") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">You are a member.</p>
      </div>
    )
  } else {
    // console.log("membership.role:", membership.role);
      return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Senior Care Volunteer Dashboard</h1>
                <p className="text-muted-foreground">Managing care for {selectedDistrict}</p>
                {usingMockData && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Demo Mode - Using sample data
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-sm">
                  <MapPin className="h-3 w-3 mr-1" />
                  {selectedDistrict}
                </Badge>
                {usingMockData ? (
                  <Button onClick={tryConnectToApi} variant="outline" size="sm">
                    <Activity className="h-4 w-4 mr-2" />
                    Try Connect API
                  </Button>
                ) : (
                  <Button onClick={loadDashboardData} variant="outline" size="sm">
                    <Activity className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-6 py-6">
          {usingMockData && (
            <Card className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">Demo Mode Active</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                      The dashboard is currently using realistic sample data for demonstration. To connect to your FastAPI
                      backend:
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-200 mt-2 ml-4 list-disc space-y-1">
                      <li>
                        Start your FastAPI server:{" "}
                        <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                          uvicorn main:app --reload --host 0.0.0.0
                        </code>
                      </li>
                      <li>
                        Set the <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">NEXT_PUBLIC_API_URL</code>{" "}
                        environment variable in Project Settings
                      </li>
                      <li>Click "Try Connect API" to attempt connection</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Seniors</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{seniors.length}</div>
                <p className="text-xs text-muted-foreground">{highRiskCount} high risk</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Volunteers</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeVolunteers}</div>
                <p className="text-xs text-muted-foreground">of {volunteers.length} total</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todaySchedules.length}</div>
                <p className="text-xs text-muted-foreground">scheduled visits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">High Priority</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{highRiskCount}</div>
                <p className="text-xs text-muted-foreground">need immediate care</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Section */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  District Map & Clusters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InteractiveMap
                  seniors={seniors}
                  volunteers={volunteers}
                  assignments={assignments}
                  schedules={schedules}
                />
              </CardContent>
            </Card>

            {/* Quick Schedule Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Today's Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {todaySchedules.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No visits scheduled for today</p>
                  ) : (
                    todaySchedules.map((schedule, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{schedule.volunteer}</p>
                          <p className="text-sm text-muted-foreground">{schedule.cluster}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {new Date(schedule.datetime).toLocaleTimeString("en-SG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">{schedule.duration}min</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Schedule Interface */}
          <div className="mt-8">
            <ScheduleInterface schedules={schedules} volunteers={volunteers} assignments={assignments} />
          </div>

          {/* Assignments Overview */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Volunteer Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignments.map((assignment, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{assignment.volunteer}</h4>
                      <Badge variant="secondary">{assignment.cluster}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Distance: {(assignment.distance * 100).toFixed(1)}km</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
}