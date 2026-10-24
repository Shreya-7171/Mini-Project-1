import type { TFunction } from 'i18next'

// ---------------------------------------------------------------------------
// Language-aware display helpers.
//
// The backend/API contract stays language-independent: it always returns
// machine-readable values such as `pothole`, `water_supply` or `in_progress`.
// These helpers convert those stable values into the currently selected
// language for display only. Never mutate the underlying values.
// --------------------------------------------------

export function normalizeToken(value: string): string {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function formatLabel(value: string): string {
  if (!value) {
    return ''
  }

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const ISSUE_ALIASES: Record<string, string> = {
  pothole: 'pothole',
  potholes: 'pothole',
  garbage: 'garbage',
  trash: 'garbage',
  waste: 'garbage',
  open_manhole: 'open_manhole',
  open_man_hole: 'open_manhole',
  manhole: 'open_manhole',
  water_leakage: 'water_leakage',
  water_leak: 'water_leakage',
  leakage: 'water_leakage',
  damaged_streetlight: 'damaged_streetlight',
  streetlight: 'damaged_streetlight',
  street_light: 'damaged_streetlight',
}

const DEPARTMENT_ALIASES: Record<string, string> = {
  roads_public_works: 'roads_public_works',
  roads_and_public_works: 'roads_public_works',
  road_maintenance: 'roads_public_works',
  roads: 'roads_public_works',
  sanitation_solid_waste: 'sanitation',
  sanitation_and_solid_waste: 'sanitation',
  solid_waste_management: 'sanitation',
  solid_waste: 'sanitation',
  sanitation: 'sanitation',
  municipal_general_services: 'municipal_general_services',
  general_services: 'municipal_general_services',
  general: 'municipal_general_services',
  water_supply: 'water_supply',
  water: 'water_supply',
  electrical: 'electrical',
  electricity: 'electrical',
  safety: 'safety',
}

const STATUS_ALIASES: Record<string, string> = {
  submitted: 'submitted',
  under_review: 'under_review',
  assigned: 'assigned',
  in_progress: 'in_progress',
  resolved: 'resolved',
  closed: 'closed',
  rejected: 'rejected',
  draft: 'draft',
}

export function getIssueLabel(issue: string, t: TFunction): string {
  const token = ISSUE_ALIASES[normalizeToken(issue)]

  return token ? t(`enums.issue.${token}`) : formatLabel(issue)
}

export function getDepartmentLabel(department: string, t: TFunction): string {
  const token = DEPARTMENT_ALIASES[normalizeToken(department)]

  return token ? t(`enums.department.${token}`) : department
}

export function getStatusLabel(status: string, t: TFunction): string {
  const token = normalizeToken(status)

  return t(`enums.status.${token}`, { defaultValue: formatLabel(status) })
}

export function getSeverityLabel(severity: string, t: TFunction): string {
  const token = normalizeToken(severity)

  return t(`enums.severity.${token}`, { defaultValue: formatLabel(severity) })
}

export function getPriorityLabel(priority: string, t: TFunction): string {
  const token = normalizeToken(priority).replace(/_priority$/, '')

  return t(`enums.priority.${token}`, { defaultValue: formatLabel(priority) })
}

export function getDateLocale(language?: string): string {
  if (language === 'mr') {
    return 'mr-IN'
  }

  if (language === 'hi') {
    return 'hi-IN'
  }

  return 'en-IN'
}
