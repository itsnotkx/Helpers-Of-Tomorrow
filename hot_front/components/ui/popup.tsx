import { Senior, Volunteer, Assignment } from '@/app/page'

interface SeniorPopupProps {
  senior: Senior
  priority: "HIGH" | "MEDIUM" | "LOW"
  wellbeingLabels: Record<number, string>
}

interface VolunteerPopupProps {
  volunteer: Volunteer
  assignment?: Assignment
}

const wellbeingIcon = (score: number | undefined) => {
  if (score === undefined) return "❓"
  if (score <= 2) return "🔴"
  if (score <= 3) return "🟡"
  return "🟢"
}

export function SeniorPopup({ senior, priority, wellbeingLabels }: SeniorPopupProps) {
  const lastVisit = senior.last_visit ? new Date(senior.last_visit).toLocaleDateString() : "N/A"
  
  const priorityStyles = {
    HIGH: "bg-red-100 text-red-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    LOW: "bg-green-100 text-green-800"
  }

  const wellbeingItems = [
    { icon: wellbeingIcon(senior.physical), label: 'Physical Health', value: senior.physical },
    { icon: wellbeingIcon(senior.mental), label: 'Mental Health', value: senior.mental },
    { icon: wellbeingIcon(senior.community), label: 'Community', value: senior.community }
  ]
  
  return (
    <div className="w-72 p-0 bg-white rounded-lg shadow-lg border">
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
            👤
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base text-gray-900">{senior.name || senior.uid}</h3>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityStyles[priority]}`}>
              {priority} Priority
            </span>
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Wellbeing Status</h4>
            <div className="space-y-2">
              {wellbeingItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    {item.icon} {item.label}
                  </span>
                  <span className="text-sm font-medium">
                    {item.value !== undefined ? wellbeingLabels[6 - item.value] : "Unknown"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center gap-2">
                📅 Last Visit
              </span>
              <span className="text-sm font-medium">{lastVisit}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function VolunteerPopup({ volunteer, assignment }: VolunteerPopupProps) {
  const available = typeof volunteer.available === "boolean" 
    ? volunteer.available 
    : volunteer.available.length > 0

  return (
    <div className="p-3 min-w-[200px] bg-white rounded-lg shadow-lg border">
      <h3 className="font-semibold text-sm mb-1">{volunteer.name || volunteer.vid}</h3>
      <div className="space-y-1">
        <div>⭐ Skill: {volunteer.skill}/3</div>
        <div>{available ? "✅ Available" : "❌ Unavailable"}</div>
        {assignment && (
          <div>📍 Assigned: Cluster {assignment.cluster}</div>
        )}
      </div>
    </div>
  )
}