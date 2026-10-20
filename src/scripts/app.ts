type ProgramItem = {
  id: string
  title: string
  stage: string
  start: string
  end: string
  language: string
  type: string
  href: string
  mainPartners: string[]
  customerPriority: string
}

type Photographer = {
  id: string
  name: string
  phone: string
  role: string
  from: string
  to: string
  color: string
}

type CaptureTiming = 'start' | 'end' | 'whole'

type Assignment = {
  photographerId: string
  timing: CaptureTiming
}

type PlannerState = {
  photographers: Photographer[]
  assignments: Record<string, Assignment>
}

const STORAGE_KEY = 'frameops-mvp-v1'
const FILTER_STORAGE_KEY = 'frameops-filters-v1'
const STATE_ENDPOINT = '/api/state'
const COVERAGE_MINUTES = 15
const program = JSON.parse(document.querySelector<HTMLScriptElement>('#program-data')?.textContent || '[]') as ProgramItem[]
const sessionsById = new Map(program.map((session) => [session.id, session]))

let state: PlannerState = loadCachedState()
const savedFilters = loadFilterState()
let activeStage = savedFilters.activeStage
let activeCoverage = savedFilters.activeCoverage
let activeProgramType = savedFilters.activeProgramType
let activePhotographer = savedFilters.activePhotographer
let searchTerm = savedFilters.searchTerm
let overviewPhotographerId = ''
const pendingTiming = new Map<string, CaptureTiming>()
let lastRemoteUpdatedAt = ''
let lastRemoteRevision = 0
let saveTimer: number | undefined
let saving = false
let dirty = false
let localRevision = 0
let canEdit = false

const teamList = document.querySelector<HTMLElement>('#team-list')
const teamEmpty = document.querySelector<HTMLElement>('#team-empty')
const form = document.querySelector<HTMLFormElement>('#photographer-form')
const photographerDialog = document.querySelector<HTMLDialogElement>('#photographer-dialog')

function loadFilterState() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(FILTER_STORAGE_KEY) || '{}') as Record<string, unknown>
    const savedStage = typeof parsed.activeStage === 'string' ? parsed.activeStage : 'Alle'
    const validStages = new Set(['Alle', ...program.map((session) => session.stage)])
    return {
      activeStage: validStages.has(savedStage) ? savedStage : 'Alle',
      activeCoverage: parsed.activeCoverage === 'unassigned' || parsed.activeCoverage === 'conflict' ? parsed.activeCoverage : 'all',
      activeProgramType: parsed.activeProgramType === 'main' || parsed.activeProgramType === 'priority' ? parsed.activeProgramType : 'all',
      activePhotographer: typeof parsed.activePhotographer === 'string' ? parsed.activePhotographer : 'all',
      searchTerm: typeof parsed.searchTerm === 'string' ? parsed.searchTerm.slice(0, 160) : '',
    }
  } catch {
    return { activeStage: 'Alle', activeCoverage: 'all', activeProgramType: 'all', activePhotographer: 'all', searchTerm: '' }
  }
}

function cacheFilterState() {
  sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
    activeStage,
    activeCoverage,
    activeProgramType,
    activePhotographer,
    searchTerm,
  }))
}

function syncFilterControls() {
  document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((button) => {
    const active = button.dataset.stage === activeStage
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  })
  document.querySelectorAll<HTMLButtonElement>('[data-coverage]').forEach((button) => {
    const active = button.dataset.coverage === activeCoverage
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  })
  document.querySelectorAll<HTMLButtonElement>('[data-program-filter]').forEach((button) => {
    const active = button.dataset.programFilter === activeProgramType
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  })
  document.querySelectorAll<HTMLButtonElement>('[data-photographer-filter]').forEach((button) => {
    const active = button.dataset.photographerFilter === activePhotographer
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  })
  const search = document.querySelector<HTMLInputElement>('#program-search')
  if (search && search.value !== searchTerm) search.value = searchTerm
}

function loadCachedState(): PlannerState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { photographers: [], assignments: {} }
    const parsed = JSON.parse(stored) as { photographers?: unknown; assignments?: Record<string, unknown> }
    const assignments = Object.fromEntries(
      Object.entries(parsed.assignments || {}).flatMap(([sessionId, value]) => {
        if (typeof value === 'string') {
          return [[sessionId, { photographerId: value, timing: 'start' as CaptureTiming }]]
        }
        if (value && typeof value === 'object' && 'photographerId' in value) {
          const saved = value as { photographerId?: unknown; timing?: unknown }
          if (typeof saved.photographerId === 'string') {
            return [[sessionId, {
              photographerId: saved.photographerId,
              timing: saved.timing === 'end' || saved.timing === 'whole'
                ? saved.timing as CaptureTiming
                : 'start' as CaptureTiming,
            }]]
          }
        }
        return []
      }),
    )
    return {
      photographers: Array.isArray(parsed.photographers) ? parsed.photographers : [],
      assignments,
    }
  } catch {
    return { photographers: [], assignments: {} }
  }
}

function cacheState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function setSyncStatus(mode: 'loading' | 'saving' | 'synced' | 'offline', label: string) {
  const element = document.querySelector<HTMLElement>('#sync-status')
  if (!element) return
  element.className = `sync-badge sync-badge--${mode}`
  element.innerHTML = `<i></i> ${escapeHtml(label)}`
}

function hasPlannerData(value: PlannerState) {
  return value.photographers.length > 0 || Object.keys(value.assignments).length > 0
}

async function loadRemoteState(showUpdateToast = false) {
  if (dirty || saving) return
  try {
    const response = await fetch(STATE_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!response.ok) throw new Error(`State request failed: ${response.status}`)
    const payload = await response.json() as { exists: boolean; state: PlannerState; revision: number; updatedAt: string | null; canEdit: boolean }
    canEdit = payload.canEdit
    lastRemoteRevision = payload.revision || lastRemoteRevision
    applyAccessMode()
    if (!payload.exists) {
      if (canEdit && hasPlannerData(state)) {
        dirty = true
        await persistState()
      } else {
        setSyncStatus('synced', canEdit ? 'Synkronisert' : 'Kun visning')
      }
      return
    }

    // Preserve a plan created in the earlier browser-only version. An empty
    // central row may already exist from another device, but it must never
    // erase a non-empty local plan during the first migration.
    if (canEdit && !lastRemoteUpdatedAt && hasPlannerData(state) && !hasPlannerData(payload.state)) {
      dirty = true
      await persistState()
      return
    }

    if (payload.updatedAt && payload.updatedAt !== lastRemoteUpdatedAt) {
      const changedAfterInitialLoad = Boolean(lastRemoteUpdatedAt)
      state = payload.state
      lastRemoteUpdatedAt = payload.updatedAt
      cacheState()
      render()
      if (showUpdateToast && changedAfterInitialLoad) toast('Planen er oppdatert', 'Nyeste endringer fra en annen enhet er lastet inn.', 'success')
    }
    setSyncStatus('synced', canEdit ? 'Synkronisert' : 'Kun visning')
  } catch (error) {
    console.error(error)
    setSyncStatus('offline', 'Ikke synkronisert')
  }
}

function queueSave() {
  if (!canEdit) return
  dirty = true
  localRevision += 1
  cacheState()
  setSyncStatus('saving', 'Lagrer…')
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => { void persistState() }, 250)
}

async function persistState() {
  if (saving || !dirty) return
  saving = true
  const savingRevision = localRevision
  try {
    const response = await fetch(STATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ state }),
    })
    if (!response.ok) throw new Error(`State save failed: ${response.status}`)
    const payload = await response.json() as { revision: number; updatedAt: string | null }
    lastRemoteRevision = payload.revision || lastRemoteRevision
    lastRemoteUpdatedAt = payload.updatedAt || lastRemoteUpdatedAt
    dirty = localRevision !== savingRevision
    if (dirty) {
      setSyncStatus('saving', 'Lagrer…')
    } else {
      setSyncStatus('synced', 'Synkronisert')
    }
  } catch (error) {
    console.error(error)
    setSyncStatus('offline', 'Ikke synkronisert')
    window.setTimeout(() => { void persistState() }, 5000)
  } finally {
    saving = false
    if (dirty) void persistState()
  }
}

function minutes(value: string, end = false): number {
  const [hours, mins] = value.split(':').map(Number)
  const total = hours * 60 + mins
  return end && total < 5 * 60 ? total + 24 * 60 : total
}

type TimeWindow = { start: number; end: number }

function sessionBounds(session: ProgramItem): TimeWindow {
  const start = minutes(session.start)
  let end = minutes(session.end, true)
  if (end <= start) end += 24 * 60
  return { start, end }
}

function coverageWindow(session: ProgramItem, timing: CaptureTiming): TimeWindow {
  const bounds = sessionBounds(session)
  if (timing === 'whole') return bounds
  const duration = Math.min(COVERAGE_MINUTES, bounds.end - bounds.start)
  return timing === 'start'
    ? { start: bounds.start, end: bounds.start + duration }
    : { start: bounds.end - duration, end: bounds.end }
}

function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start < b.end && a.end > b.start
}

function assignmentsOverlap(a: ProgramItem, aTiming: CaptureTiming, b: ProgramItem, bTiming: CaptureTiming): boolean {
  return windowsOverlap(coverageWindow(a, aTiming), coverageWindow(b, bTiming))
}

function withinAvailability(session: ProgramItem, timing: CaptureTiming, person: Photographer): boolean {
  const window = coverageWindow(session, timing)
  const availableFrom = minutes(person.from)
  let availableTo = minutes(person.to, true)
  if (availableTo <= availableFrom) availableTo += 24 * 60
  return window.start >= availableFrom && window.end <= availableTo
}

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0')
  const mins = (normalized % 60).toString().padStart(2, '0')
  return `${hours}:${mins}`
}

function captureLabel(session: ProgramItem, timing: CaptureTiming): string {
  const window = coverageWindow(session, timing)
  const moment = timing === 'start' ? 'Start' : timing === 'end' ? 'Slutt' : 'Hele'
  return `${moment} ${formatTime(window.start)}–${formatTime(window.end)}`
}

function photographerAvailability(session: ProgramItem, timing: CaptureTiming, person: Photographer) {
  if (!withinAvailability(session, timing, person)) {
    return { available: false, reason: 'Utenfor arbeidstid' }
  }

  const conflict = program.find((other) => {
    if (other.id === session.id) return false
    const assignment = state.assignments[other.id]
    return assignment?.photographerId === person.id
      && assignmentsOverlap(session, timing, other, assignment.timing)
  })

  if (!conflict) return { available: true, reason: 'Ledig' }
  const assignment = state.assignments[conflict.id]
  return {
    available: false,
    reason: `Opptatt ${captureLabel(conflict, assignment.timing).replace(/^(Start|Slutt|Hele) /, '')}`,
  }
}

function conflictIds(): Set<string> {
  const conflicts = new Set<string>()
  for (const person of state.photographers) {
    const assigned = program.flatMap((session) => {
      const assignment = state.assignments[session.id]
      return assignment?.photographerId === person.id ? [{ session, assignment }] : []
    })
    for (let i = 0; i < assigned.length; i += 1) {
      for (let j = i + 1; j < assigned.length; j += 1) {
        if (assignmentsOverlap(assigned[i].session, assigned[i].assignment.timing, assigned[j].session, assigned[j].assignment.timing)) {
          conflicts.add(assigned[i].session.id)
          conflicts.add(assigned[j].session.id)
        }
      }
    }
  }
  return conflicts
}

function toast(title: string, description: string, variant: 'default' | 'success' | 'destructive' = 'default') {
  const region = document.querySelector<HTMLElement>('#toast-region')
  if (!region) return
  const item = document.createElement('div')
  item.className = `toast toast--${variant}`
  item.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span>`
  ;(region.append as unknown as (node: unknown) => void)(item)
  window.setTimeout(() => item.remove(), 3800)
}

function render() {
  renderTeam()
  renderPhotographerOverview()
  renderPhotographerFilter()
  renderAssignmentOptions()
  renderStatuses()
  renderConflictSummary()
  syncFilterControls()
  applyFilters()
  applyAccessMode()
}

function renderPhotographerOverview() {
  const container = document.querySelector<HTMLElement>('#photographer-overview-list')
  const empty = document.querySelector<HTMLElement>('#photographer-overview-empty')
  if (!container || !empty) return

  const conflicts = conflictIds()
  const timelineStart = 8 * 60
  const timelineEnd = 18 * 60
  const timelineDuration = timelineEnd - timelineStart
  const hourTicks = Array.from({ length: 11 }, (_, index) => timelineStart + index * 60)

  empty.hidden = state.photographers.length > 0
  if (!state.photographers.length) {
    overviewPhotographerId = ''
    container.innerHTML = ''
    return
  }

  if (!state.photographers.some((person) => person.id === overviewPhotographerId)) {
    overviewPhotographerId = state.photographers[0].id
  }

  const photographerTabs = state.photographers.map((person) => {
    const assignmentCount = Object.values(state.assignments).filter((assignment) => assignment?.photographerId === person.id).length
    const selected = person.id === overviewPhotographerId
    return `<button class="photographer-switcher__tab${selected ? ' is-active' : ''}" type="button" role="tab" aria-selected="${selected}" aria-controls="photographer-plan-panel" tabindex="${selected ? '0' : '-1'}" data-overview-person="${escapeHtml(person.id)}" style="--person-color:${escapeHtml(person.color)}">
      <span class="photographer-switcher__avatar">${escapeHtml(initials(person.name))}</span>
      <span class="photographer-switcher__copy"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)} · ${assignmentCount} oppdrag</small></span>
    </button>`
  }).join('')

  const person = state.photographers.find((candidate) => candidate.id === overviewPhotographerId)!
    const assigned = program.flatMap((session) => {
      const assignment = state.assignments[session.id]
      return assignment?.photographerId === person.id
        ? [{ session, assignment, window: coverageWindow(session, assignment.timing) }]
        : []
    }).sort((a, b) => a.window.start - b.window.start)
    const uniqueStages = new Set(assigned.map(({ session }) => session.stage)).size
    const firstWindow = assigned.at(0)?.window
    const lastWindow = assigned.at(-1)?.window
    const conflictCount = assigned.filter(({ session }) => conflicts.has(session.id)).length

    const timelineBlocks = assigned.map(({ session, assignment, window }, index) => {
      const start = Math.max(timelineStart, window.start)
      const end = Math.min(timelineEnd, window.end)
      if (end <= start) return ''
      const left = ((start - timelineStart) / timelineDuration) * 100
      const width = Math.max(0.8, ((end - start) / timelineDuration) * 100)
      const offset = index % 3
      const label = `${formatTime(window.start)}–${formatTime(window.end)} · ${session.title} · ${session.stage}`
      return `<span class="photographer-timeline__block${conflicts.has(session.id) ? ' is-conflict' : ''}" style="--block-left:${left.toFixed(3)}%;--block-width:${width.toFixed(3)}%;--block-color:${escapeHtml(stageColor(session.stage))};--block-row:${offset}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><i>${escapeHtml(assignment.timing === 'start' ? 'S' : assignment.timing === 'end' ? 'L' : 'H')}</i></span>`
    }).join('')

    const agenda = assigned.map(({ session, assignment, window }) => {
      const conflict = conflicts.has(session.id)
      const timingLabel = assignment.timing === 'start' ? 'Start' : assignment.timing === 'end' ? 'Slutt' : 'Hele'
      const markers = [
        ...session.mainPartners.map((partner) => `<span class="overview-marker overview-marker--partner">Main Partner · ${escapeHtml(partner)}</span>`),
        session.customerPriority ? `<span class="overview-marker overview-marker--priority">Kundeprioritet · ${escapeHtml(session.customerPriority)}</span>` : '',
        conflict ? '<span class="overview-marker overview-marker--conflict">Konflikt</span>' : '',
      ].filter(Boolean).join('')
      return `<li class="photographer-agenda__item${conflict ? ' is-conflict' : ''}" style="--stage-color:${escapeHtml(stageColor(session.stage))}">
        <div class="photographer-agenda__time"><strong>${formatTime(window.start)}</strong><span>${formatTime(window.end)}</span></div>
        <div class="photographer-agenda__copy">
          <div class="photographer-agenda__meta"><span class="photographer-agenda__stage"><i></i>${escapeHtml(session.stage)}</span><span>${timingLabel}</span><span>Program ${escapeHtml(session.start)}–${escapeHtml(session.end)}</span></div>
          <strong>${escapeHtml(session.title)}</strong>
          ${markers ? `<div class="photographer-agenda__markers">${markers}</div>` : ''}
        </div>
      </li>`
    }).join('')

    const photographerPlan = `<article id="photographer-plan-panel" class="photographer-overview-card" role="tabpanel" aria-label="Kjøreplan for ${escapeHtml(person.name)}" style="--person-color:${escapeHtml(person.color)}">
      <header class="photographer-overview-card__header">
        <div class="photographer-overview-card__identity">
          <span class="photographer-overview-card__avatar">${escapeHtml(initials(person.name))}</span>
          <div><h3>${escapeHtml(person.name)}</h3><p>${escapeHtml(person.role)}${person.phone ? ` · ${escapeHtml(person.phone)}` : ''}</p></div>
        </div>
        <button class="ui-button ui-button--outline ui-button--small" type="button" data-overview-export-person="${escapeHtml(person.id)}">Eksporter PDF</button>
      </header>
      <div class="photographer-overview-card__stats">
        <div><span>Tilgjengelig</span><strong>${escapeHtml(person.from)}–${escapeHtml(person.to)}</strong></div>
        <div><span>Oppdrag</span><strong>${assigned.length}</strong></div>
        <div><span>Scener</span><strong>${uniqueStages}</strong></div>
        <div><span>Første foto</span><strong>${firstWindow ? formatTime(firstWindow.start) : '–'}</strong></div>
        <div><span>Siste ferdig</span><strong>${lastWindow ? formatTime(lastWindow.end) : '–'}</strong></div>
        <div class="${conflictCount ? 'has-conflict' : ''}"><span>Konflikter</span><strong>${conflictCount}</strong></div>
      </div>
      ${assigned.length ? `<div class="photographer-timeline" aria-label="Tidslinje for ${escapeHtml(person.name)} fra klokken 08 til 18">
        <div class="photographer-timeline__label"><strong>Dagen din</strong><span>Fotovinduer · S = start, L = slutt, H = hele</span></div>
        <div class="photographer-timeline__plot">
          <div class="photographer-timeline__grid">${hourTicks.map((tick) => `<i style="--tick-left:${((tick - timelineStart) / timelineDuration) * 100}%"></i>`).join('')}</div>
          <div class="photographer-timeline__blocks">${timelineBlocks}</div>
          <div class="photographer-timeline__axis">${hourTicks.filter((_, index) => index % 2 === 0 || index === hourTicks.length - 1).map((tick) => `<span style="--tick-left:${((tick - timelineStart) / timelineDuration) * 100}%">${formatTime(tick)}</span>`).join('')}</div>
        </div>
      </div>
      <ol class="photographer-agenda">${agenda}</ol>` : '<div class="photographer-overview-card__no-assignments"><strong>Ingen oppdrag tildelt</strong><span>Oppdrag dukker opp her så snart fotografen blir valgt i programmet.</span></div>'}
    </article>`

  container.innerHTML = `<div class="photographer-switcher" role="tablist" aria-label="Velg fotograf">${photographerTabs}</div>${photographerPlan}`

  container.querySelectorAll<HTMLButtonElement>('[data-overview-person]').forEach((button) => {
    button.addEventListener('click', () => {
      overviewPhotographerId = button.dataset.overviewPerson || overviewPhotographerId
      renderPhotographerOverview()
    })
  })

  container.querySelectorAll<HTMLButtonElement>('[data-overview-export-person]').forEach((button) => {
    button.addEventListener('click', () => { void exportPhotographerPdf(button.dataset.overviewExportPerson || '') })
  })
}

function stageColor(stage: string): string {
  const colors: Record<string, string> = {
    'Glasshallen': '#3abfcb',
    'Praktisk Proptech': '#00716f',
    'Energy First Real Estate': '#dea330',
    'Future of Work & Life': '#6f9941',
    'Behind The Build': '#70658f',
    'The Deal Room': '#355d83',
    "Founders' Lounge": '#c05341',
    'The Board Room': '#2d7570',
    'Side Events': '#78878c',
  }
  return colors[stage] || '#78878c'
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'F'
}

function renderPhotographerFilter() {
  const container = document.querySelector<HTMLElement>('#photographer-filter')
  if (!container) return

  if (activePhotographer !== 'all' && !state.photographers.some((person) => person.id === activePhotographer)) {
    activePhotographer = 'all'
    cacheFilterState()
  }

  const options = [
    { id: 'all', name: 'Alle fotografer', count: program.length, color: '#004746' },
    ...state.photographers.map((person) => ({
      id: person.id,
      name: person.name,
      color: person.color,
      count: Object.values(state.assignments).filter((assignment) => assignment?.photographerId === person.id).length,
    })),
  ]

  container.innerHTML = options.map((option) => {
    const active = option.id === activePhotographer
    return `<button type="button" class="${active ? 'is-active' : ''}" data-photographer-filter="${escapeHtml(option.id)}" aria-pressed="${active}">
      <i style="--person-color:${escapeHtml(option.color)}"></i>
      <span>${escapeHtml(option.name)}</span>
      <span class="stage-filter__count">${option.count}</span>
    </button>`
  }).join('')

  container.querySelectorAll<HTMLButtonElement>('[data-photographer-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activePhotographer = button.dataset.photographerFilter || 'all'
      cacheFilterState()
      applyFilters()
    })
  })
}

function applyAccessMode() {
  document.querySelectorAll<HTMLButtonElement>('#auto-assign, #clear-assignments, [data-ui-dialog-trigger], [data-remove-person]').forEach((control) => {
    control.disabled = !canEdit
    control.title = canEdit ? '' : 'Logg inn som redaktør for å redigere planen'
  })
  document.querySelectorAll('[data-assignment-select], [data-timing-select]').forEach((control) => {
    const select = control as unknown as HTMLSelectElement
    select.disabled = !canEdit
    select.title = canEdit ? '' : 'Kun visning'
  })
}

function renderTeam() {
  if (!teamList || !teamEmpty) return
  const conflicts = conflictIds()
  teamEmpty.hidden = state.photographers.length > 0
  teamList.innerHTML = state.photographers.map((person) => {
    const assigned = program.filter((session) => state.assignments[session.id]?.photographerId === person.id)
    const conflictCount = assigned.filter((session) => conflicts.has(session.id)).length
    return `
      <article class="team-card" style="--person-color:${escapeHtml(person.color)}">
        <div class="team-card__head">
          <div class="team-card__identity">
            <strong>${escapeHtml(person.name)}</strong>
            <span>${escapeHtml(person.role)}${person.phone ? ` · ${escapeHtml(person.phone)}` : ''}</span>
          </div>
          <div class="team-card__actions">
            <button class="team-card__pdf" type="button" data-export-person="${person.id}" aria-label="Last ned kjøreplan som PDF for ${escapeHtml(person.name)}">Eksporter PDF</button>
            <button class="team-card__remove" type="button" data-remove-person="${person.id}" aria-label="Fjern ${escapeHtml(person.name)}">Fjern</button>
          </div>
        </div>
        <div class="team-card__meta">
          <span>${person.from}–${person.to}</span>
          <span><b>${assigned.length}</b> oppdrag${conflictCount ? ` · <b>${conflictCount}</b> i konflikt` : ''}</span>
        </div>
      </article>
    `
  }).join('')

  teamList.querySelectorAll<HTMLButtonElement>('[data-remove-person]').forEach((button) => {
    button.addEventListener('click', () => removePhotographer(button.dataset.removePerson || ''))
  })
  teamList.querySelectorAll<HTMLButtonElement>('[data-export-person]').forEach((button) => {
    button.addEventListener('click', () => { void exportPhotographerPdf(button.dataset.exportPerson || '') })
  })
}

function renderAssignmentOptions() {
  document.querySelectorAll('[data-assignment-select]').forEach((element) => {
    const select = element as unknown as HTMLSelectElement
    const sessionId = select.dataset.assignmentSelect || ''
    const assignment = state.assignments[sessionId]
    const session = sessionsById.get(sessionId)
    const selected = assignment?.photographerId || ''
    const timingSelect = document.querySelector(`[data-timing-select="${sessionId}"]`) as HTMLSelectElement | null
    const timing = assignment?.timing || pendingTiming.get(sessionId) || 'start'
    if (timingSelect) timingSelect.value = timing

    select.innerHTML = '<option value="">Velg fotograf</option>' + state.photographers.map((person) => {
      const availability = session ? photographerAvailability(session, timing, person) : { available: true, reason: 'Ledig' }
      const isSelected = person.id === selected
      const disabled = !availability.available && !isSelected
      const marker = availability.available ? '✓' : '⚠'
      return `<option value="${person.id}" ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${marker} ${escapeHtml(person.name)} · ${escapeHtml(availability.reason)}</option>`
    }).join('')
  })
}

function renderStatuses() {
  const conflicts = conflictIds()
  const assignedIds = Object.entries(state.assignments).filter(([, assignment]) => assignment?.photographerId).map(([sessionId]) => sessionId)

  document.querySelectorAll<HTMLElement>('.session-row').forEach((row) => {
    const id = row.dataset.sessionId || ''
    const status = row.querySelector<HTMLElement>('[data-status-for]')!
    const assignment = state.assignments[id]
    const person = state.photographers.find((candidate) => candidate.id === assignment?.photographerId)
    const session = sessionsById.get(id)
    row.classList.toggle('is-covered', Boolean(person))
    row.classList.toggle('is-conflict', conflicts.has(id))

    if (conflicts.has(id)) {
      status.innerHTML = `<i class="status-dot status-dot--conflict"></i> Dobbeltbooket${session && assignment ? ` · ${captureLabel(session, assignment.timing)}` : ''}`
    } else if (person && session && assignment) {
      status.innerHTML = `<i class="status-dot status-dot--covered"></i> ${escapeHtml(person.name)} · ${captureLabel(session, assignment.timing)}`
    } else {
      status.innerHTML = '<i class="status-dot status-dot--open"></i> Ufordelt'
    }
  })

  const assignedCount = new Set(assignedIds).size
  const coverage = program.length ? Math.round((assignedCount / program.length) * 100) : 0
  setText('#coverage-percent', `${coverage}%`)
  setText('#coverage-caption', `${assignedCount} av ${program.length} aktiviteter`)
  setText('#assigned-count', assignedCount.toString())
  setText('#unassigned-count', (program.length - assignedCount).toString())
  setText('#conflict-count', conflicts.size.toString())
}

function renderConflictSummary() {
  const container = document.querySelector<HTMLElement>('#conflict-summary')
  const list = document.querySelector<HTMLElement>('#conflict-summary-list')
  if (!container || !list) return

  const conflicts = conflictIds()
  const affected = state.photographers.flatMap((person) => {
    const slots = program.flatMap((session) => {
      const assignment = state.assignments[session.id]
      return assignment?.photographerId === person.id && conflicts.has(session.id)
        ? [{ session, assignment }]
        : []
    }).sort((a, b) => coverageWindow(a.session, a.assignment.timing).start - coverageWindow(b.session, b.assignment.timing).start)
    return slots.length ? [{ person, slots }] : []
  })

  container.hidden = affected.length === 0
  list.innerHTML = affected.map(({ person, slots }) => `
    <div class="conflict-summary__person">
      <strong>${escapeHtml(person.name)}</strong>
      <span>${slots.map(({ session, assignment }) => `${captureLabel(session, assignment.timing)} · ${escapeHtml(session.stage)}`).join(' / ')}</span>
    </div>
  `).join('')
}

function applyFilters() {
  syncFilterControls()
  const conflicts = conflictIds()
  let visible = 0
  document.querySelectorAll<HTMLElement>('.session-row').forEach((row) => {
    const id = row.dataset.sessionId || ''
    const matchesStage = activeStage === 'Alle' || row.dataset.stage === activeStage
    const matchesSearch = !searchTerm || `${row.dataset.title} ${row.dataset.stage} ${row.dataset.partners} ${row.dataset.priority}`.toLowerCase().includes(searchTerm)
    const isAssigned = Boolean(state.assignments[id])
    const matchesPhotographer = activePhotographer === 'all'
      || state.assignments[id]?.photographerId === activePhotographer
    const matchesCoverage = activeCoverage === 'all'
      || (activeCoverage === 'unassigned' && !isAssigned)
      || (activeCoverage === 'conflict' && conflicts.has(id))
    const isMainPartner = Boolean(row.dataset.partners)
    const isCustomerPriority = Boolean(row.dataset.priority)
    const matchesProgramType = activeProgramType === 'all'
      || (activeProgramType === 'main' && isMainPartner)
      || (activeProgramType === 'priority' && isCustomerPriority)
    row.hidden = !(matchesStage && matchesSearch && matchesCoverage && matchesProgramType && matchesPhotographer)
    if (!row.hidden) visible += 1
  })

  setText('#visible-count', visible.toString())
  const selectedPhotographer = state.photographers.find((person) => person.id === activePhotographer)
  const contextLabels = [
    activeStage === 'Alle' ? '' : activeStage,
    activeProgramType === 'main' ? 'Main Partner' : activeProgramType === 'priority' ? 'Kundeprioritet' : '',
    activeCoverage === 'unassigned' ? 'Ufordelt' : activeCoverage === 'conflict' ? 'Konflikt' : '',
    selectedPhotographer?.name || '',
  ].filter(Boolean)
  setText('#schedule-title', contextLabels.length ? contextLabels.join(' · ') : 'Alle aktiviteter')
  document.querySelector<HTMLElement>('#empty-filter')!.hidden = visible !== 0
}

function removePhotographer(id: string) {
  const person = state.photographers.find((candidate) => candidate.id === id)
  if (!person || !window.confirm(`Fjerne ${person.name} fra teamet? Tildelingene blir satt til ufordelt.`)) return
  state.photographers = state.photographers.filter((candidate) => candidate.id !== id)
  Object.keys(state.assignments).forEach((sessionId) => {
    if (state.assignments[sessionId]?.photographerId === id) delete state.assignments[sessionId]
  })
  render()
  queueSave()
  toast('Fotograf fjernet', `${person.name} er fjernet fra planen.`)
}

function autoAssign() {
  if (!state.photographers.length) {
    toast('Teamet er tomt', 'Legg til minst én fotograf før du autofordeler.', 'destructive')
    return
  }

  const assignedPerPerson = new Map(state.photographers.map((person) => [person.id, program.flatMap((session) => {
    const assignment = state.assignments[session.id]
    return assignment?.photographerId === person.id ? [{ session, timing: assignment.timing }] : []
  })]))
  let assignedNow = 0

  const ordered = [...program].sort((a, b) => minutes(a.start) - minutes(b.start))
  for (const session of ordered) {
    if (state.assignments[session.id]) continue
    const candidates = state.photographers.flatMap((person) => (['start', 'end'] as CaptureTiming[]).map((timing) => ({ person, timing })))
      .filter(({ person, timing }) => withinAvailability(session, timing, person))
      .filter(({ person, timing }) => !(assignedPerPerson.get(person.id) || []).some((other) => assignmentsOverlap(session, timing, other.session, other.timing)))
      .sort((a, b) => {
        const loadDifference = (assignedPerPerson.get(a.person.id)?.length || 0) - (assignedPerPerson.get(b.person.id)?.length || 0)
        if (loadDifference) return loadDifference
        return coverageWindow(session, a.timing).start - coverageWindow(session, b.timing).start
      })
    const chosen = candidates[0]
    if (!chosen) continue
    state.assignments[session.id] = { photographerId: chosen.person.id, timing: chosen.timing }
    assignedPerPerson.get(chosen.person.id)!.push({ session, timing: chosen.timing })
    assignedNow += 1
  }

  render()
  queueSave()
  toast('Autofordeling fullført', `${assignedNow} aktiviteter ble fordelt på start- eller sluttvinduer uten tidskollisjon.`, 'success')
}

function clearAssignments() {
  if (!Object.keys(state.assignments).length) return
  if (!window.confirm('Nullstille alle fotograf-tildelinger? Teamet beholdes.')) return
  state.assignments = {}
  render()
  queueSave()
  toast('Tildelinger nullstilt', 'Alle aktiviteter er nå ufordelt.')
}

function exportCsv() {
  const conflicts = conflictIds()
  const lines = [
    ['Programstart', 'Programslutt', 'Scene', 'Aktivitet', 'Main Partner', 'Kundeprioritet', 'Dekning', 'Fototid fra', 'Fototid til', 'Fotograf', 'Mobil', 'Rolle', 'Status'],
    ...program.map((session) => {
      const assignment = state.assignments[session.id]
      const person = state.photographers.find((candidate) => candidate.id === assignment?.photographerId)
      const window = assignment ? coverageWindow(session, assignment.timing) : null
      return [
        session.start,
        session.end,
        session.stage,
        session.title,
        session.mainPartners.join(', '),
        session.customerPriority,
        assignment ? (assignment.timing === 'start' ? 'Start' : assignment.timing === 'end' ? 'Slutt' : 'Hele') : '',
        window ? formatTime(window.start) : '',
        window ? formatTime(window.end) : '',
        person?.name || '',
        person?.phone || '',
        person?.role || '',
        conflicts.has(session.id) ? 'Konflikt' : person ? 'Bemannet' : 'Ufordelt',
      ]
    }),
  ]
  const csv = lines.map((line) => line.map(csvCell).join(';')).join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'proptech-photo-ops-2026.csv'
  link.click()
  URL.revokeObjectURL(url)
  toast('CSV eksportert', 'Bemanningsplanen er lastet ned.', 'success')
}

async function exportMasterPdf() {
  if (!state.photographers.length) {
    toast('Teamet er tomt', 'Legg til fotografer før du eksporterer masterplanen.', 'destructive')
    return
  }

  const assignments = program.flatMap((session) => {
    const assignment = state.assignments[session.id]
    const person = state.photographers.find((candidate) => candidate.id === assignment?.photographerId)
    return assignment && person ? [{ session, assignment, person, window: coverageWindow(session, assignment.timing) }] : []
  }).sort((a, b) => a.window.start - b.window.start || a.person.name.localeCompare(b.person.name, 'nb'))

  try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const conflicts = conflictIds()
    const assignedCount = new Set(assignments.map(({ session }) => session.id)).size
    const coverage = program.length ? Math.round((assignedCount / program.length) * 100) : 0
    const generatedLabel = new Intl.DateTimeFormat('nb-NO', {
      timeZone: 'Europe/Oslo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
    const planUpdatedLabel = lastRemoteUpdatedAt
      ? new Intl.DateTimeFormat('nb-NO', {
        timeZone: 'Europe/Oslo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(lastRemoteUpdatedAt))
      : 'Ikke synkronisert'
    const documentVersion = '1.0'
    const planVersion = lastRemoteRevision ? `Plan v${lastRemoteRevision}` : 'Lokal plan'
    const stagePalette: Record<string, [number, number, number]> = {
      'Glasshallen': [58, 191, 203],
      'Praktisk Proptech': [0, 113, 111],
      'Energy First Real Estate': [222, 163, 48],
      'Future of Work & Life': [111, 153, 65],
      'Behind The Build': [112, 101, 143],
      'The Deal Room': [53, 93, 131],
      "Founders' Lounge": [192, 83, 65],
      'The Board Room': [45, 117, 112],
      'Side Events': [120, 135, 140],
    }
    const colorForStage = (stage: string): [number, number, number] => stagePalette[stage] || [120, 135, 140]
    const colorForPerson = (color: string): [number, number, number] => {
      const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : '37c9d4'
      return [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16)]
    }

    doc.setProperties({
      title: 'Masterplan - Oslo Proptech Summit 2026',
      subject: 'Samlet fotoplan for alle fotografer',
      author: 'Eventphoto Mission Control',
    })

    doc.setFillColor(0, 71, 70)
    doc.rect(0, 0, pageWidth, 34, 'F')
    doc.setTextColor('#ffffff')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('EMC  /  EVENTPHOTO MISSION CONTROL', 12, 11)
    doc.setFontSize(19)
    doc.text('Masterplan - hele fototeamet', 12, 23)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor('#bee0dd')
    doc.text(`PDF v${documentVersion}  /  ${planVersion}`, pageWidth - 12, 11, { align: 'right' })
    doc.text(`Generert ${generatedLabel}`, pageWidth - 12, 17, { align: 'right' })
    doc.text(`Plan oppdatert ${planUpdatedLabel}`, pageWidth - 12, 23, { align: 'right' })

    doc.setTextColor(31, 43, 45)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('OSLO PROPTECH SUMMIT 2026', 12, 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text('21. oktober 2026  /  Construction City', 12, 48)

    const cardY = 38
    const cardGap = 3
    const cardWidth = 39
    const cardStartX = pageWidth - 12 - ((cardWidth * 4) + (cardGap * 3))
    const summaryCards = [
      ['FOTOGRAFER', String(state.photographers.length)],
      ['TILDELINGER', String(assignedCount)],
      ['DEKNING', `${coverage}%`],
      ['KONFLIKTER', String(conflicts.size)],
    ]
    summaryCards.forEach(([label, value], index) => {
      const x = cardStartX + index * (cardWidth + cardGap)
      doc.setFillColor(244, 247, 246)
      doc.roundedRect(x, cardY, cardWidth, 15, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(101, 113, 115)
      doc.text(label, x + 3.5, cardY + 5)
      doc.setFontSize(11)
      doc.setTextColor(conflicts.size && label === 'KONFLIKTER' ? 187 : 0, conflicts.size && label === 'KONFLIKTER' ? 61 : 71, conflicts.size && label === 'KONFLIKTER' ? 47 : 70)
      doc.text(value, x + 3.5, cardY + 12)
    })

    const timelineStart = Math.min(8 * 60, ...assignments.map(({ window }) => window.start))
    const timelineEnd = Math.max(18 * 60, ...assignments.map(({ window }) => window.end))
    const roundedStart = Math.floor(timelineStart / 60) * 60
    const roundedEnd = Math.ceil(timelineEnd / 60) * 60
    const timelineLabelX = 12
    const timelineX = 52
    const timelineWidth = pageWidth - timelineX - 12
    const timelineTop = 64
    const rowHeight = 8
    const rowGap = 3

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(31, 43, 45)
    doc.text('TEAMETS TIDSLINJE', timelineLabelX, 59)

    state.photographers.forEach((person, index) => {
      const y = timelineTop + index * (rowHeight + rowGap)
      const personAssignments = assignments.filter((item) => item.person.id === person.id)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.7)
      doc.setTextColor(31, 43, 45)
      doc.text(person.name, timelineLabelX, y + 3.5, { maxWidth: 36 })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.8)
      doc.setTextColor(101, 113, 115)
      doc.text(`${personAssignments.length} oppdrag`, timelineLabelX, y + 7)
      doc.setFillColor(232, 237, 235)
      doc.roundedRect(timelineX, y, timelineWidth, rowHeight, 1.5, 1.5, 'F')
      personAssignments.forEach(({ session, window }) => {
        const start = Math.max(roundedStart, window.start)
        const end = Math.min(roundedEnd, window.end)
        if (end <= start) return
        const x = timelineX + ((start - roundedStart) / (roundedEnd - roundedStart)) * timelineWidth
        const width = Math.max(1.4, ((end - start) / (roundedEnd - roundedStart)) * timelineWidth)
        doc.setFillColor(...colorForStage(session.stage))
        doc.roundedRect(x, y, width, rowHeight, .8, .8, 'F')
        if (conflicts.has(session.id)) {
          doc.setDrawColor(187, 61, 47)
          doc.setLineWidth(.6)
          doc.roundedRect(x, y, width, rowHeight, .8, .8, 'S')
        }
      })
    })

    const axisY = timelineTop + state.photographers.length * (rowHeight + rowGap) - rowGap + 4
    const totalHours = Math.max(1, Math.ceil((roundedEnd - roundedStart) / 60))
    const tickStep = totalHours > 12 ? 3 : 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.8)
    doc.setTextColor(101, 113, 115)
    for (let tick = roundedStart; tick <= roundedEnd; tick += tickStep * 60) {
      const x = timelineX + ((tick - roundedStart) / (roundedEnd - roundedStart)) * timelineWidth
      doc.text(formatTime(tick), x, axisY, { align: tick === roundedStart ? 'left' : tick === roundedEnd ? 'right' : 'center' })
    }
    if ((roundedEnd - roundedStart) % (tickStep * 60) !== 0) doc.text(formatTime(roundedEnd), timelineX + timelineWidth, axisY, { align: 'right' })

    const rows = assignments.map(({ session, assignment, person, window }) => {
      const notes = [
        session.mainPartners.length ? `Main Partner: ${session.mainPartners.join(', ')}` : '',
        session.customerPriority ? `Kundeprioritet: ${session.customerPriority}` : '',
        conflicts.has(session.id) ? 'KONFLIKT' : '',
      ].filter(Boolean).join('\n') || '-'
      const timing = assignment.timing === 'start' ? 'Start' : assignment.timing === 'end' ? 'Slutt' : 'Hele'
      return [
        `${formatTime(window.start)} - ${formatTime(window.end)}`,
        person.name,
        session.stage,
        `${session.title}\nProgram: ${session.start} - ${session.end}`,
        timing,
        notes,
      ]
    })

    autoTable(doc, {
      startY: axisY + 7,
      head: [['Fototid', 'Fotograf', 'Scene', 'Programpost', 'Dekning', 'Merknad']],
      body: rows,
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      margin: { left: 12, right: 12, top: 16, bottom: 14 },
      styles: { font: 'helvetica', fontSize: 6.6, cellPadding: 2, textColor: [31, 43, 45], lineColor: [218, 224, 222], lineWidth: 0.25, valign: 'top' },
      headStyles: { fillColor: [0, 71, 70], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [0, 71, 70] },
      alternateRowStyles: { fillColor: [247, 249, 248] },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold' },
        1: { cellWidth: 34, cellPadding: { top: 2, right: 2, bottom: 2, left: 6 } },
        2: { cellWidth: 38 },
        3: { cellWidth: 82 },
        4: { cellWidth: 22 },
        5: { cellWidth: 68 },
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 1) return
        const person = assignments[data.row.index]?.person
        if (!person) return
        doc.setFillColor(...colorForPerson(person.color))
        doc.circle(data.cell.x + 3, data.cell.y + 4, 1.2, 'F')
      },
      didDrawPage: () => {
        const pageNumber = doc.getNumberOfPages()
        doc.setDrawColor(218, 224, 222)
        doc.line(12, pageHeight - 10, pageWidth - 12, pageHeight - 10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(101, 113, 115)
        doc.text(`EMC  /  Master-PDF v${documentVersion}  /  ${planVersion}  /  Generert ${generatedLabel}`, 12, pageHeight - 5)
        doc.text(`Side ${pageNumber}`, pageWidth - 12, pageHeight - 5, { align: 'right' })
      },
    })

    doc.save('fotoplan-master-proptech-2026.pdf')
    toast('Master-PDF eksportert', `Samlet plan for ${state.photographers.length} fotografer er lastet ned.`, 'success')
  } catch (error) {
    console.error(error)
    toast('Kunne ikke lage master-PDF', 'Prøv på nytt. Planen er fortsatt lagret.', 'destructive')
  }
}

async function exportPhotographerPdf(photographerId: string) {
  const person = state.photographers.find((candidate) => candidate.id === photographerId)
  if (!person) return

  const assigned = program.flatMap((session) => {
    const assignment = state.assignments[session.id]
    return assignment?.photographerId === person.id ? [{ session, assignment }] : []
  }).sort((a, b) => coverageWindow(a.session, a.assignment.timing).start - coverageWindow(b.session, b.assignment.timing).start)

  try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const conflicts = conflictIds()
    const pageWidth = doc.internal.pageSize.getWidth()
    const generatedAt = new Date()
    const generatedLabel = new Intl.DateTimeFormat('nb-NO', {
      timeZone: 'Europe/Oslo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(generatedAt)
    const planUpdatedLabel = lastRemoteUpdatedAt
      ? new Intl.DateTimeFormat('nb-NO', {
        timeZone: 'Europe/Oslo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(lastRemoteUpdatedAt))
      : 'Ikke synkronisert'
    const documentVersion = '2.0'
    const planVersion = lastRemoteRevision ? `Plan v${lastRemoteRevision}` : 'Lokal plan'
    const uniqueStages = new Set(assigned.map(({ session }) => session.stage)).size
    const firstWindow = assigned[0] ? coverageWindow(assigned[0].session, assigned[0].assignment.timing) : null
    const lastWindow = assigned.at(-1) ? coverageWindow(assigned.at(-1)!.session, assigned.at(-1)!.assignment.timing) : null
    const stagePalette: Record<string, [number, number, number]> = {
      'Glasshallen': [58, 191, 203],
      'Praktisk Proptech': [0, 113, 111],
      'Energy First Real Estate': [222, 163, 48],
      'Future of Work & Life': [111, 153, 65],
      'Behind The Build': [112, 101, 143],
      'The Deal Room': [53, 93, 131],
      "Founders' Lounge": [192, 83, 65],
      'The Board Room': [45, 117, 112],
      'Side Events': [120, 135, 140],
    }
    const colorForStage = (stage: string): [number, number, number] => stagePalette[stage] || [120, 135, 140]

    doc.setProperties({
      title: `Fotoplan - ${person.name}`,
      subject: 'Oslo Proptech Summit 2026',
      author: 'Eventphoto Mission Control',
    })

    doc.setFillColor(0, 71, 70)
    doc.rect(0, 0, pageWidth, 42, 'F')
    doc.setTextColor('#ffffff')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('EMC  /  EVENTPHOTO MISSION CONTROL', 14, 13)
    doc.setFontSize(20)
    doc.text(person.name, 14, 25)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`${person.role}${person.phone ? `  /  ${person.phone}` : ''}`, 14, 32)
    doc.setFontSize(7)
    doc.setTextColor('#bee0dd')
    doc.text(`PDF v${documentVersion}  /  ${planVersion}`, pageWidth - 14, 13, { align: 'right' })
    doc.text(`Generert ${generatedLabel}`, pageWidth - 14, 19, { align: 'right' })

    doc.setTextColor(31, 43, 45)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('OSLO PROPTECH SUMMIT 2026', 14, 51)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('21. oktober 2026  /  Construction City', 14, 57)
    doc.text(`Tilgjengelig ${person.from} - ${person.to}  /  Plan oppdatert ${planUpdatedLabel}`, pageWidth - 14, 57, { align: 'right' })

    const cardY = 63
    const cardGap = 3
    const cardWidth = (pageWidth - 28 - (cardGap * 3)) / 4
    const summaryCards = [
      ['OPPDRAG', String(assigned.length)],
      ['SCENER', String(uniqueStages)],
      ['FØRSTE FOTO', firstWindow ? formatTime(firstWindow.start) : '-'],
      ['SISTE FERDIG', lastWindow ? formatTime(lastWindow.end) : '-'],
    ]
    summaryCards.forEach(([label, value], index) => {
      const x = 14 + index * (cardWidth + cardGap)
      doc.setFillColor(244, 247, 246)
      doc.roundedRect(x, cardY, cardWidth, 17, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(101, 113, 115)
      doc.text(label, x + 4, cardY + 5.5)
      doc.setFontSize(12)
      doc.setTextColor(0, 71, 70)
      doc.text(value, x + 4, cardY + 13)
    })

    if (!assigned.length) {
      doc.setFillColor(244, 247, 246)
      doc.roundedRect(14, 88, pageWidth - 28, 28, 3, 3, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('Ingen oppdrag er tildelt ennå', 20, 100)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Oppdater planen i EMC og eksporter PDF-en på nytt.', 20, 108)
    } else {
      const timelineStart = 8 * 60
      const timelineEnd = 18 * 60
      const timelineX = 14
      const timelineY = 91
      const timelineWidth = pageWidth - 28
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(31, 43, 45)
      doc.text('DAGEN DIN', timelineX, 87)
      doc.setFillColor(232, 237, 235)
      doc.roundedRect(timelineX, timelineY, timelineWidth, 5, 1.5, 1.5, 'F')
      assigned.forEach(({ session, assignment }) => {
        const window = coverageWindow(session, assignment.timing)
        const start = Math.max(timelineStart, window.start)
        const end = Math.min(timelineEnd, window.end)
        if (end <= start) return
        const x = timelineX + ((start - timelineStart) / (timelineEnd - timelineStart)) * timelineWidth
        const width = Math.max(1.2, ((end - start) / (timelineEnd - timelineStart)) * timelineWidth)
        doc.setFillColor(...colorForStage(session.stage))
        doc.roundedRect(x, timelineY, width, 5, .8, .8, 'F')
      })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(101, 113, 115)
      ;[['08:00', 0], ['12:00', .4], ['16:00', .8], ['18:00', 1]].forEach(([label, ratio]) => {
        const x = timelineX + Number(ratio) * timelineWidth
        doc.text(String(label), x, 101, { align: Number(ratio) === 0 ? 'left' : Number(ratio) === 1 ? 'right' : 'center' })
      })

      const rows = assigned.map(({ session, assignment }) => {
        const window = coverageWindow(session, assignment.timing)
        const notes = [
          session.mainPartners.length ? `Main Partner: ${session.mainPartners.join(', ')}` : '',
          session.customerPriority ? `Kundeprioritet: ${session.customerPriority}` : '',
          conflicts.has(session.id) ? 'KONFLIKT' : '',
        ].filter(Boolean).join('\n') || '-'
        return [
          `${formatTime(window.start)} - ${formatTime(window.end)}`,
          session.stage,
          `${session.title}\nProgram: ${session.start} - ${session.end}`,
          notes,
        ]
      })

      autoTable(doc, {
        startY: 106,
        head: [['Fototid', 'Scene', 'Programpost', 'Merknad']],
        body: rows,
        theme: 'grid',
        margin: { left: 14, right: 14, top: 18, bottom: 16 },
        styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 2.25, textColor: [31, 43, 45], lineColor: [218, 224, 222], lineWidth: 0.25, valign: 'top' },
        headStyles: { fillColor: [0, 71, 70], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [0, 71, 70] },
        alternateRowStyles: { fillColor: [247, 249, 248] },
        columnStyles: { 0: { cellWidth: 27, fontStyle: 'bold' }, 1: { cellWidth: 34, cellPadding: { top: 2.25, right: 2.25, bottom: 2.25, left: 6 } }, 2: { cellWidth: 75 }, 3: { cellWidth: 46 } },
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 1) return
          const stage = assigned[data.row.index]?.session.stage
          if (!stage) return
          doc.setFillColor(...colorForStage(stage))
          doc.circle(data.cell.x + 3, data.cell.y + 4, 1.2, 'F')
        },
        didDrawPage: () => {
          const pageNumber = doc.getNumberOfPages()
          const pageHeight = doc.internal.pageSize.getHeight()
          doc.setDrawColor(218, 224, 222)
          doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(101, 113, 115)
          doc.text(`EMC  /  PDF v${documentVersion}  /  ${planVersion}  /  Generert ${generatedLabel}`, 14, pageHeight - 6)
          doc.text(`Side ${pageNumber}`, pageWidth - 14, pageHeight - 6, { align: 'right' })
        },
      })
    }

    const filename = person.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    doc.save(`fotoplan-${filename || 'fotograf'}-proptech-2026.pdf`)
    toast('PDF eksportert', `Fotoplanen til ${person.name} er lastet ned.`, 'success')
  } catch (error) {
    console.error(error)
    toast('Kunne ikke lage PDF', 'Prøv på nytt. Planen er fortsatt lagret.', 'destructive')
  }
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char] || char)
}

function setText(selector: string, value: string) {
  const element = document.querySelector<HTMLElement>(selector)
  if (element) element.textContent = value
}

document.querySelectorAll('[data-assignment-select]').forEach((element) => {
  const select = element as unknown as HTMLSelectElement
  select.addEventListener('change', () => {
    const sessionId = select.dataset.assignmentSelect || ''
    if (select.value) {
      state.assignments[sessionId] = {
        photographerId: select.value,
        timing: state.assignments[sessionId]?.timing || pendingTiming.get(sessionId) || 'start',
      }
    }
    else delete state.assignments[sessionId]
    render()
    queueSave()
    if (select.value && activeCoverage === 'unassigned') {
      toast('Tildelt og filtrert bort', 'Aktiviteten skjules fordi filteret «Ufordelt» fortsatt er aktivt.', 'success')
    }
  })
})

document.querySelectorAll('[data-timing-select]').forEach((element) => {
  const select = element as unknown as HTMLSelectElement
  select.addEventListener('change', () => {
    const sessionId = select.dataset.timingSelect || ''
    const timing: CaptureTiming = select.value === 'end' || select.value === 'whole' ? select.value : 'start'
    pendingTiming.set(sessionId, timing)
    const assignment = state.assignments[sessionId]
    if (assignment) assignment.timing = timing
    render()
    if (assignment) queueSave()
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((button) => {
  button.addEventListener('click', () => {
    activeStage = button.dataset.stage || 'Alle'
    cacheFilterState()
    applyFilters()
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-coverage]').forEach((button) => {
  button.addEventListener('click', () => {
    activeCoverage = button.dataset.coverage || 'all'
    cacheFilterState()
    applyFilters()
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-program-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    activeProgramType = button.dataset.programFilter || 'all'
    cacheFilterState()
    applyFilters()
  })
})

document.querySelector<HTMLInputElement>('#program-search')?.addEventListener('input', (event) => {
  searchTerm = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase()
  cacheFilterState()
  applyFilters()
})

if (form && photographerDialog) form.addEventListener('submit', (event) => {
  event.preventDefault()
  if (!form.reportValidity()) return
  const data = new FormData(form)
  const photographer: Photographer = {
    id: crypto.randomUUID?.() || `person-${Date.now()}`,
    name: String(data.get('name') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    role: String(data.get('role') || 'Scene'),
    from: String(data.get('from') || '08:00'),
    to: String(data.get('to') || '18:00'),
    color: String(data.get('color') || '#37c9d4'),
  }
  state.photographers.push(photographer)
  form.reset()
  const from = form.elements.namedItem('from') as HTMLInputElement
  const to = form.elements.namedItem('to') as HTMLInputElement
  const color = form.elements.namedItem('color') as HTMLInputElement
  from.value = '08:00'
  to.value = '18:00'
  color.value = '#37c9d4'
  photographerDialog.close()
  render()
  queueSave()
  toast('Fotograf lagt til', `${photographer.name} er klar for tildeling.`, 'success')
})

document.querySelectorAll<HTMLElement>('[data-ui-dialog-trigger]').forEach((button) => {
  button.addEventListener('click', () => photographerDialog?.showModal())
})

document.querySelectorAll<HTMLElement>('[data-ui-dialog-close]').forEach((button) => {
  button.addEventListener('click', () => photographerDialog?.close())
})

photographerDialog?.addEventListener('click', (event) => {
  if (event.target === photographerDialog) photographerDialog.close()
})

document.querySelector('#auto-assign')?.addEventListener('click', autoAssign)
document.querySelector('#clear-assignments')?.addEventListener('click', clearAssignments)
document.querySelector('#export-master-pdf')?.addEventListener('click', () => { void exportMasterPdf() })
document.querySelector('#export-button')?.addEventListener('click', exportCsv)

render()
setSyncStatus('loading', 'Kobler til…')
void loadRemoteState()
window.setInterval(() => { void loadRemoteState(true) }, 8000)
window.addEventListener('focus', () => { void loadRemoteState(true) })

export {}
