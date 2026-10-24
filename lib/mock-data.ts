export type ComplaintStatus = 'Submitted' | 'Under Review' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed'
export type ComplaintPriority = 'High' | 'Medium' | 'Low'

export type MunicipalComplaint = {
  id: string
  issue: 'Pothole' | 'Water Leakage' | 'Garbage'
  location: string
  date: string
  priority: ComplaintPriority
  score: number
  status: ComplaintStatus
  department: 'Road Maintenance' | 'Water Supply' | 'Solid Waste Management'
  confidence: number
  severity: string
  latitude: number
  longitude: number
  accuracy: number
  description: string
  history: { status: ComplaintStatus; date: string; officer: string }[]
}

export const municipalComplaints: MunicipalComplaint[] = [
  { id: 'CV-2026-00124', issue: 'Pothole', location: 'Sangli', date: '24 Sep 2026', priority: 'High', score: 86, status: 'Submitted', department: 'Road Maintenance', confidence: 88, severity: 'High', latitude: 16.8524, longitude: 74.5815, accuracy: 5, description: 'Large pothole near the main road junction. Please inspect and repair this stretch.', history: [{ status: 'Submitted', date: '24 Sep 2026, 10:32 AM', officer: 'Municipal Officer' }] },
  { id: 'CV-2026-00118', issue: 'Water Leakage', location: 'Miraj', date: '22 Sep 2026', priority: 'Medium', score: 64, status: 'Under Review', department: 'Water Supply', confidence: 91, severity: 'Medium', latitude: 16.8241, longitude: 74.6422, accuracy: 8, description: 'Water is leaking continuously near the residential lane.', history: [{ status: 'Submitted', date: '22 Sep 2026, 9:10 AM', officer: 'Municipal Officer' }, { status: 'Under Review', date: '22 Sep 2026, 11:15 AM', officer: 'Municipal Officer' }] },
  { id: 'CV-2026-00105', issue: 'Garbage', location: 'Kupwad', date: '20 Sep 2026', priority: 'Low', score: 42, status: 'In Progress', department: 'Solid Waste Management', confidence: 84, severity: 'Low', latitude: 16.8548, longitude: 74.6021, accuracy: 6, description: 'Waste has not been collected from this spot for several days.', history: [{ status: 'Submitted', date: '20 Sep 2026, 8:45 AM', officer: 'Municipal Officer' }, { status: 'Assigned', date: '20 Sep 2026, 10:05 AM', officer: 'Municipal Officer' }, { status: 'In Progress', date: '21 Sep 2026, 2:20 PM', officer: 'Municipal Officer' }] },
]

export const statusOrder: ComplaintStatus[] = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed']
export const issueOptions = ['All', 'Pothole', 'Water Leakage', 'Garbage'] as const
export const statusOptions = ['All', ...statusOrder] as const
export const priorityOptions = ['All', 'High', 'Medium', 'Low'] as const
export const departmentOptions = ['All', 'Road Maintenance', 'Water Supply', 'Solid Waste Management'] as const
