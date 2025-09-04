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

    // Fetch seniors who haven't been visited this year
    const { data: seniorsData, error: seniorsError } = await supabase
      .from('seniors')
      .select('uid, overall_wellbeing, coords, last_visit')
      .or(`last_visit.is.null,last_visit.lt.${startOfYear}`)

    if (seniorsError) throw seniorsError

    // Parse coordinates for seniors
    const seniors = seniorsData.map(s => ({
      ...s,
      coords: typeof s.coords === 'string' ? JSON.parse(s.coords) : s.coords
    }))

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

    // Fetch volunteer availabilities for the next week
    const today = new Date()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(tomorrow.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const { data: availabilities, error: availabilitiesError } = await supabase
      .from('availabilities')
      .select('date, start_t, end_t, volunteer_email')
      .gte('date', tomorrow.toISOString().split('T')[0])
      .lte('date', nextWeek.toISOString().split('T')[0])

    if (availabilitiesError) throw availabilitiesError

    // Perform geographical K-means clustering
    const clusters = performGeographicalClustering(seniors, volunteers)
    
    console.log('Generated clusters:', clusters.length)
    
    // Update clusters table with cluster information
    if (clusters.length > 0) {
      const clusterInserts = clusters.map((cluster) => ({
        id: cluster.id + 1, // Convert 0-based to 1-based for database
        centroid: JSON.stringify(cluster.centroid),
        radius: cluster.radius
      }))

      console.log('Cluster inserts with mapping:')
      clusters.forEach(cluster => {
        console.log(`Algorithm cluster ${cluster.id} -> DB cluster ${cluster.id + 1}`)
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
        .select()

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
    const schedules = generateOptimalSchedules(clusters, volunteers, availabilities)
    
    // Insert schedules into assignments table
    if (schedules.length > 0) {
      const { error: insertError } = await supabase
        .from('assignments')
        .insert(schedules)

      if (insertError) throw insertError
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

function performGeographicalClustering(seniors: Senior[], volunteers: Volunteer[]): Cluster[] {
  if (seniors.length === 0) return []
  
  // Stage 1: Cluster seniors based on geographical proximity (euclidean distance)
  const targetRatio = 3 // seniors per volunteer
  const recommendedClusters = Math.max(1, Math.floor(seniors.length / (targetRatio * Math.max(1, volunteers.length))))
  const minClusters = Math.max(1, Math.floor(seniors.length / 6)) // max 6 seniors per cluster
  const maxClusters = Math.floor(seniors.length / 2) // min 2 seniors per cluster
  const nClusters = Math.max(minClusters, Math.min(recommendedClusters, maxClusters))
  
  console.log(`Clustering ${seniors.length} seniors into ${nClusters} clusters`)
  
  // Extract coordinates for K-means clustering of seniors
  const coordinates = seniors.map(s => [s.coords.lat, s.coords.lng])
  
  // Initialize centroids randomly within data bounds
  const lats = coordinates.map(c => c[0])
  const lngs = coordinates.map(c => c[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  
  // Use timestamp-based seed for better randomization
  const seed = Date.now()
  let centroids = Array.from({ length: nClusters }, (_, i) => [
    minLat + ((seed + i * 1000) % 1000000 / 1000000) * (maxLat - minLat),
    minLng + ((seed + i * 2000) % 1000000 / 1000000) * (maxLng - minLng)
  ])
  
  let clusters: Cluster[] = []
  let converged = false
  let iterations = 0
  const maxIterations = 100
  
  // K-means clustering for seniors
  while (!converged && iterations < maxIterations) {
    // Initialize clusters
    clusters = centroids.map((centroid, id) => ({
      seniors: [],
      centroid: { lat: centroid[0], lng: centroid[1] },
      id
    }))
    
    // Assign seniors to closest clusters based on euclidean distance
    for (const senior of seniors) {
      let minDist = Infinity
      let assignedCluster = 0
      
      for (let i = 0; i < centroids.length; i++) {
        const dist = distance(senior.coords, { lat: centroids[i][0], lng: centroids[i][1] })
        if (dist < minDist) {
          minDist = dist
          assignedCluster = i
        }
      }
      
      clusters[assignedCluster].seniors.push({ ...senior, cluster: assignedCluster })
    }
    
    // Update centroids based on assigned seniors
    const newCentroids = clusters.map(cluster => {
      if (cluster.seniors.length === 0) return [cluster.centroid.lat, cluster.centroid.lng]
      
      const avgLat = cluster.seniors.reduce((sum, s) => sum + s.coords.lat, 0) / cluster.seniors.length
      const avgLng = cluster.seniors.reduce((sum, s) => sum + s.coords.lng, 0) / cluster.seniors.length
      return [avgLat, avgLng]
    })
    
    // Check convergence
    converged = centroids.every((centroid, i) => 
      Math.abs(centroid[0] - newCentroids[i][0]) < 0.001 &&
      Math.abs(centroid[1] - newCentroids[i][1]) < 0.001
    )
    
    centroids = newCentroids
    clusters.forEach((cluster, i) => {
      cluster.centroid = { lat: centroids[i][0], lng: centroids[i][1] }
    })
    iterations++
  }
  
  // Filter out empty clusters and calculate density and radius for each cluster
  const validClusters = clusters.filter(cluster => cluster.seniors.length > 0)
  
  // IMPORTANT: Reassign cluster IDs to be consecutive starting from 0
  validClusters.forEach((cluster, index) => {
    cluster.id = index // Ensure IDs are 0, 1, 2, etc.
    // Update senior cluster assignments to match
    cluster.seniors.forEach(senior => {
      senior.cluster = index
    })
  })
  
  console.log(`Valid clusters after filtering: ${validClusters.length}`)
  validClusters.forEach((cluster, index) => {
    console.log(`Cluster ${cluster.id} has ${cluster.seniors.length} seniors with centroid:`, cluster.centroid)
  })
  
  // Add density and radius information to clusters
  validClusters.forEach(cluster => {
    cluster.density = calculateClusterDensity(cluster.seniors)
    cluster.radius = calculateClusterRadius(cluster.seniors, cluster.centroid)
  })
  
  return validClusters
}

function assignVolunteersToClusters(clusters: Cluster[], volunteers: Volunteer[], availabilities: Availability[]): Map<string, number> {
  // Stage 2: Assign volunteers to clusters using weighted euclidean distance
  const availabilityMap = new Map<string, Availability[]>()
  availabilities.forEach(avail => {
    if (!availabilityMap.has(avail.volunteer_email)) {
      availabilityMap.set(avail.volunteer_email, [])
    }
    availabilityMap.get(avail.volunteer_email)!.push(avail)
  })
  
  const volunteerClusterAssignment = new Map<string, number>()
  
  // Only consider volunteers who have availability
  const availableVolunteers = volunteers.filter(v => availabilityMap.has(v.email))
  
  console.log('Available volunteers:', availableVolunteers.length)
  console.log('Total clusters:', clusters.length)
  
  for (const volunteer of availableVolunteers) {
    let bestCluster = -1
    let minWeightedDistance = Infinity
    
    console.log(`Assigning volunteer ${volunteer.email} to clusters:`)
    
    for (const cluster of clusters) {
      // Calculate euclidean distance from volunteer to cluster centroid
      const euclideanDist = distance(volunteer.coords, cluster.centroid)
      
      // Calculate weighted euclidean distance using density
      // Higher density = smaller weighted distance (more priority)
      const weightedDistance = euclideanDist / (cluster.density || 0.001)
      
      console.log(`  Cluster ${cluster.id}: distance=${euclideanDist.toFixed(4)}, weighted=${weightedDistance.toFixed(4)}`)
      
      if (weightedDistance < minWeightedDistance) {
        minWeightedDistance = weightedDistance
        bestCluster = cluster.id
      }
    }
    
    if (bestCluster !== -1) {
      volunteerClusterAssignment.set(volunteer.email, bestCluster)
      console.log(`Volunteer ${volunteer.email} assigned to cluster ${bestCluster}`)
    }
  }
  
  // Log cluster assignment summary
  const clusterCounts = new Map<number, number>()
  volunteerClusterAssignment.forEach(clusterId => {
    clusterCounts.set(clusterId, (clusterCounts.get(clusterId) || 0) + 1)
  })
  console.log('Volunteers per cluster:', Object.fromEntries(clusterCounts))
  
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
    
    console.log(`Cluster ${cluster.id} (DB ID: ${cluster.id + 1}) has ${clusterVolunteers.length} volunteers and ${sortedSeniors.length} seniors`)
    
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
            cluster_id: cluster.id + 1 // Convert 0-based cluster.id to 1-based for database
          })
          
          // Mark slot as used and senior as scheduled
          usedSlots.add(slotKey)
          scheduledSeniors.add(senior.uid)
          seniorScheduled = true
          
          console.log(`Scheduled senior ${senior.uid} with volunteer ${volunteer.email} on ${slot.date} at ${slot.start_t} for cluster ${cluster.id + 1}`)
          
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


