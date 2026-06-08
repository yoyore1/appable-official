/*--------------------------------------------------------------------------------------
 *  Appable Builder — chat-first interface (GPT-style).
 *  5-question interview mirrors the Appable web platform flow.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from 'react'
import {
	BuildResult, IAppableBuilderService, InterviewAnswers, MasterBuildPrompt, ProgressEvent,
} from '../../../../../../../workbench/contrib/void/common/appableBuilderTypes.js'
import {
	BuildAppStep, BUILDING_STEPS, buildAppSteps, buildStepIndex, INTERVIEW_QUESTIONS, interviewAcks,
	planWelcomeMessage, suggestColorOptions,
} from '../../../../../../../workbench/contrib/void/common/appableInterview.js'
const C = {
	cream: '#FDFAF4',
	card: '#FFFFFF',
	coral: '#FF7A63',
	coralDeep: '#E8543B',
	charcoal: '#2B2624',
	muted: '#8A817B',
	moss: '#56A274',
	line: '#EFE7DA',
	peach: '#FFD4C8',
}

type Phase = 'start' | 'awaitId' | 'interview' | 'ready' | 'building' | 'done'

interface Msg {
	id: number
	role: 'ai' | 'user'
	text: string
	kind?: ProgressEvent['kind']
}

const ICON: Record<ProgressEvent['kind'], string> = {
	heading: '✦', step: '○', ok: '✓', fixing: '↻', detail: '·', celebrate: '🎉', error: '⚠',
}

const ACK_DELAY_MS = 500
const ACK_STAGGER_MS = 1250
const STEP_MS = 1400
const CREEP_MS = 650
const CREEP_RATE = 0.55

function sleep(ms: number) {
	return new Promise<void>(r => setTimeout(r, ms))
}

export const AppableBuilder = ({
	appableService,
}: {
	appableService: IAppableBuilderService
}) => {
	const [phase, setPhase] = useState<Phase>('start')
	const [messages, setMessages] = useState<Msg[]>([{
		id: 0, role: 'ai',
		text: "Hey — I'm your Appable assistant. Let's turn your idea into a real iOS app. How do you want to start?",
	}])
	const [input, setInput] = useState('')
	const [sending, setSending] = useState(false)
	const [projectId, setProjectId] = useState<string | null>(null)
	const [plan, setPlan] = useState<MasterBuildPrompt | null>(null)
	const [qIndex, setQIndex] = useState(0)
	const [colorOptions, setColorOptions] = useState<string[]>([])
	const [result, setResult] = useState<BuildResult | null>(null)
	const [buildPercent, setBuildPercent] = useState(0)
	const [creepPercent, setCreepPercent] = useState(0)
	const [activeBuildSteps, setActiveBuildSteps] = useState<BuildAppStep[]>(() => buildAppSteps(null))

	const idRef = useRef(1)
	const scrollRef = useRef<HTMLDivElement | null>(null)
	const answersRef = useRef<Partial<InterviewAnswers>>({})
	const buildingRef = useRef(false)
	const buildPercentRef = useRef(0)

	const nextId = () => idRef.current++
	const addMsg = (role: 'ai' | 'user', text: string, kind?: ProgressEvent['kind']) =>
		setMessages(prev => [...prev, { id: nextId(), role, text, kind }])

	useEffect(() => {
		const d1 = appableService.onProgress((e: ProgressEvent) => {
			if (buildingRef.current) {
				if (e.percent !== undefined) {
					setBuildPercent(p => {
						const next = Math.max(p, e.percent!)
						buildPercentRef.current = next
						return next
					})
				}
				if (e.kind === 'error') { addMsg('ai', e.message, e.kind) }
				return
			}
			if (e.kind === 'detail') { return }
			addMsg('ai', e.message, e.kind)
		})
		return () => d1.dispose()
	}, [appableService])

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
	}, [messages, sending, buildPercent, creepPercent])

	/** Gentle creep between engine milestones so progress never feels frozen. */
	useEffect(() => {
		if (phase !== 'building') { return }
		const id = setInterval(() => {
			setCreepPercent(c => {
				const engine = buildPercentRef.current
				const idx = buildStepIndex(Math.max(engine, c), activeBuildSteps)
				const nextAt = activeBuildSteps[idx + 1]?.atPercent ?? 100
				const cap = Math.min(nextAt - 0.5, engine + 14, 99.5)
				return c < cap ? c + CREEP_RATE : c
			})
		}, CREEP_MS)
		return () => clearInterval(id)
	}, [phase, activeBuildSteps])

	const chooseEnterId = () => {
		addMsg('user', 'I already made my plan')
		addMsg('ai', 'Great — paste your project ID from getappable.com and I\'ll pull your plan.')
		setPhase('awaitId')
	}

	const chooseInterview = () => {
		addMsg('user', 'Start from scratch')
		setPhase('interview')
		setQIndex(0)
		setColorOptions([])
		answersRef.current = {}
		setTimeout(() => addMsg('ai', INTERVIEW_QUESTIONS[0].prompt), 250)
	}

	const playAcks = async (questionId: keyof InterviewAnswers, answer: string) => {
		const acks = interviewAcks(questionId, answer, answersRef.current)
		for (let i = 0; i < acks.length; i++) {
			await sleep(i === 0 ? ACK_DELAY_MS : ACK_STAGGER_MS)
			addMsg('ai', acks[i])
		}
		await sleep(450)
	}

	const runBuildingSteps = async (planPromise: Promise<MasterBuildPrompt>) => {
		const holdStep = BUILDING_STEPS.length - 2
		let step = 0
		addMsg('ai', BUILDING_STEPS[0])
		const tick = setInterval(() => {
			if (step < holdStep) {
				step++
				addMsg('ai', BUILDING_STEPS[step])
			}
		}, STEP_MS)
		try {
			const p = await planPromise
			clearInterval(tick)
			while (step < BUILDING_STEPS.length - 1) {
				step++
				addMsg('ai', BUILDING_STEPS[step])
				await sleep(STEP_MS)
			}
			return p
		} catch (e) {
			clearInterval(tick)
			throw e
		}
	}

	const submitAnswer = async (value: string) => {
		if (sending) { return }
		const q = INTERVIEW_QUESTIONS[qIndex]
		addMsg('user', value)
		answersRef.current = { ...answersRef.current, [q.id]: value }
		setSending(true)

		try {
			await playAcks(q.id, value)

			if (qIndex < INTERVIEW_QUESTIONS.length - 1) {
				const ni = qIndex + 1
				const nextQ = INTERVIEW_QUESTIONS[ni]
				if (nextQ.id === 'colors') {
					setColorOptions(suggestColorOptions(answersRef.current))
				}
				setQIndex(ni)
				addMsg('ai', nextQ.prompt)
				return
			}

			setPhase('ready')
			const answers = answersRef.current as InterviewAnswers
			const planPromise = appableService.generatePlan(answers)
			const p = await runBuildingSteps(planPromise)
			setPlan(p)
			try {
				const synced = await appableService.syncInterviewProject(answers, p)
				if (synced.projectId && synced.projectId !== 'sample') {
					setProjectId(synced.projectId)
				}
			} catch {
				/* offline / mock — build still works locally */
			}
			addMsg('ai', `Meet your app. 🎉 This is really yours — “${p.appName}”. Privacy & support pages are ready too. Tap “Build my app” when you're ready, or tell me what to change.`)
		} catch {
			addMsg('ai', 'I had trouble finishing your plan — your answers are saved. Tap “Build my app” to try again.')
			setPhase('ready')
		} finally {
			setSending(false)
		}
	}

	const submitId = async (value: string) => {
		const id = value.trim()
		if (!id) { return }
		addMsg('user', id)
		setProjectId(id)
		setSending(true)
		try {
			const mp = await appableService.fetchPlan(id)
			setPlan(mp)
			addMsg('ai', planWelcomeMessage(mp))
			setPhase('ready')
		} catch {
			addMsg('ai', "I couldn't find that project ID — double-check it on getappable.com and try again.", 'error')
			setPhase('awaitId')
		} finally {
			setSending(false)
		}
	}

	const sendChat = async (value: string) => {
		addMsg('user', value)
		setSending(true)
		try {
			const history = [...messages.filter(m => !m.kind), { id: 0, role: 'user' as const, text: value }]
				.map(m => ({ role: (m.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text }))
			const res = await appableService.chat({ messages: history, masterPrompt: plan ?? undefined })
			addMsg('ai', res.reply)
		} catch {
			addMsg('ai', "I couldn't reach the assistant just now — give it another go in a sec.")
		} finally {
			setSending(false)
		}
	}

	const onSend = () => {
		const v = input.trim()
		if (!v || sending) { return }
		setInput('')
		if (phase === 'awaitId') { void submitId(v); return }
		if (phase === 'interview') { void submitAnswer(v); return }
		void sendChat(v)
	}

	const onBuild = async () => {
		if (phase === 'building') { return }
		setActiveBuildSteps(buildAppSteps(plan))
		setPhase('building')
		setResult(null)
		setBuildPercent(0)
		setCreepPercent(0)
		buildPercentRef.current = 0
		buildingRef.current = true
		try {
			const r = await appableService.build({
				projectId: projectId ?? 'sample',
				mode: 'base',
				masterPrompt: plan ?? undefined,
			})
			setBuildPercent(100)
			setCreepPercent(100)
			buildPercentRef.current = 100
			await sleep(400)
			setResult(r)
			setPhase('done')
		} catch (e) {
			addMsg('ai', String((e as Error)?.message ?? e), 'error')
			setPhase('ready')
			setBuildPercent(0)
			setCreepPercent(0)
			buildPercentRef.current = 0
		} finally {
			buildingRef.current = false
		}
	}

	const currentQuestion = phase === 'interview' ? INTERVIEW_QUESTIONS[qIndex] : null
	const showColorChips = currentQuestion?.id === 'colors' && colorOptions.length > 0
	const canBuild = (phase === 'ready' || phase === 'done') && !sending
	const displayPercent = phase === 'building'
		? Math.min(100, Math.round(Math.max(buildPercent, creepPercent)))
		: 0
	const buildStepIdx = phase === 'building' ? buildStepIndex(displayPercent, activeBuildSteps) : 0
	const inputPlaceholder =
		phase === 'awaitId' ? 'Paste your project ID…' :
			phase === 'interview' && showColorChips ? 'Or type your own colors…' :
				phase === 'interview' ? 'Type your answer…' :
					'Message your assistant…'

	return (
		<div style={S.root}>
			<div style={S.grain} />
			<div style={S.mesh} />

			<div style={S.topBar}>
				<div style={S.topBarRow}>
					<div style={S.logoMark}>A</div>
					<div>
						<div style={S.brand}>Appable Builder</div>
						<div style={S.tagline}>Describe it. Build it. Ship it.</div>
					</div>
					<div style={{ flex: 1 }} />
					{phase === 'building' && (
						<div style={S.progressPill}>
							<span style={S.progressPct}>{displayPercent}%</span>
						</div>
					)}
				</div>
				{phase === 'building' && (
					<BuildProgressBar percent={displayPercent} appName={plan?.appName} />
				)}
			</div>

			<div ref={scrollRef} style={S.stream}>
				{messages.map(m => <Bubble key={m.id} msg={m} />)}

				{phase === 'start' && (
					<div style={S.suggestRow}>
						<SuggestCard
							title="I already made my plan"
							sub="Enter your project ID from the website"
							onClick={chooseEnterId}
						/>
						<SuggestCard
							title="Start from scratch"
							sub="Answer 5 quick questions here"
							onClick={chooseInterview}
						/>
					</div>
				)}

				{sending && phase === 'interview' && (
					<div style={S.typing}>Appable is typing…</div>
				)}
				{sending && phase !== 'interview' && (
					<div style={S.typing}>Appable is thinking…</div>
				)}
				{phase === 'building' && (
					<BuildingStepsCard steps={activeBuildSteps} stepIdx={buildStepIdx} />
				)}
				{result && <ResultCard result={result} />}
			</div>

			<div style={S.footer}>
				{showColorChips && (
					<div style={{ ...S.chipRow, marginBottom: 8 }}>
						{colorOptions.map(opt => (
							<button key={opt} type="button" style={S.chip} disabled={sending} onClick={() => void submitAnswer(opt)}>{opt}</button>
						))}
					</div>
				)}
				{canBuild && (
					<button type="button" onClick={onBuild} style={S.buildBtn}>
						{phase === 'done' ? 'Build again' : 'Build my app'}
					</button>
				)}
				{phase === 'building' && (
					<button type="button" disabled style={S.buildBtnDisabled}>Building your app…</button>
				)}
				<div style={S.inputRow}>
					<input
						value={input}
						onChange={e => setInput(e.target.value)}
						onKeyDown={e => { if (e.key === 'Enter') { onSend() } }}
						placeholder={inputPlaceholder}
						style={S.input}
						disabled={phase === 'building'}
					/>
					<button type="button" onClick={onSend} disabled={!input.trim() || sending || phase === 'building'} style={S.sendBtn}>↑</button>
				</div>
			</div>
		</div>
	)
}

const BuildProgressBar = ({ percent, appName }: { percent: number; appName?: string }) => (
	<div style={S.progressWrap}>
		<div style={S.progressLabel}>
			Building {appName ? `“${appName}”` : 'your app'}
		</div>
		<div style={S.progressTrack}>
			<div style={{ ...S.progressFill, width: `${percent}%` }} />
		</div>
	</div>
)

const BuildingStepsCard = ({ steps, stepIdx }: { steps: BuildAppStep[]; stepIdx: number }) => (
	<div style={S.buildingCard}>
		{steps.slice(0, stepIdx + 1).map((s, i) => {
			const done = i < stepIdx
			const active = i === stepIdx
			return (
				<div key={`${s.label}-${i}`} style={{
					...S.buildStep,
					opacity: done ? 0.72 : 1,
					transition: 'opacity 0.35s ease',
				}}>
					<span style={done ? S.stepDone : active ? S.stepActive : S.stepPending}>
						{done ? '✓' : '✦'}
					</span>
					<span style={{
						fontSize: 13.5,
						color: done ? C.muted : C.charcoal,
						fontWeight: active ? 600 : 400,
					}}>
						{s.label}{active && !s.label.endsWith('…') ? '…' : ''}
					</span>
				</div>
			)
		})}
	</div>
)

const SuggestCard = ({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) => (
	<button type="button" onClick={onClick} style={S.suggestCard}>
		<div style={{ fontSize: 14.5, fontWeight: 700, color: C.charcoal, fontFamily: "'Clash Display', sans-serif" }}>{title}</div>
		<div style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>
	</button>
)

const Bubble = ({ msg }: { msg: Msg }) => {
	if (msg.kind === 'heading') {
		return <div style={{ margin: '20px 2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.muted }}>{msg.text}</div>
	}
	if (msg.role === 'user') {
		return (
			<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, width: '100%', minWidth: 0 }}>
				<div style={S.userBubble}>{msg.text}</div>
			</div>
		)
	}
	const accent =
		msg.kind === 'ok' || msg.kind === 'celebrate' ? C.moss :
			msg.kind === 'fixing' ? '#C8902A' :
				msg.kind === 'error' ? C.coralDeep : C.charcoal
	return (
		<div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10, width: '100%', minWidth: 0 }}>
			<div style={{ ...S.aiBubble, ...(msg.kind === 'celebrate' ? { background: 'rgba(86,162,116,0.12)', fontWeight: 700 } : {}) }}>
				{msg.kind && msg.kind !== 'detail' && (
					<span style={{ color: accent, marginRight: 8 }}>{ICON[msg.kind]}</span>
				)}
				<span style={{ color: msg.kind === 'detail' ? C.muted : C.charcoal, fontFamily: msg.kind === 'detail' ? 'ui-monospace, monospace' : "'Satoshi', sans-serif", fontSize: msg.kind === 'detail' ? 11.5 : 14 }}>{msg.text}</span>
			</div>
		</div>
	)
}

const ResultCard = ({ result }: { result: BuildResult }) => (
	<div style={{
		marginTop: 8, background: C.card, border: `2px solid ${C.coral}`, borderRadius: 18,
		padding: 18, boxShadow: '0 12px 32px rgba(232,84,59,0.14)',
	}}>
		<div style={{ fontFamily: "'Clash Display', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
			Meet {result.appName}. 🎉
		</div>
		<div style={{ fontSize: 13.5, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
			This is really yours — {result.fileCount} files, {result.compiled ? 'compiled and ready' : 'saved and waiting'}.
			{result.shipPath === 'mac' ? ' Open in Xcode to run it.' : ' Follow the Codemagic steps to get it on your phone.'}
		</div>
	</div>
)

const S: Record<string, React.CSSProperties> = {
	root: {
		position: 'relative', display: 'flex', flexDirection: 'column',
		width: '100%', height: '100%', minHeight: 0,
		background: C.cream, color: C.charcoal,
		fontFamily: "'Satoshi', system-ui, sans-serif",
		overflow: 'hidden',
	},
	grain: {
		position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.3, zIndex: 0,
		backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
	},
	mesh: {
		position: 'absolute', top: 0, left: 0, right: 0, height: 160, pointerEvents: 'none', zIndex: 0,
		background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${C.peach}44, transparent), radial-gradient(ellipse 60% 50% at 80% 10%, ${C.coral}1e, transparent)`,
	},
	topBar: {
		position: 'relative', zIndex: 1,
		display: 'flex', flexDirection: 'column', gap: 8,
		padding: '16px 18px 14px', borderBottom: `1px solid ${C.line}`,
		background: 'rgba(253,250,244,0.92)', backdropFilter: 'blur(8px)',
	},
	topBarRow: { display: 'flex', alignItems: 'center', gap: 12, width: '100%' },
	progressPill: {
		padding: '4px 10px', borderRadius: 999, marginRight: 8,
		background: 'rgba(255,122,99,0.12)', border: `1px solid rgba(255,122,99,0.25)`,
	},
	progressPct: { fontSize: 12, fontWeight: 700, color: C.coralDeep, fontVariantNumeric: 'tabular-nums' },
	progressWrap: { width: '100%', paddingLeft: 48 },
	progressLabel: { fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 500 },
	progressTrack: {
		height: 4, borderRadius: 999, background: C.line, overflow: 'hidden',
	},
	progressFill: {
		height: '100%', borderRadius: 999,
		background: `linear-gradient(90deg, ${C.coral}, ${C.coralDeep})`,
		transition: 'width 0.45s ease',
	},
	logoMark: {
		width: 36, height: 36, borderRadius: 11, flexShrink: 0,
		background: `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})`,
		display: 'grid', placeItems: 'center', color: '#fff',
		fontFamily: "'Clash Display', sans-serif", fontWeight: 700, fontSize: 18,
		boxShadow: '0 6px 16px rgba(232,84,59,0.28)',
	},
	brand: { fontFamily: "'Clash Display', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: -0.3, lineHeight: 1.2 },
	tagline: { fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 1.35 },
	stream: { position: 'relative', zIndex: 1, flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 18px 12px', display: 'flex', flexDirection: 'column', width: '100%' },
	suggestRow: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, width: '100%' },
	suggestCard: {
		flex: 1, textAlign: 'left', cursor: 'pointer',
		border: `1.5px solid ${C.line}`, borderRadius: 16, padding: '14px 14px',
		background: C.card, boxShadow: '0 4px 16px rgba(43,38,36,0.05)',
	},
	chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
	chip: {
		padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
		border: `1.5px solid ${C.coral}`, background: 'rgba(255,122,99,0.08)',
		color: C.coralDeep, fontSize: 13, fontWeight: 600, fontFamily: "'Satoshi', sans-serif",
	},
	userBubble: {
		maxWidth: '85%', minWidth: 0, wordBreak: 'break-word', background: 'rgba(255,122,99,0.14)', color: C.charcoal,
		borderRadius: 16, borderBottomRightRadius: 6, padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
	},
	aiBubble: {
		maxWidth: '90%', background: C.card, border: `1px solid ${C.line}`,
		borderRadius: 16, borderBottomLeftRadius: 6, padding: '11px 14px', lineHeight: 1.5,
		boxShadow: '0 4px 16px rgba(43,38,36,0.05)',
	},
	typing: { color: C.muted, fontSize: 12.5, margin: '2px 4px 8px', fontStyle: 'italic' },
	buildingCard: {
		marginTop: 4, width: '100%', background: C.card, border: `1px solid ${C.line}`,
		borderRadius: 16, padding: '14px 16px', boxShadow: '0 4px 16px rgba(43,38,36,0.05)',
		display: 'flex', flexDirection: 'column', gap: 10,
	},
	buildStep: { display: 'flex', alignItems: 'center', gap: 10 },
	stepDone: {
		width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
		display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700,
		background: 'rgba(86,162,116,0.15)', color: C.moss,
	},
	stepActive: {
		width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
		display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700,
		background: 'rgba(255,122,99,0.15)', color: C.coral,
	},
	stepPending: {
		width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
		display: 'grid', placeItems: 'center', fontSize: 11,
		background: 'rgba(138,129,123,0.12)', color: C.muted,
	},
	footer: {
		position: 'relative', zIndex: 1,
		borderTop: `1px solid ${C.line}`, padding: '12px 16px 16px',
		background: C.card, boxShadow: '0 -8px 24px rgba(43,38,36,0.04)',
	},
	buildBtn: {
		width: '100%', padding: '13px 18px', borderRadius: 14, border: 'none', cursor: 'pointer', marginBottom: 10,
		background: `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})`, color: '#fff', fontSize: 15.5, fontWeight: 700,
		fontFamily: "'Clash Display', sans-serif", boxShadow: '0 10px 24px rgba(232,84,59,0.32)',
	},
	buildBtnDisabled: {
		width: '100%', padding: '13px 18px', borderRadius: 14, border: 'none', cursor: 'default', marginBottom: 10,
		background: C.muted, color: '#fff', fontSize: 15.5, fontWeight: 700, fontFamily: "'Clash Display', sans-serif",
	},
	inputRow: { display: 'flex', alignItems: 'center', gap: 8 },
	input: {
		flex: 1, padding: '12px 14px', borderRadius: 14, border: `1px solid ${C.line}`,
		fontSize: 14, background: C.cream, color: C.charcoal, fontFamily: "'Satoshi', sans-serif", outline: 'none',
	},
	sendBtn: {
		width: 42, height: 42, flexShrink: 0, borderRadius: 12, border: 'none', cursor: 'pointer',
		background: `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})`, color: '#fff', fontSize: 18, fontWeight: 700,
	},
}
