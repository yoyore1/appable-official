/*--------------------------------------------------------------------------------------
 *  Post-build right panel — mirrors web BuildSidePanel (UI only, no connect backend).
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, useState } from 'react'
import type { BuildResult } from '../../../../../../../workbench/contrib/void/common/appableBuilderTypes.js'
import type { IAppableBuilderService } from '../../../../../../../workbench/contrib/void/common/appableBuilderTypes.js'
import type { AppReadinessAuditDto } from '../../../../../../../workbench/contrib/void/common/readinessTypes.js'
import {
	CONNECTOR_ACCENT,
	CONNECTOR_CATEGORY_LABELS,
	type ConnectorCategory,
	type ConnectorId,
	getCatalogEntry,
	MARKETPLACE_CATALOG,
} from '../../../../../../../workbench/contrib/void/common/connectorCatalog.js'
import { ReadinessPanel } from './ReadinessPanel.js'

const C = {
	cream: '#FDFAF4',
	card: '#FFFFFF',
	coral: '#FF7A63',
	coralDeep: '#E8543B',
	charcoal: '#2B2624',
	muted: '#8A817B',
	moss: '#56A274',
	line: '#EFE7DA',
	sand: '#F5EFE4',
}

/** Demo project connectors shown in UI until backend is wired. */
const DEMO_ON_PROJECT: ConnectorId[] = ['supabase', 'posthog', 'sentry']
const DEMO_CONNECTED: ConnectorId[] = ['supabase']

// ---- shared primitives -------------------------------------------------------

function Chevron({ open }: { open: boolean }) {
	return (
		<span style={{
			display: 'inline-block', fontSize: 10, color: C.muted,
			transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
		}}>▼</span>
	)
}

function PanelHeader({
	title, subtitle, icon, open, onToggle,
}: {
	title: string
	subtitle?: string
	icon: string
	open: boolean
	onToggle: () => void
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			style={{
				display: 'flex', width: '100%', alignItems: 'center', gap: 12,
				padding: '14px 16px', border: 'none', background: 'transparent',
				cursor: 'pointer', textAlign: 'left',
			}}
		>
			<span style={{
				width: 32, height: 32, borderRadius: 12, flexShrink: 0,
				display: 'grid', placeItems: 'center', background: C.card,
				boxShadow: '0 2px 8px rgba(43,38,36,0.08)', border: `1px solid ${C.line}`,
				fontSize: 14,
			}}>{icon}</span>
			<span style={{ flex: 1, minWidth: 0 }}>
				<span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.charcoal }}>{title}</span>
				{subtitle && (
					<span style={{ display: 'block', marginTop: 2, fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{subtitle}
					</span>
				)}
			</span>
			<Chevron open={open} />
		</button>
	)
}

function CopyField({ label, value }: { label: string; value: string }) {
	const [copied, setCopied] = useState(false)
	return (
		<div>
			<div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
				<div style={{
					flex: 1, fontSize: 9, fontFamily: 'ui-monospace, monospace', color: C.charcoal,
					background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px',
					overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
				}}>{value}</div>
				<button
					type="button"
					onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
					style={{
						fontSize: 9, fontWeight: 700, padding: '8px 10px', borderRadius: 8,
						border: `1px solid ${C.line}`, background: C.card, color: C.muted, cursor: 'pointer',
					}}
				>{copied ? '✓' : 'Copy'}</button>
			</div>
		</div>
	)
}

// ---- Xcode / device preview --------------------------------------------------

function XcodePhoneGuide({ result }: { result: BuildResult }) {
	const isMac = result.shipPath === 'mac'
	const steps = isMac
		? [
			{ n: 1, title: 'Open in Xcode', hint: 'Your project is saved locally.', body: result.projectDir },
			{ n: 2, title: 'Pick a simulator', hint: 'iPhone 16 or any device from the scheme menu.' },
			{ n: 3, title: 'Press Run (⌘R)', hint: 'Xcode builds and launches the iOS Simulator with your native app.' },
		]
		: [
			{ n: 1, title: 'Push to GitHub', hint: 'codemagic.yaml is in your project folder.' },
			{ n: 2, title: 'Run on Codemagic', hint: 'Cloud Mac builds your .ipa — no local Xcode needed.' },
			{ n: 3, title: 'Install via TestFlight', hint: 'Accept the invite on your iPhone to test touch & native features.' },
		]

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			{steps.map((s) => (
				<div key={s.n} style={{
					borderRadius: 12, border: `1px solid ${s.n === 1 ? 'rgba(255,122,99,0.3)' : C.line}`,
					background: s.n === 1 ? 'rgba(255,122,99,0.05)' : C.card,
					padding: 12, borderLeft: s.n === 1 ? `3px solid ${C.coral}` : undefined,
				}}>
					<div style={{ fontSize: 11, fontWeight: 700, color: C.charcoal }}>
						<span style={{ color: C.muted }}>{s.n}.</span> {s.title}
					</div>
					{s.hint && <div style={{ marginTop: 4, fontSize: 10, color: C.muted, lineHeight: 1.45 }}>{s.hint}</div>}
					{'body' in s && s.body && (
						<div style={{
							marginTop: 8, fontSize: 9, fontFamily: 'ui-monospace, monospace', color: C.charcoal,
							background: C.sand, borderRadius: 8, padding: '8px 10px', wordBreak: 'break-all',
						}}>{s.body}</div>
					)}
				</div>
			))}
			<p style={{ margin: 0, fontSize: 10, color: C.muted, lineHeight: 1.45 }}>
				{isMac
					? 'Unlike web Expo Go, this is your real SwiftUI app in Apple\'s Simulator.'
					: 'On Windows, TestFlight is how you preview on a real iPhone.'}
			</p>
		</div>
	)
}

// ---- connector accordion inner cards (UI mock) --------------------------------

function SupabaseCardUI() {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			<p style={{ margin: 0, fontSize: 10, color: C.muted, lineHeight: 1.45 }}>
				https://xxxx.supabase.co
			</p>
			<p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: C.moss }}>
				<span style={{ width: 6, height: 6, borderRadius: '50%', background: C.moss }} />
				Profiles ready · run Build to wire sign-in
			</p>
			<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
				<button type="button" style={{
					flex: 1, padding: '10px 12px', borderRadius: 12, border: 'none',
					background: C.charcoal, color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'default',
				}}>Open dashboard ↗</button>
				<button type="button" style={{
					padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.line}`,
					background: C.card, color: C.muted, fontSize: 10, fontWeight: 600, cursor: 'default',
				}}>Disconnect</button>
			</div>
			<div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
				<p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 600, color: C.charcoal }}>Supabase webhook</p>
				<p style={{ margin: '0 0 8px', fontSize: 10, color: C.muted, lineHeight: 1.45 }}>
					In Supabase, add a webhook on <code style={{ background: C.sand, padding: '1px 4px', borderRadius: 4 }}>appable_profiles</code> for INSERT events.
				</p>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<CopyField label="URL" value="https://app.example/api/webhooks/supabase/…" />
					<CopyField label="Webhook secret" value="whsec_••••••••••••" />
				</div>
			</div>
			<p style={{ margin: 0, fontSize: 9, color: C.muted, lineHeight: 1.4 }}>
				Before you start: Google/Apple login needs extra setup in Supabase Auth — see web Integrations when connecting.
			</p>
		</div>
	)
}

function RevenueCatCardUI({ appName }: { appName: string }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			<p style={{ margin: 0, fontSize: 10, color: C.muted, lineHeight: 1.45 }}>
				In-app purchases & subscriptions for {appName}. Syncs with Supabase via webhooks.
			</p>
			<button type="button" style={{
				width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none',
				background: '#6366F1', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'default',
			}}>Connect RevenueCat</button>
		</div>
	)
}

function SdkConnectorCardUI({ id, appName }: { id: ConnectorId; appName: string }) {
	const def = getCatalogEntry(id)
	const connected = DEMO_CONNECTED.includes(id)
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			<p style={{ margin: 0, fontSize: 10, color: C.muted, lineHeight: 1.45 }}>{def.role}</p>
			{connected && (
				<div style={{
					borderRadius: 10, border: '1px solid rgba(86,162,116,0.35)', background: 'rgba(86,162,116,0.08)',
					padding: '8px 10px', fontSize: 10, color: C.moss,
				}}>
					<span style={{ fontWeight: 600 }}>Weekly reports: </span>Ready. Charts will show in Reports.
				</div>
			)}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
				<button type="button" style={{
					padding: '10px', borderRadius: 12, border: `1px solid ${C.line}`,
					background: C.card, fontSize: 10, fontWeight: 600, color: C.charcoal, cursor: 'default',
				}}>Explain</button>
				<button type="button" style={{
					padding: '10px', borderRadius: 12, border: 'none',
					background: C.charcoal, fontSize: 10, fontWeight: 600, color: '#fff', cursor: 'default',
				}}>Add to app</button>
			</div>
			<button type="button" style={{
				width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none',
				background: CONNECTOR_ACCENT[id], color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'default',
			}}>{def.connectionsLabel}</button>
		</div>
	)
}

function ConnectorAccordion({
	id, open, onToggle, connected,
	children,
}: {
	id: ConnectorId
	open: boolean
	onToggle: () => void
	connected?: boolean
	children: React.ReactNode
}) {
	const def = getCatalogEntry(id)
	const accent = CONNECTOR_ACCENT[id]
	const subtitle = connected
		? (id === 'supabase' ? 'appable' : id === 'revenuecat' ? 'Key pk_••••' : 'Connected')
		: def.connectionsLabel

	return (
		<div style={{
			borderRadius: 14, border: `1px solid ${C.line}`, background: C.card, overflow: 'hidden',
		}}>
			<button
				type="button"
				onClick={onToggle}
				style={{
					display: 'flex', width: '100%', alignItems: 'center', gap: 10,
					padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
				}}
			>
				<span style={{
					width: 28, height: 28, borderRadius: 8, flexShrink: 0,
					display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 800,
					background: `${accent}18`, color: accent,
				}}>
					{def.displayName.slice(0, 2).toUpperCase()}
				</span>
				<span style={{ flex: 1, minWidth: 0 }}>
					<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<span style={{ fontSize: 11, fontWeight: 700, color: C.charcoal }}>{def.displayName}</span>
						{connected && (
							<span style={{
								fontSize: 8, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
								color: C.moss, display: 'flex', alignItems: 'center', gap: 4,
							}}>
								<span style={{ width: 5, height: 5, borderRadius: '50%', background: C.moss }} />
								Live
							</span>
						)}
					</span>
					<span style={{ display: 'block', fontSize: 10, color: C.muted, marginTop: 2 }}>{subtitle}</span>
				</span>
				<Chevron open={open} />
			</button>
			{open && (
				<div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.line}` }}>
					<div style={{ paddingTop: 12 }}>{children}</div>
				</div>
			)}
		</div>
	)
}

// ---- marketplace modal (UI only) ----------------------------------------------

function MarketplaceModal({
	open, onClose, selections, onToggle,
}: {
	open: boolean
	onClose: () => void
	selections: ConnectorId[]
	onToggle: (id: ConnectorId) => void
}) {
	const [query, setQuery] = useState('')
	const [category, setCategory] = useState<ConnectorCategory | 'all'>('all')

	const items = useMemo(() => {
		const q = query.trim().toLowerCase()
		return MARKETPLACE_CATALOG.filter((def) => {
			if (category !== 'all' && def.category !== category) return false
			if (!q) return true
			return def.displayName.toLowerCase().includes(q) || def.role.toLowerCase().includes(q)
		})
	}, [query, category])

	if (!open) return null

	return (
		<div
			style={{
				position: 'fixed', inset: 0, zIndex: 100,
				background: 'rgba(43,38,36,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
			}}
			onClick={onClose}
		>
			<div
				style={{
					width: '100%', maxWidth: 420, maxHeight: '85vh', background: C.cream,
					borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column',
					boxShadow: '0 -8px 32px rgba(43,38,36,0.15)',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
					<div>
						<div style={{ fontSize: 14, fontWeight: 700, color: C.charcoal }}>🛒 Integration marketplace</div>
						<div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Browse and add what you want — nothing connects until you choose.</div>
					</div>
					<button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: C.muted }}>×</button>
				</div>
				<div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.line}` }}>
					<input
						type="search"
						placeholder="Search integrations…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						style={{
							width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.line}`,
							fontSize: 12, background: C.card, outline: 'none',
						}}
					/>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
						<button type="button" onClick={() => setCategory('all')} style={chipStyle(category === 'all')}>All</button>
						{(Object.entries(CONNECTOR_CATEGORY_LABELS) as [ConnectorCategory, string][]).map(([k, label]) => (
							<button key={k} type="button" onClick={() => setCategory(k)} style={chipStyle(category === k)}>{label}</button>
						))}
					</div>
				</div>
				<div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>
					{items.map((def) => {
						const selected = selections.includes(def.id)
						return (
							<div key={def.id} style={{
								display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0',
								borderBottom: `1px solid ${C.line}`,
							}}>
								<span style={{
									width: 36, height: 36, borderRadius: 10, flexShrink: 0,
									display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800,
									background: `${CONNECTOR_ACCENT[def.id]}18`, color: CONNECTOR_ACCENT[def.id],
								}}>{def.displayName.slice(0, 2).toUpperCase()}</span>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: 12, fontWeight: 700, color: C.charcoal }}>{def.displayName}</div>
									<div style={{ fontSize: 10, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{def.role}</div>
								</div>
								<button
									type="button"
									onClick={() => onToggle(def.id)}
									style={{
										width: 32, height: 32, borderRadius: 10, flexShrink: 0, border: 'none', cursor: 'pointer',
										background: selected ? C.moss : C.line, color: selected ? '#fff' : C.muted,
										fontSize: 14, fontWeight: 700,
									}}
								>{selected ? '✓' : '+'}</button>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

function chipStyle(active: boolean): React.CSSProperties {
	return {
		padding: '5px 10px', borderRadius: 999, fontSize: 9, fontWeight: 700, cursor: 'pointer',
		border: `1px solid ${active ? C.coral : C.line}`,
		background: active ? 'rgba(255,122,99,0.12)' : C.card,
		color: active ? C.coralDeep : C.muted,
	}
}

// ---- main panel --------------------------------------------------------------

export function VoidBuildSidePanel({
	result,
	readiness,
	projectId,
	appableService,
}: {
	result: BuildResult
	readiness: AppReadinessAuditDto | null | undefined
	projectId: string | null
	appableService: IAppableBuilderService
}) {
	const [previewOpen, setPreviewOpen] = useState(false)
	const [integrationsOpen, setIntegrationsOpen] = useState(true)
	const [checklistOpen, setChecklistOpen] = useState(true)
	const [marketplaceOpen, setMarketplaceOpen] = useState(false)
	const [selections, setSelections] = useState<ConnectorId[]>(DEMO_ON_PROJECT)
	const [openConnector, setOpenConnector] = useState<ConnectorId | null>('supabase')

	const visibleIds = selections
	const checklistSubtitle = readiness
		? `${readiness.discussedCount ?? 0} discussed · ${readiness.missingCount} to plan`
		: undefined

	function toggleConnector(id: ConnectorId) {
		setOpenConnector((prev) => (prev === id ? null : id))
	}

	function renderConnectorBody(id: ConnectorId) {
		if (id === 'supabase') return <SupabaseCardUI />
		if (id === 'revenuecat') return <RevenueCatCardUI appName={result.appName} />
		return <SdkConnectorCardUI id={id} appName={result.appName} />
	}

	return (
		<aside style={{
			width: 300, flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
			borderLeft: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.55)',
		}}>
			<div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
				<PanelHeader
					title="Preview on your phone"
					subtitle="Test touch & native features on a real device"
					icon="📱"
					open={previewOpen}
					onToggle={() => setPreviewOpen((v) => !v)}
				/>
				{previewOpen && (
					<div style={{ padding: '4px 16px 16px', borderBottom: `1px solid rgba(239,231,218,0.6)` }}>
						<XcodePhoneGuide result={result} />
					</div>
				)}

				<PanelHeader
					title="Integrations"
					subtitle={visibleIds.length > 0 ? `${visibleIds.length} on your project` : 'Browse the marketplace'}
					icon="🔗"
					open={integrationsOpen}
					onToggle={() => setIntegrationsOpen((v) => !v)}
				/>
				{integrationsOpen && (
					<div style={{ padding: '4px 16px 16px', borderBottom: `1px solid rgba(239,231,218,0.6)` }}>
						<button
							type="button"
							onClick={() => setMarketplaceOpen(true)}
							style={{
								width: '100%', padding: '12px 16px', borderRadius: 16, border: 'none',
								background: C.charcoal, color: '#fff', fontSize: 11, fontWeight: 600,
								cursor: 'pointer', marginBottom: 12,
								boxShadow: '0 4px 18px rgba(43,38,36,0.25)',
							}}
						>🛒 Browse marketplace</button>

						<div style={{
							borderRadius: 16, border: `1px solid ${C.line}`, background: `linear-gradient(135deg, ${C.card}, ${C.sand})`,
							padding: 12, marginBottom: 12,
						}}>
							<div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
								<span style={{
									width: 28, height: 28, borderRadius: 8, background: 'rgba(255,122,99,0.12)',
									display: 'grid', placeItems: 'center', fontSize: 14,
								}}>✦</span>
								<div>
									<div style={{ fontSize: 11, fontWeight: 600, color: C.charcoal }}>You might like RevenueCat</div>
									<div style={{ fontSize: 10, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
										In-app purchases and subscriptions — syncs to Supabase via webhooks.
									</div>
									<button
										type="button"
										onClick={() => setMarketplaceOpen(true)}
										style={{
											marginTop: 8, width: '100%', padding: '8px', borderRadius: 12,
											border: `1px solid ${C.line}`, background: C.card, fontSize: 10, fontWeight: 600,
											color: C.charcoal, cursor: 'pointer',
										}}
									>Browse marketplace</button>
								</div>
							</div>
						</div>

						{visibleIds.length === 0 ? (
							<p style={{
								margin: 0, padding: 16, textAlign: 'center', fontSize: 11, color: C.muted,
								border: `1px dashed ${C.line}`, borderRadius: 16, background: 'rgba(255,255,255,0.6)',
							}}>
								No integrations yet. Open the marketplace and add only what you want.
							</p>
						) : (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
								{visibleIds.map((id) => (
									<ConnectorAccordion
										key={id}
										id={id}
										open={openConnector === id}
										onToggle={() => toggleConnector(id)}
										connected={DEMO_CONNECTED.includes(id)}
									>
										{renderConnectorBody(id)}
									</ConnectorAccordion>
								))}
							</div>
						)}
					</div>
				)}

				{readiness && (
					<>
						<PanelHeader
							title="Launch checklist"
							subtitle={checklistSubtitle}
							icon="📋"
							open={checklistOpen}
							onToggle={() => setChecklistOpen((v) => !v)}
						/>
						{checklistOpen && (
							<div style={{ padding: '4px 12px 16px' }}>
								<ReadinessPanel
									audit={readiness}
									projectId={projectId}
									appableService={appableService}
									embedded
								/>
							</div>
						)}
					</>
				)}
			</div>

			<MarketplaceModal
				open={marketplaceOpen}
				onClose={() => setMarketplaceOpen(false)}
				selections={selections}
				onToggle={(id) => setSelections((prev) =>
					prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
				)}
			/>
		</aside>
	)
}
