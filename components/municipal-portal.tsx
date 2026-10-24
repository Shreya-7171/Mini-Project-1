'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Check,
  ClipboardList,
  LayoutDashboard,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getReports, updateReportStatus } from '@/lib/api'
import {
  getDateLocale,
  getDepartmentLabel,
  getIssueLabel,
  getPriorityLabel,
  getSeverityLabel,
  getStatusLabel,
} from '@/lib/i18n-labels'
import { LanguageSwitcher } from '@/components/language-switcher'
import { getUploadUrl } from '@/lib/api-url'

type ComplaintStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Closed'

type MunicipalComplaint = {
  id: string
  issue: string
  location: string
  date: string
  priority: string
  score: number
  status: ComplaintStatus
  department: string
  confidence: number
  severity: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  description: string
  history: {
    status: ComplaintStatus
    date: string
    officer: string
  }[]
  imageUrl: string
}

const statusOrder: ComplaintStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
]

const issueOptions = ['All', 'Pothole', 'Garbage']

const statusOptions = ['All', ...statusOrder]

const priorityOptions = [
  'All',
  'Critical',
  'High',
  'Medium',
  'Low',
]

const departmentOptions = [
  'All',
  'Roads & Public Works',
  'Sanitation / Solid Waste',
]

function backendIssueToLabel(issue: string) {
  if (issue === 'pothole') return 'Pothole'
  if (issue === 'garbage') return 'Garbage'
  return issue
}

function capitalize(value: string) {
  return String(value || '').replace(/^./, (c: string) =>
    c.toUpperCase()
  )
}

function formatDate(
  value: string,
  locale: string,
  fallback: string
) {
  if (!value) {
    return fallback
  }

  try {
    const parsed = new Date(value)

    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return parsed.toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function buildImageUrl(imagePath: string) {
  return getUploadUrl(imagePath)
}

function transformReport(report: any): MunicipalComplaint {
  const issue = backendIssueToLabel(report.issue)
  const confidence = Number(report.confidence || 0)

  return {
    id: report.report_id,
    issue,
    location:
      report.latitude !== null && report.longitude !== null
        ? `${Number(report.latitude).toFixed(5)}, ${Number(report.longitude).toFixed(5)}`
        : '',
    date: report.created_at || '',
    priority: capitalize(report.priority || 'low'),
    score: Math.round(confidence * 100),
    status: report.status as ComplaintStatus,
    department: report.department || 'Unassigned',
    confidence,
    severity: capitalize(report.severity || 'low'),
    latitude:
      report.latitude === null ? null : Number(report.latitude),
    longitude:
      report.longitude === null ? null : Number(report.longitude),
    accuracy: null,
    description: report.description || '',
    history: [
      {
        status: report.status as ComplaintStatus,
        date: report.created_at || '',
        officer: 'System',
      },
    ],
    imageUrl: buildImageUrl(report.image_path),
  }
}

type View =
  | 'dashboard'
  | 'complaints'
  | 'analytics'
  | 'profile'
  | 'detail'

export function MunicipalPortal({
  onExit,
}: {
  onExit: () => void
}) {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<MunicipalComplaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    issue: 'All',
    status: 'All',
    priority: 'All',
    department: 'All',
    search: '',
  })

  const loadReports = async () => {
    try {
      setLoading(true)
      setError('')

      const result = await getReports()

      if (!result?.success) {
        throw new Error('Failed to load reports')
      }

      setData((result.reports || []).map(transformReport))
    } catch (err) {
      console.error(err)
      setError(t('admin.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openDetail = (id: string) => {
    setSelectedId(id)
    setView('detail')
    window.history.pushState(
      {},
      '',
      `/municipal/complaints/${id}`
    )
  }

  const navigate = (next: View) => {
    setView(next)

    if (next === 'complaints') {
      window.history.pushState(
        {},
        '',
        '/municipal/complaints'
      )
    } else if (next === 'analytics') {
      window.history.pushState(
        {},
        '',
        '/municipal/analytics'
      )
    } else if (next === 'dashboard') {
      window.history.pushState({}, '', '/municipal')
    }
  }

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return data.filter((c) => {
      const haystack = [
        c.id,
        c.issue,
        getIssueLabel(c.issue, t),
        c.location,
        c.department,
        getDepartmentLabel(c.department, t),
      ]
        .join(' ')
        .toLowerCase()

      return (
        (filters.issue === 'All' ||
          c.issue === filters.issue) &&
        (filters.status === 'All' ||
          c.status === filters.status) &&
        (filters.priority === 'All' ||
          c.priority === filters.priority) &&
        (filters.department === 'All' ||
          c.department === filters.department) &&
        (query === '' || haystack.includes(query))
      )
    })
  }, [data, filters, t])

  const updateStatus = async (
    id: string,
    status: ComplaintStatus
  ) => {
    try {
      setError('')

      await updateReportStatus(id, status)

      setData((items) =>
        items.map((c) =>
          c.id === id
            ? {
                ...c,
                status,
                history: c.history.some(
                  (h) => h.status === status
                )
                  ? c.history
                  : [
                      ...c.history,
                      {
                        status,
                        date: new Date().toISOString(),
                        officer: t('admin.municipalOfficer'),
                      },
                    ],
              }
            : c
        )
      )
    } catch (err) {
      console.error(err)
      setError(t('admin.updateError'))
    }
  }

  const selected = data.find(
    (c) => c.id === selectedId
  )

  return (
    <div className="municipal-shell">
      <aside className="sidebar">
        <Logo />

        <div className="sidebar-label">
          {t('common.workspace')}
        </div>

        <NavButton
          active={view === 'dashboard'}
          icon={LayoutDashboard}
          label={t('admin.dashboard')}
          onClick={() => navigate('dashboard')}
        />

        <NavButton
          active={view === 'complaints'}
          icon={ClipboardList}
          label={t('admin.complaints')}
          onClick={() => navigate('complaints')}
          badge={data.length}
        />

        <NavButton
          active={view === 'analytics'}
          icon={BarChart3}
          label={t('admin.analytics')}
          onClick={() => navigate('analytics')}
        />

        <NavButton
          active={view === 'profile'}
          icon={UserRound}
          label={t('common.profile')}
          onClick={() => navigate('profile')}
        />

        <div className="sidebar-bottom">
          <div className="help-card">
            <ShieldCheck size={17} />
            <strong>{t('admin.municipalOfficer')}</strong>
            <small>{t('admin.manageCivic')}</small>
          </div>

          <LanguageSwitcher className="sidebar-lang" />

          <button
            className="municipal-user"
            onClick={() => navigate('profile')}
          >
            <span className="avatar">MO</span>
            <span>
              <strong>{t('admin.municipalOfficer')}</strong>
              <small>{t('common.org')}</small>
            </span>
          </button>

          <button
            className="portal-exit"
            onClick={onExit}
          >
            {t('common.switchWorkspace')}
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              {t('admin.portalEyebrow')}
            </p>

            <h1>
              {view === 'detail'
                ? t('admin.complaintReview')
                : view === 'analytics'
                  ? t('admin.civicAnalytics')
                  : view === 'profile'
                    ? t('admin.officerProfile')
                    : t('admin.citizenComplaints')}
            </h1>

            <p>{t('common.municipalityName')}</p>
          </div>

          <div className="dashboard-actions">
            <LanguageSwitcher />

            <button
              className="outline-button"
              onClick={() =>
                alert(t('common.noNewNotifications'))
              }
            >
              <Bell size={21} strokeWidth={1.9} />
              {t('common.notifications')}
            </button>

            <button
              className="avatar"
              onClick={() => navigate('profile')}
            >
              MO
            </button>
          </div>
        </header>

        {error && (
          <div
            style={{
              margin: '0 24px 20px',
              padding: '12px 16px',
              borderRadius: 10,
              background: '#fff1f2',
              color: '#b42318',
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <section className="table-card">
            <h2>{t('admin.loading')}</h2>
            <p>{t('admin.loadingDesc')}</p>
          </section>
        ) : (
          <>
            {view === 'dashboard' && (
              <Dashboard
                data={data}
                onOpen={() => navigate('complaints')}
                onFilter={(status) => {
                  setFilters((f) => ({
                    ...f,
                    status,
                  }))
                  navigate('complaints')
                }}
              />
            )}

            {view === 'complaints' && (
              <Complaints
                data={filtered}
                filters={filters}
                setFilters={setFilters}
                clear={() =>
                  setFilters({
                    issue: 'All',
                    status: 'All',
                    priority: 'All',
                    department: 'All',
                    search: '',
                  })
                }
                onOpen={openDetail}
              />
            )}

            {view === 'detail' && selected && (
              <ComplaintDetail
                complaint={selected}
                onBack={() =>
                  navigate('complaints')
                }
                onUpdate={updateStatus}
              />
            )}

            {view === 'analytics' && (
              <Analytics data={data} />
            )}

            {view === 'profile' && (
              <OfficerProfile onExit={onExit} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Logo() {
  const { t } = useTranslation()

  return (
    <div className="brand">
      <div className="logo-mark">
        <ShieldCheck size={22} />
      </div>

      <div>
        <strong>{t('common.brand')}</strong>
        <span>{t('common.org')}</span>
      </div>
    </div>
  )
}

function NavButton({
  active,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  active: boolean
  icon: any
  label: string
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      className={active ? 'active' : ''}
      onClick={onClick}
    >
      <Icon size={22} strokeWidth={1.9} />
      <span>{label}</span>
      {badge !== undefined && <b>{badge}</b>}
    </button>
  )
}

function Dashboard({
  data,
  onOpen,
  onFilter,
}: {
  data: MunicipalComplaint[]
  onOpen: () => void
  onFilter: (status: string) => void
}) {
  const { t } = useTranslation()

  const stats = [
    [
      t('admin.totalComplaints'),
      data.length,
      t('admin.allReports'),
      'All',
    ],
    [
      t('admin.pending'),
      data.filter((c) =>
        ['Submitted', 'Under Review'].includes(
          c.status
        )
      ).length,
      t('admin.needsReview'),
      'Submitted',
    ],
    [
      t('admin.inProgress'),
      data.filter(
        (c) => c.status === 'In Progress'
      ).length,
      t('admin.beingResolved'),
      'In Progress',
    ],
    [
      t('admin.resolved'),
      data.filter((c) =>
        ['Resolved', 'Closed'].includes(
          c.status
        )
      ).length,
      t('admin.closedSuccessfully'),
      'Resolved',
    ],
  ] as const

  return (
    <>
      <section className="stats-grid">
        {stats.map(
          ([label, value, note, status]) => (
            <button
              className="stat-card navy"
              key={label}
              onClick={() =>
                status === 'All'
                  ? onOpen()
                  : onFilter(status)
              }
            >
              <div className="stat-top">
                <span>{label}</span>
                <ClipboardList
                  size={30}
                  strokeWidth={1.8}
                />
              </div>

              <strong>{value}</strong>
              <small>{note}</small>
            </button>
          )
        )}
      </section>

      <div className="table-card officer-welcome">
        <h2>{t('admin.complaintManagement')}</h2>
        <p>{t('admin.managementDesc')}</p>

        <button
          className="primary-button"
          onClick={onOpen}
        >
          {t('admin.openComplaints')}
          <ArrowLeft size={16} />
        </button>
      </div>
    </>
  )
}

function Complaints({
  data,
  filters,
  setFilters,
  clear,
  onOpen,
}: {
  data: MunicipalComplaint[]
  filters: {
    issue: string
    status: string
    priority: string
    department: string
    search: string
  }
  setFilters: (filters: any) => void
  clear: () => void
  onOpen: (id: string) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale(i18n.language)

  const select = (
    key: string,
    value: string
  ) =>
    setFilters({
      ...filters,
      [key]: value,
    })

  const issueLabel = (value: string) =>
    value === 'All'
      ? t('common.all')
      : getIssueLabel(value, t)

  const statusLabel = (value: string) =>
    value === 'All'
      ? t('common.all')
      : getStatusLabel(value, t)

  const priorityLabel = (value: string) =>
    value === 'All'
      ? t('common.all')
      : getPriorityLabel(value, t)

  const departmentLabel = (value: string) =>
    value === 'All'
      ? t('common.all')
      : getDepartmentLabel(value, t)

  return (
    <section className="officer-complaints">
      <div className="complaints-heading">
        <div>
          <p className="eyebrow">
            {t('admin.operationsQueue')}
          </p>
          <h2>{t('admin.allComplaints')}</h2>
          <p>{t('admin.operationsDesc')}</p>
        </div>

        <span className="result-count">
          {t('common.results', { count: data.length })}
        </span>
      </div>

      <div className="filter-bar">
        <label className="search-field">
          <Search
            size={21}
            strokeWidth={1.9}
          />

          <input
            value={filters.search}
            onChange={(e) =>
              select('search', e.target.value)
            }
            placeholder={t('admin.searchPlaceholder')}
          />
        </label>

        <select
          aria-label={t('admin.filterIssue')}
          value={filters.issue}
          onChange={(e) =>
            select('issue', e.target.value)
          }
        >
          {issueOptions.map((o) => (
            <option key={o} value={o}>
              {issueLabel(o)}
            </option>
          ))}
        </select>

        <select
          aria-label={t('admin.filterStatus')}
          value={filters.status}
          onChange={(e) =>
            select('status', e.target.value)
          }
        >
          {statusOptions.map((o) => (
            <option key={o} value={o}>
              {statusLabel(o)}
            </option>
          ))}
        </select>

        <select
          aria-label={t('admin.filterPriority')}
          value={filters.priority}
          onChange={(e) =>
            select('priority', e.target.value)
          }
        >
          {priorityOptions.map((o) => (
            <option key={o} value={o}>
              {priorityLabel(o)}
            </option>
          ))}
        </select>

        <select
          aria-label={t('admin.filterDepartment')}
          value={filters.department}
          onChange={(e) =>
            select('department', e.target.value)
          }
        >
          {departmentOptions.map((o) => (
            <option key={o} value={o}>
              {departmentLabel(o)}
            </option>
          ))}
        </select>

        <button
          className="outline-button clear-filter"
          onClick={clear}
        >
          {t('admin.clearFilters')}
        </button>
      </div>

      <div className="table-card officer-table">
        <div className="mobile-complaint-cards">
          {data.map((c) => (
            <article
              className="mobile-complaint-card"
              key={c.id}
            >
              <button
                className="table-link"
                onClick={() => onOpen(c.id)}
              >
                {c.id}
              </button>

              <strong>{getIssueLabel(c.issue, t)}</strong>
              <span>
                {c.location || t('common.locationNotProvided')}
              </span>

              <div>
                <span
                  className={`badge priority-${c.priority.toLowerCase()}`}
                >
                  {getPriorityLabel(c.priority, t)}
                </span>

                <span
                  className={`badge status-${c.status
                    .toLowerCase()
                    .replaceAll(' ', '-')}`}
                >
                  {getStatusLabel(c.status, t)}
                </span>
              </div>

              <small>
                {getDepartmentLabel(c.department, t)} ·{' '}
                {formatDate(
                  c.date,
                  locale,
                  t('common.dateUnavailable')
                )}
              </small>

              <button
                className="outline-button compact"
                onClick={() => onOpen(c.id)}
              >
                {t('common.viewComplaint')}
              </button>
            </article>
          ))}
        </div>

        <div className="desktop-complaint-table">
          <table>
            <colgroup>
              <col className="col-id" />
              <col className="col-issue" />
              <col className="col-location" />
              <col className="col-severity" />
              <col className="col-priority" />
              <col className="col-department" />
              <col className="col-status" />
              <col className="col-date" />
              <col className="col-action" />
            </colgroup>

            <thead>
              <tr>
                <th>{t('common.complaintId')}</th>
                <th>{t('common.issue')}</th>
                <th>{t('common.location')}</th>
                <th>{t('common.severity')}</th>
                <th>{t('common.priority')}</th>
                <th>{t('common.department')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.action')}</th>
              </tr>
            </thead>

            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => onOpen(c.id)}
                    >
                      {c.id}
                    </button>
                  </td>

                  <td className="issue-cell">
                    {getIssueLabel(c.issue, t)}
                  </td>

                  <td>
                    {c.location ||
                      t('common.locationNotProvided')}
                  </td>

                  <td className="center-cell">
                    <span
                      className={`badge severity-${c.severity.toLowerCase()}`}
                    >
                      {getSeverityLabel(c.severity, t)}
                    </span>
                  </td>

                  <td className="center-cell">
                    <span
                      className={`badge priority-${c.priority.toLowerCase()}`}
                    >
                      {getPriorityLabel(c.priority, t)}
                    </span>
                  </td>

                  <td className="department-cell">
                    {getDepartmentLabel(c.department, t)}
                  </td>

                  <td className="center-cell">
                    <span
                      className={`badge status-${c.status
                        .toLowerCase()
                        .replaceAll(' ', '-')}`}
                    >
                      {getStatusLabel(c.status, t)}
                    </span>
                  </td>

                  <td>
                    {formatDate(
                      c.date,
                      locale,
                      t('common.dateUnavailable')
                    )}
                  </td>

                  <td className="center-cell">
                    <button
                      className="outline-button compact"
                      onClick={() => onOpen(c.id)}
                    >
                      {t('common.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.length === 0 && (
          <p className="empty-state">
            {t('admin.emptyState')}
          </p>
        )}
      </div>
    </section>
  )
}

function ComplaintDetail({
  complaint,
  onBack,
  onUpdate,
}: {
  complaint: MunicipalComplaint
  onBack: () => void
  onUpdate: (
    id: string,
    status: ComplaintStatus
  ) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale(i18n.language)

  const [next, setNext] =
    useState<ComplaintStatus>(
      complaint.status
    )

  return (
    <section className="municipal-detail-grid">
      <button
        className="back-link"
        onClick={onBack}
      >
        <ArrowLeft size={16} />
        {t('admin.backToComplaints')}
      </button>

      <section className="table-card detail-panel">
        {complaint.imageUrl ? (
          <img
            className="admin-image"
            src={complaint.imageUrl}
            alt={getIssueLabel(complaint.issue, t)}
          />
        ) : (
          <div
            style={{
              padding: 30,
              textAlign: 'center',
            }}
          >
            {t('admin.noImage')}
          </div>
        )}

        <h2>{complaint.id}</h2>

        <div className="detail-grid">
          <Info
            label={t('admin.issueCategory')}
            value={getIssueLabel(complaint.issue, t)}
          />

          <Info
            label={t('admin.aiDetection')}
            value={getIssueLabel(complaint.issue, t)}
          />

          <Info
            label={t('common.confidence')}
            value={`${(complaint.confidence * 100).toFixed(1)}%`}
          />

          <Info
            label={t('common.severity')}
            value={getSeverityLabel(complaint.severity, t)}
          />

          <Info
            label={t('common.priority')}
            value={getPriorityLabel(complaint.priority, t)}
          />

          <Info
            label={t('common.department')}
            value={getDepartmentLabel(
              complaint.department,
              t
            )}
          />

          <Info
            label={t('common.location')}
            value={
              complaint.latitude !== null &&
              complaint.longitude !== null
                ? `${complaint.latitude}, ${complaint.longitude}`
                : t('common.locationNotProvided')
            }
          />

          <Info
            label={t('admin.dateSubmitted')}
            value={formatDate(
              complaint.date,
              locale,
              t('common.dateUnavailable')
            )}
          />

          <Info
            label={t('admin.currentStatus')}
            value={getStatusLabel(complaint.status, t)}
          />
        </div>

        <div className="description">
          <small>{t('admin.citizenDescription')}</small>
          <p>
            {complaint.description ||
              t('common.noDescription')}
          </p>
        </div>
      </section>

      <section className="table-card detail-panel">
        <h2>{t('admin.statusWorkflow')}</h2>

        <label className="field-label">
          {t('admin.updateStatus')}

          <select
            value={next}
            onChange={(e) =>
              setNext(
                e.target.value as ComplaintStatus
              )
            }
          >
            {statusOrder.map((s) => (
              <option key={s} value={s}>
                {getStatusLabel(s, t)}
              </option>
            ))}
          </select>
        </label>

        <button
          className="primary-button"
          onClick={() =>
            onUpdate(complaint.id, next)
          }
        >
          {t('admin.updateStatus')}
          <Check size={16} />
        </button>

        <div className="timeline">
          {statusOrder.map((status) => {
            const index =
              statusOrder.indexOf(status)

            const current =
              statusOrder.indexOf(
                complaint.status
              )

            return (
              <div
                className={`timeline-item ${
                  index === current
                    ? 'current'
                    : index < current
                      ? 'complete'
                      : ''
                }`}
                key={status}
              >
                <span>
                  {index <= current ? (
                    <Check size={12} />
                  ) : (
                    ''
                  )}
                </span>

                <div>
                  <strong>
                    {getStatusLabel(status, t)}
                  </strong>

                  {complaint.history.find(
                    (h) => h.status === status
                  ) && (
                    <small>
                      {
                        formatDate(
                          complaint.history.find(
                            (h) =>
                              h.status === status
                          )?.date || '',
                          locale,
                          t('common.dateUnavailable')
                        )
                      }{' '}
                      ·{' '}
                      {
                        complaint.history.find(
                          (h) =>
                            h.status === status
                        )?.officer
                      }
                    </small>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </section>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="info-row">
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  )
}

function Analytics({
  data,
}: {
  data: MunicipalComplaint[]
}) {
  const { t } = useTranslation()

  const count = (
    fn: (c: MunicipalComplaint) => boolean
  ) => data.filter(fn).length

  const categories = [
    'Pothole',
    'Garbage',
  ]

  const statuses = [
    'Submitted',
    'Under Review',
    'Assigned',
    'In Progress',
    'Resolved',
    'Closed',
  ]

  const priorities = [
    'Critical',
    'High',
    'Medium',
    'Low',
  ]

  return (
    <section className="analytics-grid">
      <AnalyticsCard
        title={t('admin.totalComplaints')}
        value={data.length}
      />

      <AnalyticsCard
        title={t('admin.criticalPriority')}
        value={count(
          (c) => c.priority === 'Critical'
        )}
      />

      <Chart
        title={t('admin.byCategory')}
        rows={categories.map(
          (x) =>
            [
              getIssueLabel(x, t),
              count((c) => c.issue === x),
            ] as [string, number]
        )}
      />

      <Chart
        title={t('admin.byStatus')}
        rows={statuses.map(
          (x) =>
            [
              getStatusLabel(x, t),
              count((c) => c.status === x),
            ] as [string, number]
        )}
      />

      <Chart
        title={t('admin.priorityDistribution')}
        rows={priorities.map(
          (x) =>
            [
              getPriorityLabel(x, t),
              count((c) => c.priority === x),
            ] as [string, number]
        )}
      />
    </section>
  )
}

function AnalyticsCard({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <div className="stat-card navy">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Chart({
  title,
  rows,
}: {
  title: string
  rows: [string, number][]
}) {
  const max = Math.max(
    ...rows.map((r) => r[1]),
    1
  )

  return (
    <div className="table-card chart-card">
      <h2>{title}</h2>

      {rows.map(([label, value]) => (
        <div
          className="chart-row"
          key={label}
        >
          <span>{label}</span>

          <div>
            <i
              style={{
                width: `${(value / max) * 100}%`,
              }}
            />
          </div>

          <b>{value}</b>
        </div>
      ))}
    </div>
  )
}

function OfficerProfile({
  onExit,
}: {
  onExit: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="table-card officer-profile">
      <div className="profile-hero">
        <div className="avatar large">
          MO
        </div>

        <div>
          <h2>{t('admin.municipalOfficer')}</h2>
          <p>{t('admin.complaintMgmtShort')}</p>
        </div>
      </div>

      <button
        className="outline-button"
        onClick={onExit}
      >
        {t('common.switchWorkspace')}
      </button>
    </section>
  )
}
