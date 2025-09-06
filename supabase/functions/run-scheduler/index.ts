// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface Senior {
  uid: string;
  overall_wellbeing: number;
  coords: { lat: number; lng: number };
  cluster?: number;
}

interface Volunteer {
  vid: string;
  email: string;
  name: string;
  coords: { lat: number; lng: number };
  skill: number;
}

interface Availability {
  date: string;
  start_t: string;
  end_t: string;
  volunteer_email: string;
}

interface Cluster {
  seniors: Senior[];
  centroid: { lat: number; lng: number };
  id: number;
  density?: number;
  radius?: number;
}

console.log("Scheduler Function Loaded")

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Calculate start of current year
    const currentYear = new Date().getFullYear()
    const startOfYear = `${currentYear}-01-01`
    const startOfYearDate = new Date(startOfYear)

    // Fetch seniors (filter in code to apply 4-month rule for wellbeing=1)
    const { data: seniorsData, error: seniorsError } = await supabase
      .from('seniors')
      .select('uid, overall_wellbeing, coords, last_visit')

    if (seniorsError) throw seniorsError

    // Parse coordinates for seniors
    const allSeniors = seniorsData.map(s => ({
      ...s,
      coords: typeof s.coords === 'string' ? JSON.parse(s.coords) : s.coords
    }))

    // Apply eligibility rules:
    // - wellbeing 1: last_visit null OR older than 4 months
    // - wellbeing >1: last_visit null OR last_visit < start of year
    const today = new Date()
    const fourMonthsAgo = new Date(today)
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)

    const seniors = allSeniors.filter(s => {
      const lastVisit = s.last_visit ? new Date(s.last_visit) : null
      if (s.overall_wellbeing === 1) {
        return !lastVisit || lastVisit < fourMonthsAgo
      }
      return !lastVisit || lastVisit < startOfYearDate
    })

    console.log(`Eligibility filter: ${allSeniors.length} total seniors, ${seniors.length} eligible for scheduling`)

    // Fetch volunteers with their skills and coordinates
    const { data: volunteersData, error: volunteersError } = await supabase
      .from('volunteers')
      .select('vid, email, name, coords, skill')

    if (volunteersError) throw volunteersError

    // Parse coordinates for volunteers
    const volunteers = volunteersData.map(v => ({
      ...v,
      coords: typeof v.coords === 'string' ? JSON.parse(v.coords) : v.coords
    }))

    // Calculate date range: Monday to Sunday after current Sunday
    // NOTE: reuse 'today' from above to avoid redeclaration
    const dayOfWeek = today.getDay() // 0 = Sunday
    
    // If today is Sunday, get Monday-Sunday of the following week
    // If today is any other day, this shouldn't run, but handle gracefully
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
    const nextMonday = new Date(today.getTime() + daysUntilNextMonday * 24 * 60 * 60 * 1000)
    const nextSunday = new Date(nextMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
    
    console.log(`Scheduling for week: ${nextMonday.toISOString().split('T')[0]} to ${nextSunday.toISOString().split('T')[0]}`)
    
    const { data: availabilities, error: availabilitiesError } = await supabase
      .from('availabilities')
      .select('date, start_t, end_t, volunteer_email')
      .gte('date', nextMonday.toISOString().split('T')[0])
      .lte('date', nextSunday.toISOString().split('T')[0])

    if (availabilitiesError) throw availabilitiesError

    let availList = availabilities ?? []
    console.log(`Found ${availList.length} availability slots for the current week`)

    // No fallback needed since we're already using current week

    // Perform geographical K-means clustering on eligible seniors
    const clusters = performGeographicalClustering(seniors, volunteers)
    
    console.log('Generated clusters:', clusters.length)
    
    // Update clusters table with cluster information
    if (clusters.length > 0) {
      const clusterInserts = clusters.map((cluster) => ({
        id: cluster.id,
        centroid: cluster.centroid, // pass object for json/jsonb column
        radius: cluster.radius
      }))

      console.log('Cluster inserts:')
      clusters.forEach(cluster => {
        console.log(`Cluster ${cluster.id} with ${cluster.seniors.length} seniors`)
      })
      console.log('Cluster inserts:', clusterInserts)

      // Clear existing clusters and insert new ones
      const { error: deleteError } = await supabase.from('clusters').delete().neq('id', -1) // Delete all
      if (deleteError) {
        console.error('Error deleting clusters:', deleteError)
      } else {
        console.log('Successfully deleted existing clusters')
      }
      
      const { error: clusterError, data: insertedClusters } = await supabase
        .from('clusters')
        .insert(clusterInserts)
        .select('*') // select for debug visibility

      if (clusterError) {
        console.error('Error updating clusters:', clusterError)
        throw clusterError
      } else {
        console.log('Successfully inserted clusters:', insertedClusters)
      }
    } else {
      console.log('No clusters to update')
    }
    
    // Generate schedules with one visit per senior maximum
    const schedules = generateOptimalSchedules(clusters, volunteers, availList)
    
    // Insert schedules into assignments table
    if (schedules.length > 0) {
      const { error: insertError, data: insertedAssignments } = await supabase
        .from('assignments')
        .insert(schedules)
        .select('*') // select for debug visibility

      if (insertError) throw insertError
      console.log(`Inserted ${insertedAssignments?.length ?? 0} assignments`)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Schedules generated successfully',
        clustersCount: clusters.length,
        schedulesCreated: schedules.length
      }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Scheduler error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

function distance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
  return Math.sqrt(Math.pow(coord1.lat - coord2.lat, 2) + Math.pow(coord1.lng - coord2.lng, 2))
}

function calculateClusterArea(seniors: Senior[]): number {
  if (seniors.length < 2) return 0.001 // Small default area for single senior
  
  const lats = seniors.map(s => s.coords.lat)
  const lngs = seniors.map(s => s.coords.lng)
  
  const latRange = Math.max(...lats) - Math.min(...lats)
  const lngRange = Math.max(...lngs) - Math.min(...lngs)
  
  const area = latRange * lngRange
  return Math.max(area, 0.001) // Ensure minimum area to avoid division by zero
}

function calculateClusterDensity(seniors: Senior[]): number {
  const area = calculateClusterArea(seniors)
  return seniors.length / area
}

function calculateClusterRadius(seniors: Senior[], centroid: { lat: number; lng: number }): number {
  if (seniors.length === 0) return 0
  
  const distances = seniors.map(senior => distance(senior.coords, centroid))
  return Math.max(...distances)
}

function performGeographicalClustering(seniors: Senior[], _volunteers: Volunteer[]): Cluster[] {
  if (seniors.length === 0) return []

  const targetSize = 7
  const maxSoftSize = targetSize + 1 // allow slight overflow when it clearly prevents sub-clusters
  const k = Math.ceil(seniors.length / targetSize)

  type Point = { lat: number; lng: number; senior: Senior }
  const pts: Point[] = seniors.map(s => ({ lat: s.coords.lat, lng: s.coords.lng, senior: s }))

  const euclid = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2))

  // k-means++ initialization
  const centroids: { lat: number; lng: number }[] = []
  const first = pts[Math.floor(Math.random() * pts.length)]
  centroids.push({ lat: first.lat, lng: first.lng })
  while (centroids.length < k) {
    const d2 = pts.map(p => {
      let m = Infinity
      for (const c of centroids) m = Math.min(m, euclid(p, c))
      return m * m
    })
    const sum = d2.reduce((a, b) => a + b, 0) || 1
    let r = Math.random() * sum
    let idx = 0
    while (idx < d2.length - 1 && r > d2[idx]) {
      r -= d2[idx]
      idx++
    }
    const p = pts[idx]
    centroids.push({ lat: p.lat, lng: p.lng })
  }

  let clusters: Cluster[] = []
  const maxIter = 20

  for (let iter = 0; iter < maxIter; iter++) {
    // Init clusters
    clusters = centroids.map((c, id) => ({
      seniors: [],
      centroid: { lat: c.lat, lng: c.lng },
      id: id + 1
    }))

    // Track sizes with soft capacity
    const counts = new Array(centroids.length).fill(0)

    // Build ordered centroid preferences with distances
    const prefs = pts.map(p => {
      const ordered = centroids
        .map((c, i) => ({ i, d: euclid(p, c) }))
        .sort((a, b) => a.d - b.d)
      return { p, ordered }
    })

    // Assign with soft capacity:
    // - Prefer underfull clusters (< targetSize) if distance is comparable (<= 1.2x of nearest)
    // - Otherwise, allow best cluster to go up to maxSoftSize
    // - As a last resort, place in nearest (keeps convergence)
    const comparableFactor = 1.2
    for (const pref of prefs) {
      const best = pref.ordered[0]
      const underCandidate = pref.ordered.find(o => counts[o.i] < targetSize)
      let chosenIdx = -1

      if (counts[best.i] < targetSize) {
        chosenIdx = best.i
      } else if (underCandidate) {
        if (underCandidate.d <= best.d * comparableFactor) {
          chosenIdx = underCandidate.i
        } else if (counts[best.i] < maxSoftSize) {
          chosenIdx = best.i
        } else {
          chosenIdx = underCandidate.i
        }
      } else {
        // No underfull clusters remain; allow soft overflow if possible, else nearest
        chosenIdx = counts[best.i] < maxSoftSize ? best.i : best.i
      }

      clusters[chosenIdx].seniors.push({ ...pref.p.senior, cluster: clusters[chosenIdx].id })
      counts[chosenIdx]++
    }

    // Update centroids
    centroids.forEach((c, i) => {
      const members = clusters[i].seniors
      if (members.length > 0) {
        const avgLat = members.reduce((s, m) => s + m.coords.lat, 0) / members.length
        const avgLng = members.reduce((s, m) => s + m.coords.lng, 0) / members.length
        c.lat = avgLat
        c.lng = avgLng
      }
    })
  }

  // Drop empty clusters and reindex
  clusters = clusters.filter(c => c.seniors.length > 0)
  clusters.forEach((c, idx) => {
    c.id = idx + 1
    c.seniors.forEach(s => (s.cluster = c.id))
    const avgLat = c.seniors.reduce((s, m) => s + m.coords.lat, 0) / c.seniors.length
    const avgLng = c.seniors.reduce((s, m) => s + m.coords.lng, 0) / c.seniors.length
    c.centroid = { lat: avgLat, lng: avgLng }
  })

  clusters.forEach(c => {
    c.density = calculateClusterDensity(c.seniors)
    c.radius = calculateClusterRadius(c.seniors, c.centroid)
  })

  // Split outlier-radius clusters to avoid “spanning” ones
  const radii = clusters.map(c => c.radius || 0).sort((a, b) => a - b)
  const median = radii.length ? radii[Math.floor(radii.length / 2)] : 0
  const threshold = median > 0 ? median * 2.5 : 0

  if (threshold > 0) {
    const next: Cluster[] = []
    for (const c of clusters) {
      if ((c.radius || 0) > threshold && c.seniors.length > 4) {
        const arr = c.seniors
        let a = 0, b = 1, maxD = -1
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const d = Math.sqrt(
              Math.pow(arr[i].coords.lat - arr[j].coords.lat, 2) +
              Math.pow(arr[i].coords.lng - arr[j].coords.lng, 2)
            )
            if (d > maxD) { maxD = d; a = i; b = j }
          }
        }
        const seed1 = { lat: arr[a].coords.lat, lng: arr[a].coords.lng }
        const seed2 = { lat: arr[b].coords.lat, lng: arr[b].coords.lng }

        const part1: Senior[] = []
        const part2: Senior[] = []
        for (const s of arr) {
          const d1 = Math.sqrt(Math.pow(s.coords.lat - seed1.lat, 2) + Math.pow(s.coords.lng - seed1.lng, 2))
          const d2 = Math.sqrt(Math.pow(s.coords.lat - seed2.lat, 2) + Math.pow(s.coords.lng - seed2.lng, 2))
          if (d1 <= d2) part1.push({ ...s })
          else part2.push({ ...s })
        }

        const mkCluster = (members: Senior): Cluster => {
          const m = Array.isArray(members) ? members : [members]
          const avgLat = m.reduce((s, x) => s + x.coords.lat, 0) / m.length
          const avgLng = m.reduce((s, x) => s + x.coords.lng, 0) / m.length
          const cl: Cluster = { seniors: m, centroid: { lat: avgLat, lng: avgLng }, id: 0 }
          cl.density = calculateClusterDensity(m)
          cl.radius = calculateClusterRadius(m, cl.centroid)
          return cl
        }

        if (part1.length === 0 || part2.length === 0) {
          next.push(c)
        } else {
          next.push(mkCluster(part1 as unknown as Senior))
          next.push(mkCluster(part2 as unknown as Senior))
        }
      } else {
        next.push(c)
      }
    }
    next.forEach((c, idx) => {
      c.id = idx + 1
      c.seniors.forEach(s => (s.cluster = c.id))
    })
    clusters = next
  }

  clusters.forEach(c => {
    c.density = calculateClusterDensity(c.seniors)
    c.radius = calculateClusterRadius(c.seniors, c.centroid)
  })

  return clusters
}

function assignVolunteersToClusters(clusters: Cluster[], volunteers: Volunteer[], availabilities: Availability[]): Map<string, number> {
  // Two-pass assignment:
  //   1) Try to ensure each cluster gets at least one available volunteer (by proximity, higher density first)
  //   2) Assign remaining volunteers to their closest clusters
  const availabilityMap = new Map<string, Availability[]>()
  availabilities.forEach(avail => {
    if (!availabilityMap.has(avail.volunteer_email)) {
      availabilityMap.set(avail.volunteer_email, [])
    }
    availabilityMap.get(avail.volunteer_email)!.push(avail)
  })

  const volunteerClusterAssignment = new Map<string, number>()
  const availableVolunteers = volunteers.filter(v => availabilityMap.has(v.email))

  console.log(`Assigning ${availableVolunteers.length} available volunteers to ${clusters.length} clusters`)

  if (availableVolunteers.length < clusters.length) {
    console.warn(`Only ${availableVolunteers.length} available volunteers for ${clusters.length} clusters; some clusters may have none.`)
  }

  const assignedVolunteers = new Set<string>()

  // Sort clusters by density desc, then by number of seniors desc
  const sortedClusters = [...clusters].sort((a, b) => {
    const densityDiff = (b.density || 0) - (a.density || 0)
    if (Math.abs(densityDiff) < 0.0001) return b.seniors.length - a.seniors.length
    return densityDiff
  })

  // Pass 1: ensure coverage (one volunteer per cluster where possible)
  for (const cluster of sortedClusters) {
    let bestVolunteer: Volunteer | null = null
    let minDistance = Infinity

    for (const volunteer of availableVolunteers) {
      if (assignedVolunteers.has(volunteer.email)) continue
      const d = distance(volunteer.coords, cluster.centroid)
      if (d < minDistance) {
        minDistance = d
        bestVolunteer = volunteer
      }
    }

    if (bestVolunteer) {
      volunteerClusterAssignment.set(bestVolunteer.email, cluster.id)
      assignedVolunteers.add(bestVolunteer.email)
      console.log(`Assigned ${bestVolunteer.email} to cluster ${cluster.id} (d=${minDistance.toFixed(4)})`)
    } else {
      console.warn(`No unassigned available volunteer found for cluster ${cluster.id}`)
    }
  }

  // Pass 2: assign remaining volunteers by proximity (allows multiple volunteers per cluster)
  const remaining = availableVolunteers.filter(v => !assignedVolunteers.has(v.email))
  for (const volunteer of remaining) {
    let bestClusterId = -1
    let minDistance = Infinity
    for (const cluster of clusters) {
      const d = distance(volunteer.coords, cluster.centroid)
      if (d < minDistance) {
        minDistance = d
        bestClusterId = cluster.id
      }
    }
    if (bestClusterId !== -1) {
      volunteerClusterAssignment.set(volunteer.email, bestClusterId)
      console.log(`Additional assignment: ${volunteer.email} -> cluster ${bestClusterId} (d=${minDistance.toFixed(4)})`)
    }
  }

  // Report coverage
  const clusterCounts = new Map<number, number>()
  volunteerClusterAssignment.forEach(cid => clusterCounts.set(cid, (clusterCounts.get(cid) || 0) + 1))
  console.log('Volunteers per cluster:', Object.fromEntries(clusterCounts))

  for (const cluster of clusters) {
    if (!clusterCounts.has(cluster.id)) {
      console.warn(`Cluster ${cluster.id} has no assigned volunteers`)
    }
  }

  return volunteerClusterAssignment
}

function generateOptimalSchedules(clusters: Cluster[], volunteers: Volunteer[], availabilities: Availability[]) {
  const schedules = []
  
  console.log(`Starting schedule generation with ${availabilities.length} availability slots`)
  
  // Clear existing assignments first to ensure fresh scheduling
  const usedSlots = new Set<string>()
  const scheduledSeniors = new Set<string>()
  
  // Get volunteer-to-cluster assignments using weighted distance
  const volunteerClusterAssignment = assignVolunteersToClusters(clusters, volunteers, availabilities)
  
  // Group availabilities by volunteer email
  const availabilityMap = new Map<string, Availability[]>()
  availabilities.forEach(avail => {
    if (!availabilityMap.has(avail.volunteer_email)) {
      availabilityMap.set(avail.volunteer_email, [])
    }
    availabilityMap.get(avail.volunteer_email)!.push(avail)
  })
  
  console.log(`Availability map has ${availabilityMap.size} volunteers with slots`)
  
  // Process clusters in order of density (highest density first for priority)
  const sortedClusters = [...clusters].sort((a, b) => (b.density || 0) - (a.density || 0))
  
  for (const cluster of sortedClusters) {
    // Sort seniors by priority (lower wellbeing = higher priority)
    const sortedSeniors = [...cluster.seniors].sort((a, b) => a.overall_wellbeing - b.overall_wellbeing)
    
    // Get volunteers assigned to this cluster (using 0-based cluster.id for comparison)
    const clusterVolunteers = volunteers.filter(v => 
      volunteerClusterAssignment.get(v.email) === cluster.id &&
      availabilityMap.has(v.email)
    )
    
    console.log(`Cluster ${cluster.id} (DB ID: ${cluster.id}) has ${clusterVolunteers.length} volunteers and ${sortedSeniors.length} seniors`)
    
    if (clusterVolunteers.length === 0) {
      console.log(`No volunteers available for cluster ${cluster.id}, skipping`)
      continue
    }
    
    // Sort volunteers by skill (higher skill first for low wellbeing seniors)
    const sortedVolunteers = [...clusterVolunteers].sort((a, b) => b.skill - a.skill)
    
    // For each senior in cluster (maximum one visit per senior)
    for (const senior of sortedSeniors) {
      if (scheduledSeniors.has(senior.uid)) continue
      
      // Find best volunteer based on skill for this senior's wellbeing level
      const suitableVolunteers = [...sortedVolunteers].sort((a, b) => {
        // For low wellbeing seniors, prioritize high skill volunteers
        if (senior.overall_wellbeing <= 2) {
          return b.skill - a.skill
        }
        // For higher wellbeing seniors, skill matters less
        return a.skill - b.skill
      })
      
      let seniorScheduled = false
      
      // Try to schedule with the best available volunteer
      for (const volunteer of suitableVolunteers) {
        if (seniorScheduled) break
        
        const volunteerSlots = availabilityMap.get(volunteer.email) || []
        
        // Find first available slot
        for (const slot of volunteerSlots) {
          const slotKey = `${volunteer.email}_${slot.date}_${slot.start_t}`
          
          if (usedSlots.has(slotKey)) continue
          
          // Calculate end time (1 hour duration)
          const startTime = new Date(`1970-01-01T${slot.start_t}`)
          const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // Add 1 hour
          const endTimeString = endTime.toTimeString().slice(0, 8) // Format as HH:MM:SS
          
          // Check if assignment end time is within volunteer's available slot
          const slotEndTime = new Date(`1970-01-01T${slot.end_t}`)
          if (endTime > slotEndTime) {
            console.log(`Skipping slot for ${volunteer.email}: assignment would end at ${endTimeString} but slot ends at ${slot.end_t}`)
            continue
          }
          
          // Create schedule entry
          schedules.push({
            vid: volunteer.vid,
            sid: senior.uid,
            date: slot.date,
            start_time: slot.start_t,
            end_time: endTimeString,
            volunteer_email: volunteer.email,
            is_acknowledged: false,
            cluster_id: cluster.id // No conversion needed - already starts from 1
          })
          
          // Mark slot as used and senior as scheduled
          usedSlots.add(slotKey)
          scheduledSeniors.add(senior.uid)
          seniorScheduled = true
          
          console.log(`Scheduled senior ${senior.uid} with volunteer ${volunteer.email} on ${slot.date} at ${slot.start_t} for cluster ${cluster.id}`)
          
          // Move to next senior (one visit per senior maximum)
          break
        }
      }
      
      if (!seniorScheduled) {
        console.log(`Could not schedule senior ${senior.uid} in cluster ${cluster.id}`)
      }
    }
  }
  
  console.log(`Total schedules generated: ${schedules.length}`)
  
  return schedules
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/run-scheduler' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{}'

*/
