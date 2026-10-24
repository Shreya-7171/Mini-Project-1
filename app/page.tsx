'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { MunicipalPortal } from '@/components/municipal-portal'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useAuth } from '@/components/auth-provider'
import { login as authLogin, register as authRegister } from '@/lib/auth'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  Construction,
  Droplets,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  LocateFixed,
  Lock,
  LogIn,
  Mail,
  MapPin,
  MoreHorizontal,
  Navigation,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  User,
  UserRound,
} from 'lucide-react'

import {
  predictComplaint,
  submitComplaint,
  getReports,
  getReport,
} from '@/lib/api'
import { getUploadUrl } from '@/lib/api-url'

import {
  getDateLocale,
  getDepartmentLabel,
  getIssueLabel,
  getPriorityLabel,
  getSeverityLabel,
  getStatusLabel,
} from '@/lib/i18n-labels'

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type PredictionDetection = {
  issue: string
  confidence: number
  severity: string
  priority: string
  department: string
  box?: number[]
}

type PredictionResult = {
  success: boolean
  report_id: string
  image_id: string
  issue: string
  confidence: number
  severity: string
  priority: string
  department: string
  status: string
  created_at: string
  detections: PredictionDetection[]
  image_path?: string
  duplicate?: boolean
}

type ReportLocation = {
  latitude: number
  longitude: number
  accuracy: number
  capturedAt: Date
}

const statusOrder = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
] as const

// --------------------------------------------------
// DEMO DATA
// --------------------------------------------------

const complaints = [
  {
    id: 'CV-2026-00124',
    issue: 'Pothole',
    location: 'Sangli',
    date: '24 Sep 2026',
    priority: 'High',
    score: 86,
    status: 'Submitted',
    icon: Construction,
    tone: 'orange',
  },
  {
    id: 'CV-2026-00118',
    issue: 'Water Leakage',
    location: 'Miraj',
    date: '22 Sep 2026',
    priority: 'Medium',
    score: 64,
    status: 'Under Review',
    icon: Droplets,
    tone: 'blue',
  },
  {
    id: 'CV-2026-00105',
    issue: 'Garbage',
    location: 'Kupwad',
    date: '20 Sep 2026',
    priority: 'Low',
    score: 42,
    status: 'In Progress',
    icon: Trash2,
    tone: 'green',
  },
]

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function formatConfidence(value: number) {
  if (!value) {
    return '0%'
  }

  const percentage = value > 1 ? value : value * 100

  return `${percentage.toFixed(1)}%`
}

function marchOrGarbage(issue: string) {
  return issue === 'garbage' ? 'garbage' : 'pothole'
}

function reportToPredictionResult(report: any): PredictionResult {
  return {
    success: true,
    report_id: report.report_id ?? '',
    image_id: report.image_id ?? '',
    image_path: report.image_path,
    issue: report.issue ?? '',
    confidence: Number(report.confidence ?? 0),
    severity: report.severity ?? 'low',
    priority: report.priority ?? 'low',
    department: report.department ?? 'Unassigned',
    status: report.status ?? 'Submitted',
    created_at: report.created_at ?? new Date().toISOString(),
    detections: [],
  }
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(file)

    setUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return url
}

// --------------------------------------------------
// LOGO
// --------------------------------------------------

function Logo({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <div
      className={`brand ${
        compact ? 'brand-compact' : ''
      }`}
    >
      <div className="logo-mark">
        <Sparkles
          size={23}
          strokeWidth={1.9}
        />
      </div>

      <div>
        <strong>CivicVision AI</strong>
        <span>SMKMC</span>
      </div>
    </div>
  )
}

// --------------------------------------------------
// ICON BUTTON
// --------------------------------------------------

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      className="icon-button"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// --------------------------------------------------
// CITIZEN HEADER
// --------------------------------------------------

function CitizenHeader({
  onNotifications,
  onProfile,
}: {
  onNotifications?: () => void
  onProfile?: () => void
}) {
  const { t } = useTranslation()

  return (
    <header className="topbar citizen-topbar">
      <Logo />

      <div className="top-actions">
        <LanguageSwitcher />

        <IconButton
          label={t('common.notifications')}
          onClick={onNotifications}
        >
          <Bell size={21} />
        </IconButton>

        <button
          className="avatar"
          aria-label={t('common.openProfile')}
          onClick={onProfile}
        >
          <UserRound size={16} />
        </button>
      </div>
    </header>
  )
}

// --------------------------------------------------
// BOTTOM NAV
// --------------------------------------------------

function BottomNav({
  active = 'home',
  onNavigate,
}: {
  active?: string
  onNavigate: (value: string) => void
}) {
  const { t } = useTranslation()

  const items: { key: string; label: string; icon: any }[] = [
    { key: 'home', label: t('nav.home'), icon: Home },
    {
      key: 'myComplaints',
      label: t('nav.myComplaints'),
      icon: ClipboardList,
    },
    { key: 'profile', label: t('nav.profile'), icon: UserRound },
  ]

  return (
    <nav className="bottom-nav">
      {items.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          className={active === key ? 'active' : ''}
          onClick={() => onNavigate(key)}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

// --------------------------------------------------
// ROLE SELECTION (LOGIN PORTAL)
// --------------------------------------------------

function RoleSelection({
  onCitizen,
  onOfficer,
}: {
  onCitizen: () => void
  onOfficer: () => void
}) {
  const { t } = useTranslation()

  return (
    <main className="role-screen">
      <div className="role-lang">
        <LanguageSwitcher />
      </div>

      <div className="role-card">
        <Logo />

        <p className="eyebrow">{t('role.eyebrow')}</p>

        <h1>{t('role.title')}</h1>

        <p className="muted-copy">{t('role.subtitle')}</p>

        <div className="role-options">
          <button
            className="role-option citizen-role"
            onClick={onCitizen}
          >
            <span className="role-icon">
              <UserRound size={30} />
            </span>

            <span>
              <strong>{t('role.citizenTitle')}</strong>

              <small>{t('role.citizenDesc')}</small>
            </span>

            <ArrowRight size={20} />
          </button>

          <button
            className="role-option officer-role"
            onClick={onOfficer}
          >
            <span className="role-icon">
              <ShieldCheck size={30} />
            </span>

            <span>
              <strong>{t('role.officerTitle')}</strong>

              <small>{t('role.officerDesc')}</small>
            </span>

            <ArrowRight size={20} />
          </button>
        </div>

        <p className="role-note">
          {t('common.municipalityName')}
        </p>
        <div className="footer" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted)' }}>
          <p>© 2026 CivicVision AI. All rights reserved.</p>
        </div>
      </div>
    </main>
  )
}

// --------------------------------------------------
// CITIZEN LOGIN
// --------------------------------------------------

// Maps backend/API error messages (English, language-independent contract)
// to translation keys so auth errors render in the selected language.
const AUTH_ERROR_MESSAGE_KEYS: Record<string, string> = {
  'Login failed. Please try again.': 'auth.errors.loginFailed',
  'Login failed': 'auth.errors.loginFailed',
  'Registration failed. Please try again.': 'auth.errors.registrationFailed',
  'Registration failed': 'auth.errors.registrationFailed',
  'This account is not a municipal officer account.':
    'auth.errors.notOfficer',
  'Invalid email or password': 'auth.errors.invalidCredentials',
  'Email already registered': 'auth.errors.emailRegistered',
  'Password must be at least 6 characters':
    'auth.errors.passwordTooShort',
  'Could not validate credentials': 'auth.errors.credentialsInvalid',
  'Failed to fetch': 'auth.errors.network',
  'NetworkError when attempting to fetch resource.':
    'auth.errors.network',
}

function authErrorText(message: string, t: TFunction): string {
  const key = AUTH_ERROR_MESSAGE_KEYS[message]

  return key ? t(key) : message
}

function CitizenLoginScreen({
  onBack,
  onSuccess,
  onSwitchToRegister,
}: {
  onBack: () => void
  onSuccess: () => void
  onSwitchToRegister: () => void
}) {
  const { t } = useTranslation()
  const { login: providerLogin } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError('')

      const result = await authLogin(email.trim(), password)

      providerLogin(result.access_token, result.user)

      onSuccess()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="role-screen">
      <div className="role-lang">
        <LanguageSwitcher />
      </div>

      <div className="role-card">
        <Logo />

        <p className="eyebrow">{t('auth.citizenLogin.eyebrow')}</p>

        <h1>{t('auth.citizenLogin.title')}</h1>

        <p className="muted-copy">
          {t('auth.citizenLogin.subtitle')}
        </p>

        <form
          id="citizen-login-form"
          name="citizen-login"
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <label className="field-label" htmlFor="citizen-login-email">
            {t('auth.citizenLogin.emailLabel')}
            <input
              id="citizen-login-email"
              name="citizen_email"
              className="auth-input"
              type="email"
              placeholder={t('auth.citizenLogin.emailPlaceholder')}
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field-label" htmlFor="citizen-login-password">
            {t('auth.citizenLogin.passwordLabel')}
            <input
              id="citizen-login-password"
              name="citizen_password"
              className="auth-input"
              type="password"
              placeholder={t('auth.citizenLogin.passwordPlaceholder')}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && (
            <p className="camera-error" role="alert">
              {authErrorText(error, t)}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? t('auth.citizenLogin.submitting')
              : t('auth.citizenLogin.submit')}
            <LogIn size={17} />
          </button>
        </form>

        <button
          className="text-button auth-switch"
          type="button"
          onClick={onSwitchToRegister}
        >
          {t('auth.citizenLogin.noAccount')}
          <ArrowRight size={15} />
        </button>

        <button
          className="back-link auth-back"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          {t('auth.citizenLogin.back')}
        </button>

        <p className="role-note">{t('common.municipalityName')}</p>
      </div>
    </main>
  )
}

// --------------------------------------------------
// CITIZEN REGISTER
// --------------------------------------------------

function CitizenRegisterScreen({
  onBack,
  onSuccess,
  onSwitchToLogin,
}: {
  onBack: () => void
  onSuccess: () => void
  onSwitchToLogin: () => void
}) {
  const { t } = useTranslation()
  const { login: providerLogin } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError('')

      await authRegister(name.trim(), email.trim(), password)

      const result = await authLogin(email.trim(), password)

      providerLogin(result.access_token, result.user)

      onSuccess()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="role-screen">
      <div className="role-lang">
        <LanguageSwitcher />
      </div>

      <div className="role-card">
        <Logo />

        <p className="eyebrow">{t('auth.citizenRegister.eyebrow')}</p>

        <h1>{t('auth.citizenRegister.title')}</h1>

        <p className="muted-copy">
          {t('auth.citizenRegister.subtitle')}
        </p>

        <form
          id="citizen-register-form"
          name="citizen-register"
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <label className="field-label" htmlFor="citizen-register-name">
            {t('auth.citizenRegister.nameLabel')}
            <input
              id="citizen-register-name"
              name="citizen_full_name"
              className="auth-input"
              type="text"
              placeholder={t('auth.citizenRegister.namePlaceholder')}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label className="field-label" htmlFor="citizen-register-email">
            {t('auth.citizenRegister.emailLabel')}
            <input
              id="citizen-register-email"
              name="citizen_register_email"
              className="auth-input"
              type="email"
              placeholder={t('auth.citizenRegister.emailPlaceholder')}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field-label" htmlFor="citizen-register-password">
            {t('auth.citizenRegister.passwordLabel')}
            <input
              id="citizen-register-password"
              name="citizen_register_password"
              className="auth-input"
              type="password"
              placeholder={t('auth.citizenRegister.passwordPlaceholder')}
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && (
            <p className="camera-error" role="alert">
              {authErrorText(error, t)}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? t('auth.citizenRegister.submitting')
              : t('auth.citizenRegister.submit')}
            <Send size={17} />
          </button>
        </form>

        <button
          className="text-button auth-switch"
          type="button"
          onClick={onSwitchToLogin}
        >
          {t('auth.citizenRegister.hasAccount')}
          <ArrowRight size={15} />
        </button>

        <button
          className="back-link auth-back"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          {t('auth.citizenRegister.back')}
        </button>

        <p className="role-note">{t('common.municipalityName')}</p>
      </div>
    </main>
  )
}

// --------------------------------------------------
// OFFICER LOGIN
// --------------------------------------------------

function OfficerLoginScreen({
  onBack,
  onSuccess,
}: {
  onBack: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const { login: providerLogin } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError('')

      const result = await authLogin(email.trim(), password)

      if (result.user?.role !== 'municipal_officer') {
        throw new Error(
          'This account is not a municipal officer account.',
        )
      }

      providerLogin(result.access_token, result.user)

      onSuccess()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="role-screen">
      <div className="role-lang">
        <LanguageSwitcher />
      </div>

      <div className="role-card">
        <Logo />

        <p className="eyebrow">{t('auth.officerLogin.eyebrow')}</p>

        <h1>{t('auth.officerLogin.title')}</h1>

        <p className="muted-copy">
          {t('auth.officerLogin.subtitle')}
        </p>

        <form
          id="officer-login-form"
          name="officer-login"
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <label className="field-label" htmlFor="officer-login-email">
            {t('auth.officerLogin.emailLabel')}
            <input
              id="officer-login-email"
              name="officer_email"
              className="auth-input"
              type="email"
              placeholder={t('auth.officerLogin.emailPlaceholder')}
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field-label" htmlFor="officer-login-password">
            {t('auth.officerLogin.passwordLabel')}
            <input
              id="officer-login-password"
              name="officer_password"
              className="auth-input"
              type="password"
              placeholder={t('auth.officerLogin.passwordPlaceholder')}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && (
            <p className="camera-error" role="alert">
              {authErrorText(error, t)}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? t('auth.officerLogin.submitting')
              : t('auth.officerLogin.submit')}
            <ShieldCheck size={17} />
          </button>
        </form>

        <button
          className="back-link auth-back"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          {t('auth.officerLogin.back')}
        </button>

        <p className="role-note">{t('common.municipalityName')}</p>
      </div>
    </main>
  )
}

// --------------------------------------------------
// HOME SCREEN
// --------------------------------------------------

function HomeScreen({
  onReport,
  onComplaints,
  onNotifications,
  onProfile,
  onRecentComplaint,
}: {
  onReport: () => void
  onComplaints: () => void
  onNotifications: () => void
  onProfile: () => void
  onRecentComplaint: (reportId: string) => void
}) {
  const { t, i18n } = useTranslation()

  const [latestReport, setLatestReport] =
    useState<any | null>(null)

  const [loadingRecent, setLoadingRecent] =
    useState(true)

  useEffect(() => {
    let cancelled = false

    const loadLatestReport = async () => {
      try {
        setLoadingRecent(true)

        const result = await getReports()

        if (!result?.success) {
          throw new Error('Failed to load recent complaints')
        }

        if (!cancelled) {
          setLatestReport(result.reports?.[0] ?? null)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) {
          setLoadingRecent(false)
        }
      }
    }

    loadLatestReport()

    return () => {
      cancelled = true
    }
  }, [])

  const recentComplaint = latestReport
    ? {
        id: latestReport.report_id,
        issue: latestReport.issue ?? '',
        location:
          latestReport.latitude !== null &&
          latestReport.longitude !== null
            ? `${Number(latestReport.latitude).toFixed(4)}, ${Number(latestReport.longitude).toFixed(4)}`
            : t('common.locationNotProvided'),
        date: latestReport.created_at
          ? new Date(latestReport.created_at).toLocaleDateString(
              getDateLocale(i18n.language),
              {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              },
            )
          : t('common.dateUnavailable'),
        priority: String(latestReport.priority ?? 'low'),
        score: Math.round(
          Number(latestReport.confidence ?? 0) * 100,
        ),
        status: latestReport.status ?? 'Submitted',
        icon:
          latestReport.issue === 'garbage'
            ? Trash2
            : Construction,
        tone:
          latestReport.issue === 'garbage'
            ? 'green'
            : 'orange',
      }
    : null

  return (
    <div className="citizen-shell">
      <CitizenHeader
        onNotifications={onNotifications}
        onProfile={onProfile}
      />

      <main className="citizen-content">
        <section className="welcome">
          <div>
            <p className="eyebrow">{t('home.eyebrow')}</p>

            <h1>
              {t('home.title')}{' '}
              <em>{t('home.titleEmphasis')}</em>
            </h1>

            <p className="lede">{t('home.lede')}</p>
          </div>

          <div className="city-art">
            <img
              src="/civic-city-hero.png"
              alt={t('home.heroAlt')}
            />
          </div>
        </section>

        <button
          className="report-cta"
          onClick={onReport}
        >
          <span className="cta-icon">
            <Camera size={38} strokeWidth={2} />
          </span>

          <span>
            <strong>{t('common.reportIssue')}</strong>

            <small>{t('home.ctaDesc')}</small>
          </span>

          <ArrowRight className="cta-arrow" size={20} />
        </button>

        <section className="ai-report-intro">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('home.aiEyebrow')}</p>

              <h2>{t('home.aiTitle')}</h2>
            </div>
          </div>

          <p className="muted-copy">{t('home.aiDesc')}</p>
        </section>

        <section className="recent-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {t('home.recentEyebrow')}
              </p>

              <h2>{t('home.recentTitle')}</h2>
            </div>

            <button
              className="text-button"
              onClick={onComplaints}
            >
              {t('common.seeAll')}
              <ArrowRight size={14} />
            </button>
          </div>

          {loadingRecent ? (
            <div className="table-card">
              <p className="muted-copy">
                {t('home.loadingRecent')}
              </p>
            </div>
          ) : recentComplaint ? (
            <ComplaintCard
              complaint={recentComplaint}
              onClick={() =>
                onRecentComplaint(latestReport.report_id)
              }
            />
          ) : (
            <div className="table-card">
              <p className="muted-copy">
                {t('home.emptyRecent')}
              </p>
            </div>
          )}
        </section>
      </main>

      <BottomNav
        onNavigate={(value) => {
          if (value === 'myComplaints') {
            onComplaints()
          }

          if (value === 'profile') {
            onProfile()
          }
        }}
      />
    </div>
  )
}

// --------------------------------------------------
// STEPS
// --------------------------------------------------

function Steps({ active }: { active: number }) {
  const { t } = useTranslation()

  return (
    <div className="steps">
      {[
        t('steps.photo'),
        t('steps.location'),
        t('steps.analysis'),
        t('steps.review'),
      ].map((label, index) => (
        <div
          className={`step ${index <= active ? 'done' : ''}`}
          key={label}
        >
          <span>
            {index < active ? <Check size={12} /> : index + 1}
          </span>

          <small>{label}</small>
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------
// REPORT SCREEN
// --------------------------------------------------

function ReportScreen({
  onHome,
  onContinue,
}: {
  onHome: () => void
  onContinue: (file: File) => void
}) {
  const { t } = useTranslation()

  const videoRef = useRef<HTMLVideoElement>(null)

  const streamRef = useRef<MediaStream | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)

  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [cameraOpen, setCameraOpen] = useState(false)

  const [cameraError, setCameraError] = useState('')

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null)

  const [previewFailed, setPreviewFailed] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  const galleryPreview = useObjectUrl(selectedFile)

  useEffect(() => {
    return () => {
      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop())
    }
  }, [])

  const chooseGalleryImage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase()
    const isHeic =
      /image\/hei[cf]/i.test(file.type) ||
      extension === 'heic' ||
      extension === 'heif'
    const supportedImageTypes: Record<string, string> = {
      bmp: 'image/bmp',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    }
    const imageType = file.type.startsWith('image/')
      ? file.type
      : extension
        ? supportedImageTypes[extension]
        : undefined

    if (!imageType && !isHeic) {
      setCameraError(t('report.errors.chooseImage'))
      return
    }

    const useImage = (image: File) => {
      setPreviewFailed(false)
      setSelectedFile(image)
      setCameraError('')
    }

    if (isHeic) {
      setCameraError('')
      setSelectedFile(null)
      setIsConverting(true)
      void import('heic2any')
        .then(({ default: convert }) =>
          convert({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9,
          }),
        )
        .then((converted) => {
          const jpeg = Array.isArray(converted)
            ? converted[0]
            : converted

          useImage(
            new File(
              [jpeg],
              file.name.replace(/\.(heic|heif)$/i, '.jpg'),
              {
                type: 'image/jpeg',
                lastModified: file.lastModified,
              },
            ),
          )
          setIsConverting(false)
        })
        .catch((error: unknown) => {
          console.error('Failed to convert HEIC image:', error)
          setCameraError(t('report.errors.heicConversionFailed'))
          setIsConverting(false)
        })
      return
    }

    setIsConverting(false)
    useImage(
      file.type === imageType
        ? file
        : new File([file], file.name, {
            type: imageType,
            lastModified: file.lastModified,
          }),
    )
  }

  const openCamera = async () => {
    setCameraError('')

    if (!window.isSecureContext) {
      setCameraError(t('report.errors.cameraSecureContext'))
      cameraInputRef.current?.click()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('report.errors.cameraUnsupported'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment',
          },
        },
        audio: false,
      })

      streamRef.current = stream
      setCameraOpen(true)

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream

          videoRef.current.play().catch(() => undefined)
        }
      })
    } catch {
      setCameraError(t('report.errors.cameraDenied'))
      cameraInputRef.current?.click()
    }
  }

  const closeCamera = () => {
    streamRef.current
      ?.getTracks()
      .forEach((track) => track.stop())

    streamRef.current = null
    setCameraOpen(false)
  }

  const captureCameraPhoto = () => {
    const video = videoRef.current

    if (!video) {
      setCameraError(t('report.errors.cameraNotReady'))
      return
    }

    const width = video.videoWidth || 1280

    const height = video.videoHeight || 720

    const canvas = document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      setCameraError(t('report.errors.captureFailed'))
      return
    }

    context.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError(t('report.errors.createImageFailed'))
          return
        }

        const file = new File(
          [blob],
          `civicvision-${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
          },
        )

        setPreviewFailed(false)
        setSelectedFile(file)

        closeCamera()
        setCameraError('')
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <div className="mobile-page">
      <div className="page-header">
        <IconButton
          label={t('report.backToHome')}
          onClick={onHome}
        >
          <ArrowLeft size={19} />
        </IconButton>

        <div>
          <strong>{t('common.reportIssue')}</strong>

          <small>{t('report.subtitle')}</small>
        </div>

        <div className="page-header-actions">
          <LanguageSwitcher />

          <IconButton label={t('common.help')}>
            <CircleHelp size={18} />
          </IconButton>
        </div>
      </div>

      <main className="flow-content">
        <Steps active={0} />

        <p className="eyebrow">{t('report.step1')}</p>

        <h1>{t('report.title')}</h1>

        <p className="muted-copy">{t('report.desc')}</p>

        {cameraOpen ? (
          <section className="camera-panel">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label={t('report.cameraPreview')}
            />

            <div className="camera-controls">
              <button
                className="outline-button"
                onClick={closeCamera}
              >
                {t('report.closeCamera')}
              </button>

              <button
                className="primary-button"
                onClick={captureCameraPhoto}
              >
                {t('report.capturePhoto')}
                <Camera size={17} />
              </button>
            </div>
          </section>
        ) : galleryPreview ? (
          <section className="gallery-preview">
            {previewFailed ? (
              <div className="preview-fallback" role="alert">
                <ImageIcon size={28} />
                <strong>{t('report.errors.previewFailed')}</strong>
                <span>{t('report.errors.chooseImage')}</span>
              </div>
            ) : (
              <img
                src={galleryPreview}
                alt={t('report.selectedImage')}
                onError={() => setPreviewFailed(true)}
                onLoad={() => setPreviewFailed(false)}
              />
            )}

            <div className="camera-controls">
              <button
                className="outline-button"
                disabled={isConverting}
                onClick={() =>
                  galleryInputRef.current?.click()
                }
              >
                {t('report.chooseAnother')}
              </button>

              <button
                className="primary-button"
                disabled={!selectedFile || isConverting}
                onClick={() => {
                  if (selectedFile) {
                    onContinue(selectedFile)
                  }
                }}
              >
                {t('report.useThisPhoto')}
                <Check size={17} />
              </button>
            </div>
          </section>
        ) : (
          <div className="upload-grid">
            <button
              className="upload-card selected"
              onClick={openCamera}
            >
              <span className="upload-icon">
                <Camera size={28} />
              </span>

              <strong>{t('report.takePhoto')}</strong>

              <small>{t('report.useCamera')}</small>
            </button>

            <button
              className="upload-card"
              onClick={() =>
                galleryInputRef.current?.click()
              }
            >
              <span className="upload-icon gallery">
                <ImageIcon size={28} />
              </span>

              <strong>{t('report.chooseGallery')}</strong>

              <small>{t('report.selectImage')}</small>
            </button>
          </div>
        )}

        <input
          ref={cameraInputRef}
          className="sr-only"
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          onChange={chooseGalleryImage}
        />

        <input
          ref={galleryInputRef}
          className="sr-only"
          type="file"
          accept="image/*,.heic,.heif"
          onChange={chooseGalleryImage}
        />

        {cameraError && (
          <p className="camera-error" role="alert">
            {cameraError}
          </p>
        )}

        {isConverting && (
          <p className="location-note" role="status">
            {t('report.convertingImage')}
          </p>
        )}

        <div className="tip">
          <Sparkles size={16} />

          <span>{t('report.tip')}</span>
        </div>
      </main>

      <div className="sticky-action">
        {!cameraOpen && (
          <button
            className="primary-button"
            disabled={!selectedFile || isConverting}
            onClick={() => {
              if (selectedFile) {
                onContinue(selectedFile)
              }
            }}
          >
            {t('common.continue')}
            <ArrowRight size={17} />
          </button>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------
// LOCATION SCREEN
// --------------------------------------------------

function LocationScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void
  onContinue: (location: ReportLocation | null) => void
}) {
  const { t } = useTranslation()

  const [location, setLocation] =
    useState<ReportLocation | null>(null)

  const [error, setError] = useState('')
  const [isLocating, setIsLocating] = useState(false)

  const detectLocation = async () => {
    const isNativeApp = Capacitor.isNativePlatform()

    if (!isNativeApp && !window.isSecureContext) {
      setError(t('location.errors.insecure'))
      return
    }

    if (!isNativeApp && !navigator.geolocation) {
      setError(t('location.errors.unsupported'))
      return
    }

    setError('')
    setIsLocating(true)
    try {
      const position = isNativeApp
        ? await (async () => {
            let permission = await Geolocation.checkPermissions()
            if (permission.location !== 'granted') {
              permission = await Geolocation.requestPermissions({
                permissions: ['location'],
              })
            }
            if (permission.location !== 'granted') {
              throw new Error('LOCATION_PERMISSION_DENIED')
            }
            return Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              maximumAge: 30000,
              timeout: 12000,
            })
          })()
        : await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 30000,
          timeout: 12000,
            })
          })

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date(),
      })
    } catch (locationError) {
      const code = String(
        (locationError as { code?: string | number })?.code ?? '',
      )
      const message = String(
        (locationError as { message?: string })?.message ?? locationError,
      ).toLowerCase()

      if (
        code === '1' ||
        code === 'OS-PLUG-GLOC-0003' ||
        message.includes('permission') ||
        message.includes('denied')
      ) {
        setError(t('location.errors.permission'))
      } else if (
        code === '3' ||
        code === 'OS-PLUG-GLOC-0010' ||
        message.includes('timeout')
      ) {
        setError(t('location.errors.timeout'))
      } else {
        setError(t('location.errors.unavailable'))
      }
    } finally {
      setIsLocating(false)
    }
  }

  return (
    <div className="mobile-page">
      <div className="page-header">
        <IconButton label={t('common.back')} onClick={onBack}>
          <ArrowLeft size={19} />
        </IconButton>

        <div>
          <strong>
            {location
              ? t('location.detected')
              : isLocating
                ? t('location.detecting')
                : t('location.request')}
          </strong>

          <small>{t('location.step2')}</small>
        </div>

        <LanguageSwitcher />
      </div>

      <main className="flow-content location-flow">
        <Steps active={1} />

        <section className="location-panel" aria-live="polite">
          <div
            className={`location-illustration ${isLocating ? 'is-locating' : ''}`}
          >
            <MapPin size={46} />
            <span className="pulse" />
          </div>

          <h1>
            {location
              ? t('location.detected')
              : isLocating
                ? t('location.detecting')
                : t('location.request')}
          </h1>

          <p className="muted-copy">{t('location.desc')}</p>

          {location ? (
            <div className="location-card">
              <div>
                <MapPin size={17} />

                <span>{t('location.detectedLabel')}</span>
              </div>

              <dl>
                <dt>{t('common.latitude')}</dt>

                <dd>{location.latitude.toFixed(4)}</dd>

                <dt>{t('common.longitude')}</dt>

                <dd>{location.longitude.toFixed(4)}</dd>

                <dt>{t('common.accuracy')}</dt>

                <dd>± {Math.round(location.accuracy)} m</dd>

                <dt>{t('common.captured')}</dt>

                <dd>
                  {location.capturedAt.toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </dd>
              </dl>
            </div>
          ) : error ? (
            <p className="camera-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="location-note">
              {typeof window !== 'undefined' && window.isSecureContext
                ? t('location.permissionPrompt')
                : t('location.errors.insecure')}
            </p>
          )}

          <button
            className="primary-button location-permission-button"
            onClick={detectLocation}
            disabled={isLocating}
          >
            <LocateFixed size={16} />

            {isLocating
              ? t('location.detecting')
              : location
                ? t('location.refresh')
                : t('location.allow')}
          </button>

          {location && (
            <p className="location-note">{t('location.note')}</p>
          )}
        </section>
      </main>

      <div className="sticky-action location-sticky-action">
        <button
          className="primary-button"
          disabled={isLocating}
          onClick={() => {
            onContinue(location)
          }}
        >
          {location
            ? t('common.continue')
            : t('location.continueWithout')}
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------
// ANALYSIS SCREEN
// --------------------------------------------------

function AnalysisScreen({
  file,
  onBack,
  onResult,
}: {
  file: File
  onBack: () => void
  onResult: (result: PredictionResult) => void
}) {
  const { t } = useTranslation()

  const [error, setError] = useState('')

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const analyzeImage = async () => {
      try {
        setLoading(true)
        setError('')

        const result = await predictComplaint(file)

        if (cancelled) {
          return
        }

        if (!result?.success) {
          throw new Error('Prediction was not successful.')
        }

        onResult(result as PredictionResult)
      } catch (err) {
        console.error(err)

        if (!cancelled) {
          setError(t('analysis.error'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    analyzeImage()

    return () => {
      cancelled = true
    }
  }, [file, onResult, t])

  return (
    <div className="mobile-page">
      <div className="page-header">
        <IconButton label={t('common.back')} onClick={onBack}>
          <ArrowLeft size={19} />
        </IconButton>

        <div>
          <strong>
            {loading
              ? t('analysis.inProgress')
              : t('analysis.completeTitle')}
          </strong>

          <small>{t('analysis.step3')}</small>
        </div>

        <LanguageSwitcher />
      </div>

      <main className="flow-content analysis-flow">
        <Steps active={2} />

        {loading ? (
          <>
            <div className="ai-orbit">
              <div className="ai-core">
                <Sparkles size={35} />
              </div>

              <i />
              <i />
              <i />
            </div>

            <h1>{t('analysis.analyzing')}</h1>

            <p className="muted-copy">{t('analysis.desc')}</p>

            <div className="progress-line">
              <span />
            </div>

            <div className="checklist">
              {[
                t('analysis.checklist.uploading'),
                t('analysis.checklist.running'),
                t('analysis.checklist.identifying'),
                t('analysis.checklist.preparing'),
              ].map((item, index) => (
                <div
                  key={item}
                  className={index < 2 ? 'checked' : ''}
                >
                  {index < 2 ? (
                    <Check size={13} />
                  ) : (
                    <span className="empty-dot" />
                  )}

                  <span>{item}</span>
                </div>
              ))}
            </div>
          </>
        ) : error ? (
          <>
            <h1>{t('analysis.failed')}</h1>

            <p className="camera-error">{error}</p>

            <button className="outline-button" onClick={onBack}>
              <ArrowLeft size={16} />
              {t('common.tryAgain')}
            </button>
          </>
        ) : (
          <>
            <div className="success-check">
              <Check size={37} />
            </div>

            <h1>{t('analysis.completeHeading')}</h1>

            <p className="muted-copy">
              {t('analysis.completeDesc')}
            </p>
          </>
        )}
      </main>
    </div>
  )
}

// --------------------------------------------------
// RESULT SCREEN
// --------------------------------------------------

function ResultScreen({
  file,
  result,
  onBack,
  onContinue,
}: {
  file: File
  result: PredictionResult
  onBack: () => void
  onContinue: () => void
}) {
  const { t } = useTranslation()

  const imageUrl = useObjectUrl(file)

  const isGarbage = result.issue.toLowerCase() === 'garbage'

  const IssueIcon = isGarbage ? Trash2 : Construction

  return (
    <div className="mobile-page">
      <div className="page-header">
        <IconButton label={t('common.back')} onClick={onBack}>
          <ArrowLeft size={19} />
        </IconButton>

        <div>
          <strong>{t('result.title')}</strong>

          <small>{t('result.subtitle')}</small>
        </div>

        <LanguageSwitcher />
      </div>

      <main className="flow-content result-flow">
        <Steps active={3} />

        <div className="photo-frame">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={t('result.review')}
            />
          )}

          <span className="bbox">
            {getIssueLabel(result.issue, t)}{' '}
            {formatConfidence(result.confidence)}
          </span>
        </div>

        <div className="result-card">
          <div className="result-title">
            <span className="issue-icon orange">
              <IssueIcon size={18} />
            </span>

            <div>
              <small>{t('result.detectedIssue')}</small>

              <strong>{getIssueLabel(result.issue, t)}</strong>
            </div>

            <span className="confidence">
              {formatConfidence(result.confidence)}
            </span>
          </div>

          <div className="result-grid">
            <div>
              <small>{t('common.severity')}</small>

              <strong className="danger-text">
                {getSeverityLabel(result.severity, t)}
              </strong>
            </div>

            <div>
              <small>{t('common.priority')}</small>

              <strong>
                {getPriorityLabel(result.priority, t)}
              </strong>
            </div>

            <div>
              <small>{t('common.department')}</small>

              <strong>
                {getDepartmentLabel(result.department, t)}
              </strong>
            </div>
          </div>
        </div>

        <p className="muted-copy">
          {t('common.reportId')}: <strong>{result.report_id}</strong>
        </p>
      </main>

      <div className="sticky-action">
        <button className="primary-button" onClick={onContinue}>
          {t('result.review')}
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------
// REVIEW SCREEN
// --------------------------------------------------

function ReviewScreen({
  file,
  result,
  location,
  onBack,
  onSubmitted,
}: {
  file: File
  result: PredictionResult
  location: ReportLocation | null
  onBack: () => void
  onSubmitted: (description: string) => Promise<void>
}) {
  const { t } = useTranslation()

  const imageUrl = useObjectUrl(file)

  const [description, setDescription] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')
  const submitLock = useRef(false)

  const isGarbage = result.issue.toLowerCase() === 'garbage'

  const IssueIcon = isGarbage ? Trash2 : Construction

  const handleSubmit = async () => {
    if (submitLock.current) return
    submitLock.current = true
    try {
      setSubmitting(true)
      setError('')

      await onSubmitted(description)
    } catch (err) {
      console.error(err)

      setError(t('review.error'))
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="mobile-page">
      <div className="page-header">
        <IconButton label={t('common.back')} onClick={onBack}>
          <ArrowLeft size={19} />
        </IconButton>

        <div>
          <strong>{t('review.title')}</strong>

          <small>{t('review.subtitle')}</small>
        </div>

        <LanguageSwitcher />
      </div>

      <main className="flow-content review-flow">
        {imageUrl && (
          <img
            className="review-image"
            src={imageUrl}
            alt={t('result.review')}
          />
        )}

        <div className="review-details">
          <InfoRow
            icon={IssueIcon}
            label={t('common.category')}
            value={getIssueLabel(result.issue, t)}
          />

          <InfoRow
            icon={Sparkles}
            label={t('common.aiAnalysis')}
            value={t('common.confidenceValue', {
              value: formatConfidence(result.confidence),
            })}
          />

          <InfoRow
            icon={ShieldCheck}
            label={t('common.severity')}
            value={getSeverityLabel(result.severity, t)}
            tone="danger"
          />

          <InfoRow
            icon={Navigation}
            label={t('common.priority')}
            value={getPriorityLabel(result.priority, t)}
          />

          <InfoRow
            icon={ClipboardList}
            label={t('common.department')}
            value={getDepartmentLabel(result.department, t)}
          />

          <InfoRow
            icon={MapPin}
            label={t('common.location')}
            value={
              location
                ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                : t('common.locationUnavailable')
            }
          />
        </div>

        {location && (
          <a
            className="location-map-link"
            href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={15} />
            {t('review.viewLocationOnMap')}
          </a>
        )}

        <label className="field-label">
          {t('review.additionalInfo')}{' '}
          <span>{t('common.optional')}</span>

          <textarea
            placeholder={t('review.placeholder')}
            maxLength={200}
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
          />
        </label>

        <div className="char-count">
          {description.length}/200
        </div>

        {error && (
          <p className="camera-error" role="alert">
            {error}
          </p>
        )}
      </main>

      <div className="sticky-action">
        <button
          className="primary-button"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            t('review.submitting')
          ) : (
            <>
              {t('review.submit')}
              <Send size={17} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------
// INFO ROW
// --------------------------------------------------

function DuplicateScreen({
  onHome,
  onView,
}: {
  onHome: () => void
  onView: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="mobile-page success-page">
      <main className="success-content">
        <div className="success-check"><Check size={37} /></div>
        <p className="eyebrow">{t('duplicate.eyebrow')}</p>
        <h1>{t('duplicate.title')}</h1>
        <p className="muted-copy">{t('duplicate.message')}</p>
        <button className="primary-button" onClick={onView}>
          {t('duplicate.view')}
          <ArrowRight size={17} />
        </button>
        <button className="outline-button" onClick={onHome}>
          {t('common.home')}
        </button>
      </main>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  tone = '',
}: {
  icon: any
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="info-row">
      <Icon size={16} />

      <span>
        <small>{label}</small>

        <strong className={tone}>{value}</strong>
      </span>
    </div>
  )
}

// --------------------------------------------------
// SUCCESS SCREEN
// --------------------------------------------------

function SuccessScreen({
  result,
  onHome,
  onTrack,
}: {
  result: PredictionResult
  onHome: () => void
  onTrack: () => void
}) {
  const { t } = useTranslation()

  const isGarbage = result.issue.toLowerCase() === 'garbage'

  const IssueIcon = isGarbage ? Trash2 : Construction

  return (
    <div className="mobile-page success-page">
      <main className="success-content">
        <div className="success-check">
          <Check size={37} />
        </div>

        <div className="confetti">✦　·　✧　·　✦</div>

        <p className="eyebrow">{t('success.eyebrow')}</p>

        <h1>{t('success.title')}</h1>

        <p className="muted-copy">{t('success.desc')}</p>

        <div className="success-card">
          <InfoRow
            icon={ClipboardList}
            label={t('common.complaintId')}
            value={result.report_id}
          />

          <InfoRow
            icon={IssueIcon}
            label={t('common.issue')}
            value={getIssueLabel(result.issue, t)}
          />

          <InfoRow
            icon={ShieldCheck}
            label={t('common.priority')}
            value={getPriorityLabel(result.priority, t)}
            tone="danger"
          />

          <InfoRow
            icon={Clock3}
            label={t('common.status')}
            value={getStatusLabel(result.status, t)}
          />
        </div>

        <button className="primary-button" onClick={onTrack}>
          {t('success.track')}
          <ArrowRight size={17} />
        </button>

        <button className="text-button" onClick={onHome}>
          {t('success.home')}
        </button>
      </main>
    </div>
  )
}

// --------------------------------------------------
// COMPLAINT CARD
// --------------------------------------------------

function ComplaintCard({
  complaint,
  onClick,
}: {
  complaint: (typeof complaints)[number]
  onClick?: () => void
}) {
  const { t } = useTranslation()

  const Icon = complaint.icon

  return (
    <button className="complaint-card" onClick={onClick}>
      <span className={`complaint-icon ${complaint.tone}`}>
        <Icon size={18} />
      </span>

      <span className="complaint-main">
        <strong>{complaint.id}</strong>

        <span>
          {getIssueLabel(complaint.issue, t)} <b>•</b>{' '}
          {complaint.date}
        </span>
      </span>

      <span className="complaint-meta">
        <StatusBadge status={complaint.status} />

        <PriorityBadge priority={complaint.priority} />
      </span>

      <ChevronDown className="chevron" size={17} />
    </button>
  )
}

// --------------------------------------------------
// BADGES
// --------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()

  return (
    <span
      className={`badge status-${status
        .toLowerCase()
        .replaceAll(' ', '-')}`}
    >
      {getStatusLabel(status, t)}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation()

  const key = priority
    .toLowerCase()
    .replace(/\s*priority\s*$/, '')
    .trim()

  return (
    <span className={`badge priority-${key}`}>
      {getPriorityLabel(priority, t)}
    </span>
  )
}

// --------------------------------------------------
// MY COMPLAINTS SCREEN
// --------------------------------------------------

function ComplaintsScreen({
  onDetail,
  onHome,
  onReport,
  onProfile,
}: {
  onDetail: (reportId: string) => void
  onHome: () => void
  onReport: () => void
  onProfile: () => void
}) {
  const { t, i18n } = useTranslation()

  const [reports, setReports] = useState<any[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [tab, setTab] = useState<'all' | 'pending' | 'progress' | 'resolved'>(
    'all',
  )

  useEffect(() => {
    let cancelled = false

    const loadReports = async () => {
      try {
        setLoading(true)
        setError('')

        const result = await getReports()

        if (!result?.success) {
          throw new Error('Failed to load reports')
        }

        if (!cancelled) {
          setReports(result.reports ?? [])
        }
      } catch (err) {
        console.error(err)

        if (!cancelled) {
          setError(t('complaints.error'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadReports()

    return () => {
      cancelled = true
    }
  }, [t])

  const tabs: {
    key: 'all' | 'pending' | 'progress' | 'resolved'
    label: string
  }[] = [
    { key: 'all', label: t('complaints.tabs.all') },
    { key: 'pending', label: t('complaints.tabs.pending') },
    { key: 'progress', label: t('complaints.tabs.inProgress') },
    { key: 'resolved', label: t('complaints.tabs.resolved') },
  ]

  const visibleReports = reports.filter((report) => {
    if (tab === 'all') {
      return true
    }

    if (tab === 'pending') {
      return ['Submitted', 'Under Review', 'Assigned'].includes(
        report.status,
      )
    }

    if (tab === 'progress') {
      return report.status === 'In Progress'
    }

    return ['Resolved', 'Closed'].includes(report.status)
  })

  return (
    <div className="citizen-shell">
      <CitizenHeader onProfile={onProfile} />

      <main className="citizen-content">
        <div className="page-title">
          <p className="eyebrow">{t('complaints.eyebrow')}</p>

          <h1>{t('complaints.title')}</h1>

          <p className="muted-copy">{t('complaints.desc')}</p>
        </div>

        <div className="tabs">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="table-card">
            <p className="muted-copy">{t('complaints.loading')}</p>
          </div>
        ) : error ? (
          <div className="table-card">
            <p className="camera-error" role="alert">
              {error}
            </p>
          </div>
        ) : visibleReports.length === 0 ? (
          <div className="table-card">
            <p className="muted-copy">{t('complaints.empty')}</p>
          </div>
        ) : (
          <div className="complaints-list">
            {visibleReports.map((report) => {
              const issueKey = marchOrGarbage(
                String(report.issue ?? '').toLowerCase(),
              )

              const Icon =
                issueKey === 'garbage' ? Trash2 : Construction

              const tone =
                issueKey === 'garbage' ? 'green' : 'orange'

              const date = report.created_at
                ? new Date(report.created_at).toLocaleDateString(
                    getDateLocale(i18n.language),
                    {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    },
                  )
                : t('common.dateUnavailable')

              return (
                <button
                  className="complaint-card"
                  key={report.report_id}
                  onClick={() => onDetail(report.report_id)}
                >
                  <span className={`complaint-icon ${tone}`}>
                    <Icon size={18} />
                  </span>

                  <span className="complaint-main">
                    <strong>{report.report_id}</strong>

                    <span>
                      {getIssueLabel(report.issue, t)} <b>•</b>{' '}
                      {date}
                    </span>
                  </span>

                  <span className="complaint-meta">
                    <StatusBadge
                      status={report.status ?? 'Submitted'}
                    />

                    <PriorityBadge
                      priority={String(
                        report.priority ?? 'low',
                      )}
                    />
                  </span>

                  <ChevronDown className="chevron" size={17} />
                </button>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav
        active="myComplaints"
        onNavigate={(value) => {
          if (value === 'home') {
            onHome()
          }

          if (value === 'profile') {
            onProfile()
          }
        }}
      />
    </div>
  )
}

// --------------------------------------------------
// NOTIFICATIONS
// --------------------------------------------------

function NotificationsScreen({
  onBack,
  onOpen,
}: {
  onBack: () => void
  onOpen: (reportId: string) => void
}) {
  const { t, i18n } = useTranslation()

  const [reports, setReports] = useState<any[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadNotifications = async () => {
      try {
        setLoading(true)
        setError('')

        const result = await getReports()

        if (!result?.success) {
          throw new Error('Failed to load notifications')
        }

        if (!cancelled) {
          setReports(result.reports ?? [])
        }
      } catch (err) {
        console.error(err)

        if (!cancelled) {
          setError(t('complaints.error'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadNotifications()

    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div className="citizen-shell">
      <div className="page-header">
        <IconButton label={t('common.back')} onClick={onBack}>
          <ArrowLeft size={19} />
        </IconButton>

        <div>
          <strong>{t('notifications.title')}</strong>

          <small>{t('notifications.subtitle')}</small>
        </div>

        <LanguageSwitcher />
      </div>

      <main className="citizen-content utility-page">
        {loading ? (
          <div className="notification-card">
            <span className="notification-icon">
              <Clock3 size={18} />
            </span>

            <div>
              <strong>{t('notifications.loading')}</strong>

              <small>{t('notifications.loadingDesc')}</small>
            </div>
          </div>
        ) : error ? (
          <div className="notification-card">
            <span className="notification-icon">
              <Bell size={18} />
            </span>

            <div>
              <strong>{t('notifications.unavailable')}</strong>

              <small>{error}</small>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="notification-card">
            <span className="notification-icon">
              <ClipboardList size={18} />
            </span>

            <div>
              <strong>{t('notifications.empty')}</strong>

              <small>{t('notifications.emptyDesc')}</small>
            </div>
          </div>
        ) : (
          reports.slice(0, 5).map((report) => {
            const status = report.status ?? 'Submitted'

            const date = report.created_at
              ? new Date(report.created_at).toLocaleString(
                  getDateLocale(i18n.language),
                  {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  },
                )
              : t('common.recently')

            return (
              <button
                className="notification-card unread"
                key={report.report_id}
                onClick={() => onOpen(report.report_id)}
              >
                <span className="notification-icon">
                  {status === 'Resolved' || status === 'Closed' ? (
                    <Check size={18} />
                  ) : (
                    <Clock3 size={18} />
                  )}
                </span>

                <span>
                  <strong>
                    {t('notifications.complaintStatus', {
                      issue: getIssueLabel(report.issue, t),
                      status: getStatusLabel(status, t),
                    })}
                  </strong>

                  <small>
                    {report.report_id} ·{' '}
                    {getDepartmentLabel(report.department, t)}
                  </small>

                  <time>{date}</time>
                </span>
              </button>
            )
          })
        )}
      </main>
    </div>
  )
}

// --------------------------------------------------
// PROFILE
// --------------------------------------------------

function ProfileScreen({
  onBack,
  onRole,
}: {
  onBack: () => void
  onRole: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="citizen-shell">
      <div className="page-header">
        <IconButton label={t('common.back')} onClick={onBack}>
          <ArrowLeft size={19} />
        </IconButton>

        <div>
          <strong>{t('profile.title')}</strong>

          <small>{t('profile.subtitle')}</small>
        </div>

        <LanguageSwitcher />
      </div>

      <main className="citizen-content utility-page">
        <div className="profile-hero">
          <div className="avatar large">
            <UserRound size={28} />
          </div>

          <div>
            <h1>{t('profile.name')}</h1>

            <p>{t('profile.role')}</p>
          </div>
        </div>

        <div className="profile-list">
          <button>
            <UserRound size={18} />
            {t('profile.accountDetails')}
            <ChevronDown size={16} />
          </button>

          <button>
            <Bell size={18} />
            {t('profile.notificationPreferences')}
            <ChevronDown size={16} />
          </button>

          <button onClick={onRole}>
            <ShieldCheck size={18} />
            {t('profile.switchWorkspace')}
            <ChevronDown size={16} />
          </button>
        </div>
      </main>
    </div>
  )
}

// --------------------------------------------------
// DETAIL SCREEN
// --------------------------------------------------

function DetailScreen({
  reportId,
  onBack,
}: {
  reportId: string | null
  onBack: () => void
}) {
  const { t, i18n } = useTranslation()

  const [result, setResult] =
    useState<PredictionResult | null>(null)

  const [location, setLocation] = useState<{
    latitude: number | null
    longitude: number | null
  }>({
    latitude: null,
    longitude: null,
  })

  const [description, setDescription] = useState('')

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadComplaint = async () => {
      if (!reportId) {
        setLoading(false)
        setError(t('detail.noSelection'))
        return
      }

      try {
        setLoading(true)
        setError('')

        const payload = await getReport(reportId)

        const report = payload?.report ?? payload

        if (!report?.report_id) {
          throw new Error('Complaint was not found.')
        }

        if (cancelled) {
          return
        }

        setResult(reportToPredictionResult(report))

        setLocation({
          latitude: report.latitude ?? null,
          longitude: report.longitude ?? null,
        })

        setDescription(
          report.description ?? t('common.noDescription'),
        )
      } catch (err) {
        console.error(err)

        if (!cancelled) {
          setError(t('detail.loadError'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadComplaint()

    return () => {
      cancelled = true
    }
  }, [reportId, t])

  if (loading) {
    return (
      <div className="mobile-page">
        <main className="flow-content">
          <p className="eyebrow">{t('complaints.eyebrow')}</p>

          <h1>{t('detail.loading')}</h1>

          <p className="muted-copy">{t('detail.loadingDesc')}</p>
        </main>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="mobile-page">
        <main className="flow-content">
          <p className="camera-error" role="alert">
            {error || t('detail.notAvailable')}
          </p>

          <button className="outline-button" onClick={onBack}>
            <ArrowLeft size={16} />
            {t('common.backToComplaints')}
          </button>
        </main>
      </div>
    )
  }

  const isGarbage = result.issue.toLowerCase() === 'garbage'

  const IssueIcon = isGarbage ? Trash2 : Construction

  const imageUrl = result.image_path
    ? getUploadUrl(result.image_path)
    : ''

  const currentIndex = statusOrder.indexOf(
    result.status as (typeof statusOrder)[number],
  )

  return (
    <div className="mobile-page">
      <div className="page-header">
        <IconButton label={t('common.back')} onClick={onBack}>
          <ArrowLeft size={19} />
        </IconButton>

        <div>
          <strong>{t('detail.title')}</strong>

          <small>{result.report_id}</small>
        </div>

        <LanguageSwitcher />
      </div>

      <main className="flow-content detail-flow">
        {imageUrl ? (
          <img
            className="detail-image"
            src={imageUrl}
            alt={t('result.review')}
          />
        ) : null}

        <div className="detail-title">
          <div>
            <p className="eyebrow">{result.report_id}</p>

            <h1>{getIssueLabel(result.issue, t)}</h1>
          </div>

          <PriorityBadge priority={result.priority} />
        </div>

        <div className="detail-grid">
          <InfoRow
            icon={IssueIcon}
            label={t('common.issue')}
            value={getIssueLabel(result.issue, t)}
          />

          <InfoRow
            icon={Sparkles}
            label={t('common.confidence')}
            value={formatConfidence(result.confidence)}
          />

          <InfoRow
            icon={ShieldCheck}
            label={t('common.severity')}
            value={getSeverityLabel(result.severity, t)}
            tone="danger"
          />

          <InfoRow
            icon={ClipboardList}
            label={t('common.department')}
            value={getDepartmentLabel(result.department, t)}
          />

          <InfoRow
            icon={Clock3}
            label={t('common.status')}
            value={getStatusLabel(result.status, t)}
          />

          <InfoRow
            icon={MapPin}
            label={t('common.location')}
            value={
              location.latitude !== null &&
              location.longitude !== null
                ? `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`
                : t('common.locationUnavailable')
            }
          />
        </div>

        <div className="description">
          <small>{t('detail.citizenDescription')}</small>

          <p>{description}</p>
        </div>

        <h3>{t('detail.statusTimeline')}</h3>

        <div className="timeline">
          {statusOrder.map((status, index) => (
            <div
              className={`timeline-item ${
                index === currentIndex
                  ? 'current'
                  : index < currentIndex
                    ? 'complete'
                    : ''
              }`}
              key={status}
            >
              <span>
                {index <= currentIndex ? <Check size={12} /> : ''}
              </span>

              <div>
                <strong>{getStatusLabel(status, t)}</strong>

                {index === 0 && (
                  <small>
                    {t('detail.submittedAt', {
                      date: new Date(
                        result.created_at,
                      ).toLocaleString(getDateLocale(i18n.language)),
                    })}
                  </small>
                )}

                {index === currentIndex && index !== 0 && (
                  <small>{t('detail.currentStatus')}</small>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="status-note">
          <ShieldCheck size={14} />
          {t('detail.statusNote')}
        </p>
      </main>

      <div className="sticky-action">
        <button className="outline-button" onClick={onBack}>
          <ArrowLeft size={16} />
          {t('common.backToComplaints')}
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------
// MUNICIPAL DASHBOARD (legacy embedded dashboard)
// --------------------------------------------------

function MunicipalDashboard({
  onOpen,
  onDashboard,
  onAnalytics,
  onProfile,
}: {
  onOpen: () => void
  onDashboard: () => void
  onAnalytics: () => void
  onProfile: () => void
}) {
  const { t } = useTranslation()

  const navItems: {
    key: string
    label: string
    icon: any
    onClick: () => void
  }[] = [
    {
      key: 'dashboard',
      label: t('common.dashboard'),
      icon: LayoutDashboard,
      onClick: onDashboard,
    },
    {
      key: 'complaints',
      label: t('common.myComplaints'),
      icon: ClipboardList,
      onClick: onOpen,
    },
    {
      key: 'analytics',
      label: t('admin.civicAnalytics'),
      icon: SlidersHorizontal,
      onClick: onAnalytics,
    },
    {
      key: 'profile',
      label: t('common.profile'),
      icon: UserRound,
      onClick: onProfile,
    },
  ]

  const stats: {
    label: string
    value: string
    note: string
    icon: any
    tone: string
  }[] = [
    {
      label: t('admin.totalComplaints'),
      value: '124',
      note: t('admin.allReports'),
      icon: LayoutDashboard,
      tone: 'navy',
    },
    {
      label: t('admin.pending'),
      value: '18',
      note: t('admin.needsReview'),
      icon: Clock3,
      tone: 'orange',
    },
    {
      label: t('admin.inProgress'),
      value: '9',
      note: t('admin.beingResolved'),
      icon: SlidersHorizontal,
      tone: 'blue',
    },
    {
      label: t('admin.resolved'),
      value: '97',
      note: t('admin.closedSuccessfully'),
      icon: Check,
      tone: 'green',
    },
  ]

  const headers = [
    t('common.complaintId'),
    t('common.issue'),
    t('common.location'),
    t('common.priority'),
    t('common.department'),
    t('common.status'),
    t('common.date'),
    t('common.action'),
  ]

  return (
    <div className="municipal-shell">
      <aside className="sidebar">
        <Logo compact />

        <div className="sidebar-label">
          {t('common.workspace')}
        </div>

        <LanguageSwitcher className="sidebar-lang" />

        {navItems.map((item, index) => (
          <button
            key={item.key}
            className={index === 0 ? 'active' : ''}
            onClick={item.onClick}
          >
            <item.icon size={18} />

            <span>{item.label}</span>
          </button>
        ))}
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">{t('admin.portalEyebrow')}</p>

            <h1>{t('common.dashboard')}</h1>

            <p>{t('common.municipalityName')}</p>
          </div>

          <div className="dashboard-actions">
            <LanguageSwitcher />

            <button
              className="outline-button"
              onClick={() => undefined}
            >
              <Bell size={21} />
              {t('common.notifications')}
            </button>

            <button className="avatar" onClick={onProfile}>
              MO
            </button>
          </div>
        </header>

        <section className="stats-grid">
          {stats.map((stat) => (
            <div
              className={`stat-card ${stat.tone}`}
              key={stat.label}
            >
              <div className="stat-top">
                <span>{stat.label}</span>

                <stat.icon size={17} />
              </div>

              <strong>{stat.value}</strong>

              <small>{stat.note}</small>
            </div>
          ))}
        </section>

        <div className="filter-bar">
          <button className="filter-select">
            {t('common.issue')}
            <ChevronDown size={15} />
          </button>

          <button className="filter-select">
            {t('common.status')}
            <ChevronDown size={15} />
          </button>

          <button className="filter-select">
            {t('common.priority')}
            <ChevronDown size={15} />
          </button>

          <button className="filter-select">
            {t('common.department')}
            <ChevronDown size={15} />
          </button>

          <label className="search-field">
            <Search size={16} />

            <input placeholder={t('admin.searchPlaceholder')} />
          </label>
        </div>

        <div className="table-card">
          <div className="officer-welcome">
            <h2>{t('admin.allComplaints')}</h2>

            <div className="filter-bar">
              <button className="outline-button">
                <Upload size={15} />
                {t('common.viewDetails')}
              </button>
            </div>
          </div>

          <div className="complaint-table">
            <div className="table-row table-head">
              {headers.map((header) => (
                <span key={header}>{header}</span>
              ))}
            </div>

            {complaints.map((complaint) => {
              const Icon = complaint.icon

              return (
                <div className="table-row" key={complaint.id}>
                  <span className="id-cell">{complaint.id}</span>

                  <span className="issue-cell">
                    <span
                      className={`mini-icon ${complaint.tone}`}
                    >
                      <Icon size={14} />
                    </span>

                    {getIssueLabel(complaint.issue, t)}
                  </span>

                  <span>{complaint.location}</span>

                  <span>
                    <PriorityBadge
                      priority={complaint.priority}
                    />
                  </span>

                  <span>
                    {getDepartmentLabel(
                      complaint.issue === 'Pothole'
                        ? 'road_maintenance'
                        : complaint.issue === 'Water Leakage'
                          ? 'water_supply'
                          : 'sanitation',
                      t,
                    )}
                  </span>

                  <span>
                    <StatusBadge status={complaint.status} />
                  </span>

                  <span>
                    {complaint.date.replace(' 2026', '')}
                  </span>

                  <button
                    className="view-button"
                    onClick={onOpen}
                  >
                    {t('common.view')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <nav className="officer-mobile-nav">
          <button className="active" onClick={onDashboard}>
            <LayoutDashboard size={18} />
            <span>{t('common.dashboard')}</span>
          </button>

          <button onClick={onOpen}>
            <ClipboardList size={18} />
            <span>{t('common.myComplaints')}</span>
          </button>

          <button onClick={onAnalytics}>
            <SlidersHorizontal size={18} />
            <span>{t('admin.civicAnalytics')}</span>
          </button>

          <button onClick={onProfile}>
            <UserRound size={18} />
            <span>{t('common.profile')}</span>
          </button>
        </nav>
      </main>
    </div>
  )
}

// --------------------------------------------------
// MUNICIPAL DETAIL (legacy)
// --------------------------------------------------

function MunicipalDetail({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()

  const [status, setStatus] = useState('Submitted')

  return (
    <div className="municipal-shell">
      <aside className="sidebar">
        <Logo compact />

        <div className="sidebar-label">
          {t('common.workspace')}
        </div>

        {[
          [t('common.dashboard'), LayoutDashboard],
          [t('common.myComplaints'), ClipboardList],
          [t('admin.civicAnalytics'), SlidersHorizontal],
          [t('common.profile'), UserRound],
        ].map(([label, Icon], index) => (
          <button
            className={index === 1 ? 'active' : ''}
            key={label as string}
          >
            <Icon size={18} />

            <span>{label as string}</span>
          </button>
        ))}
      </aside>

      <main className="dashboard-main">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={16} />
          {t('admin.backToComplaints')}
        </button>

        <div className="dashboard-header">
          <div>
            <p className="eyebrow">
              {t('admin.complaintReview')}
            </p>

            <h1>CV-2026-00124</h1>

            <p>{t('detail.title')}</p>
          </div>

          <StatusBadge status={status} />
        </div>

        <div className="municipal-detail-grid">
          <section className="table-card detail-panel">
            <img
              className="admin-image"
              src="/pothole.png"
              alt={t('result.review')}
            />

            <div className="ai-detection">
              <Sparkles size={16} />

              <span>
                {t('common.aiDetection')}:{' '}
                <strong>{getIssueLabel('pothole', t)}</strong>
              </span>
            </div>
          </section>

          <section className="table-card detail-panel">
            <h2>{t('admin.issueCategory')}</h2>

            <InfoRow
              icon={Construction}
              label={t('common.issue')}
              value={getIssueLabel('pothole', t)}
            />

            <InfoRow
              icon={Sparkles}
              label={t('common.aiAnalysis')}
              value={t('admin.aiDetection')}
            />

            <InfoRow
              icon={ShieldCheck}
              label={t('common.severity')}
              value={t('location.detected')}
              tone="danger"
            />

            <InfoRow
              icon={Navigation}
              label={t('common.priority')}
              value={t('admin.needsReview')}
            />

            <InfoRow
              icon={ClipboardList}
              label={t('common.department')}
              value={t('common.category')}
            />

            <InfoRow
              icon={MapPin}
              label={t('common.location')}
              value="Sangli"
            />
          </section>
        </div>
      </main>
    </div>
  )
}

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function Page() {
  const { user, login } = useAuth()
  const [screen, setScreen] = useState('role')

  const [reportFile, setReportFile] = useState<File | null>(null)

  const [reportLocation, setReportLocation] =
    useState<ReportLocation | null>(null)

  const [reportResult, setReportResult] =
    useState<PredictionResult | null>(null)

  const [selectedReportId, setSelectedReportId] =
    useState<string | null>(null)
  const [duplicateReportId, setDuplicateReportId] =
    useState<string | null>(null)

  const go = (next: string) => setScreen(next)

  const handleComplaintSubmit = async (
    description: string,
  ) => {
    if (!reportResult) {
      throw new Error('No prediction result available.')
    }

    const response = await submitComplaint(
      reportResult.report_id,
      reportLocation?.latitude ?? null,
      reportLocation?.longitude ?? null,
      description,
    )

    if (response?.duplicate) {
      setDuplicateReportId(response.report?.report_id ?? reportResult.report_id)
      go('duplicate')
      return
    }

    go('success')
  }

  // ------------------------------------------------
  // ROLE
  // ------------------------------------------------

  if (screen === 'role') {
    return (
      <RoleSelection
        onCitizen={() => go('citizen-login')}
        onOfficer={() => go('officer-login')}
      />
    )
  }

  // ------------------------------------------------
  // HOME
  // ------------------------------------------------

  if (screen === 'home') {
    return (
      <HomeScreen
        onReport={() => go('report')}
        onComplaints={() => go('complaints')}
        onNotifications={() => go('notifications')}
        onProfile={() => go('profile')}
        onRecentComplaint={(reportId) => {
          setSelectedReportId(reportId)
          go('detail')
        }}
      />
    )
  }

  // ------------------------------------------------
  // REPORT / PHOTO
  // ------------------------------------------------

  if (screen === 'report') {
    return (
      <ReportScreen
        onHome={() => go('home')}
        onContinue={(file) => {
          setReportFile(file)
          setReportLocation(null)
          setReportResult(null)
          go('location')
        }}
      />
    )
  }

  // ------------------------------------------------
  // LOCATION
  // ------------------------------------------------

  if (screen === 'location') {
    return (
      <LocationScreen
        onBack={() => go('report')}
        onContinue={(location) => {
          setReportLocation(location)
          go('analysis')
        }}
      />
    )
  }

  // ------------------------------------------------
  // AI ANALYSIS
  // ------------------------------------------------

  if (screen === 'analysis' && reportFile) {
    return (
      <AnalysisScreen
        file={reportFile}
        onBack={() => go('location')}
        onResult={(result) => {
          setReportResult(result)
          if (result.duplicate) {
            setDuplicateReportId(result.report_id)
            go('duplicate')
          } else {
            go('result')
          }
        }}
      />
    )
  }

  if (screen === 'duplicate' && duplicateReportId) {
    return (
      <DuplicateScreen
        onHome={() => go('home')}
        onView={() => {
          setSelectedReportId(duplicateReportId)
          go('detail')
        }}
      />
    )
  }

  // ------------------------------------------------
  // RESULT
  // ------------------------------------------------

  if (screen === 'result' && reportFile && reportResult) {
    return (
      <ResultScreen
        file={reportFile}
        result={reportResult}
        onBack={() => go('report')}
        onContinue={() => go('review')}
      />
    )
  }

  // ------------------------------------------------
  // REVIEW
  // ------------------------------------------------

  if (screen === 'review' && reportFile && reportResult) {
    return (
      <ReviewScreen
        file={reportFile}
        result={reportResult}
        location={reportLocation}
        onBack={() => go('result')}
        onSubmitted={handleComplaintSubmit}
      />
    )
  }

  // ------------------------------------------------
  // SUCCESS
  // ------------------------------------------------

  if (screen === 'success' && reportResult) {
    return (
      <SuccessScreen
        result={reportResult}
        onHome={() => go('home')}
        onTrack={() => {
          setSelectedReportId(reportResult.report_id)
          go('detail')
        }}
      />
    )
  }

  // ------------------------------------------------
  // MY COMPLAINTS
  // ------------------------------------------------

  if (screen === 'complaints') {
    return (
      <ComplaintsScreen
        onDetail={(reportId) => {
          setSelectedReportId(reportId)
          go('detail')
        }}
        onHome={() => go('home')}
        onReport={() => go('report')}
        onProfile={() => go('profile')}
      />
    )
  }

  // ------------------------------------------------
  // DETAIL
  // ------------------------------------------------

  if (screen === 'detail') {
    return (
      <DetailScreen
        reportId={selectedReportId}
        onBack={() => go('complaints')}
      />
    )
  }

  // ------------------------------------------------
  // NOTIFICATIONS
  // ------------------------------------------------

  if (screen === 'notifications') {
    return (
      <NotificationsScreen
        onBack={() => go('home')}
        onOpen={(reportId) => {
          setSelectedReportId(reportId)
          go('detail')
        }}
      />
    )
  }

  // ------------------------------------------------
  // PROFILE
  // ------------------------------------------------

  if (screen === 'profile') {
    return (
      <ProfileScreen
        onBack={() => go('home')}
        onRole={() => go('role')}
      />
    )
  }

  // ------------------------------------------------
  // CITIZEN LOGIN
  // ------------------------------------------------

  if (screen === 'citizen-login') {
    return (
      <CitizenLoginScreen
        onBack={() => go('role')}
        onSuccess={() => go('home')}
        onSwitchToRegister={() => go('citizen-register')}
      />
    )
  }

  // ------------------------------------------------
  // CITIZEN REGISTER
  // ------------------------------------------------

  if (screen === 'citizen-register') {
    return (
      <CitizenRegisterScreen
        onBack={() => go('citizen-login')}
        onSuccess={() => go('home')}
        onSwitchToLogin={() => go('citizen-login')}
      />
    )
  }

  // ------------------------------------------------
  // OFFICER LOGIN
  // ------------------------------------------------

  if (screen === 'officer-login') {
    return (
      <OfficerLoginScreen
        onBack={() => go('role')}
        onSuccess={() => go('municipal')}
      />
    )
  }

  // ------------------------------------------------
  // MUNICIPAL PORTAL
  // ------------------------------------------------

  if (screen === 'municipal') {
    return (
      <MunicipalPortal onExit={() => go('role')} />
    )
  }

  return (
    <RoleSelection
      onCitizen={() => go('citizen-login')}
      onOfficer={() => go('officer-login')}
    />
  )
}

export { MunicipalDashboard, MunicipalDetail }

type Demo = never
