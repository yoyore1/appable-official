/*--------------------------------------------------------------------------------------
 *  Launch readiness checklist — mirrors web ReadinessChecklist (interactive).
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react'
import type {
	AppReadinessAuditDto, ReadinessDecision, ReadinessItemDto, ReadinessStatus,
} from '../../../../../../../workbench/contrib/void/common/readinessTypes.js'
import type { IAppableBuilderService } from '../../../../../../../workbench/contrib/void/common/appableBuilderTypes.js'

const C = {
	card: '#FFFFFF',
	charcoal: '#2B2624',
	muted: '#8A817B',
	moss: '#56A274',
	amber: '#C8902A',
	line: '#EFE7DA',
	coral: '#FF7A63',
	violet: '#7C5CDB',
	red: '#D64545',
}

const STATUS_LABEL: Record<ReadinessStatus, string> = {
	have: 'Ready',
	partial: 'Preview only',
	missing: 'To plan',
}

const STATUS_DOT: Record<ReadinessStatus, string> = {
	have: C.moss,
	partial: C.amber,
	missing: C.muted,
}

const DECISION_OPTIONS: ReadinessDecision[] = ['done', 'yes', 'later', 'skip']

const DECISION_LABEL: Record<ReadinessDecision, string> = {
	done: 'Done',
	yes: 'Need this',
	later: 'Later',
	skip: 'Skip',
}

const DECISION_COLOR: Record<ReadinessDecision, string> = {
	done: C.moss,
	yes: C.violet,
	later: C.amber,
	skip: C.red,
}

function Row({
	item,
	onPin,
	onDecision,
	busy,
}: {
	item: ReadinessItemDto
	onPin?: (item: ReadinessItemDto) => void
	onDecision?: (item: ReadinessItemDto, decision: ReadinessDecision) => void
	busy?: boolean
}) {
	const decision = item.userState?.decision
	const discussed = item.userState?.discussed

	return (
		<div style={{
			border: `1px solid ${item.pinned ? 'rgba(255,122,99,0.35)' : C.line}`,
			borderRadius: 12,
			padding: 12,
			marginBottom: 8,
			background: item.pinned ? 'rgba(255,122,99,0.06)' : C.card,
			borderLeft: item.pinned ? `3px solid ${C.coral}` : undefined,
		}}>
			<div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
				<span style={{
					width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
					background: decision ? DECISION_COLOR[decision] : STATUS_DOT[item.status],
				}} />
				<div style={{ minWidth: 0, flex: 1 }}>
					<button
						type="button"
						disabled={busy || !onPin}
						onClick={() => onPin?.(item)}
						style={{
							display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
							background: 'none', border: 'none', padding: 0, cursor: onPin ? 'pointer' : 'default',
							textAlign: 'left', width: '100%',
						}}
					>
						<span style={{ fontSize: 12, fontWeight: 700, color: C.charcoal }}>{item.title}</span>
						<span style={{
							fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
							color: C.muted,
						}}>
							{STATUS_LABEL[item.status]}
						</span>
						{item.pinned && (
							<span style={{ fontSize: 9, color: C.coral, fontWeight: 700 }}>Pinned</span>
						)}
						{item.priority === 'launch_blocker' && (
							<span style={{ fontSize: 9, color: C.coral, fontWeight: 700 }}>Launch blocker</span>
						)}
						{discussed && !decision && (
							<span style={{ fontSize: 9, color: C.moss, fontWeight: 700 }}>Discussed</span>
						)}
						{decision && (
							<span style={{
								fontSize: 9, fontWeight: 700, color: DECISION_COLOR[decision],
								textTransform: 'uppercase',
							}}>
								{DECISION_LABEL[decision]}
							</span>
						)}
					</button>
					<p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.45, color: C.muted }}>{item.plainWhy}</p>

					{onDecision && (
						<div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
							{DECISION_OPTIONS.map((d) => (
								<button
									key={d}
									type="button"
									disabled={busy}
									onClick={() => onDecision(item, d)}
									style={{
										fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
										border: `1px solid ${decision === d ? DECISION_COLOR[d] : C.line}`,
										background: decision === d ? `${DECISION_COLOR[d]}18` : C.card,
										color: decision === d ? DECISION_COLOR[d] : C.muted,
										cursor: busy ? 'wait' : 'pointer',
									}}
								>
									{DECISION_LABEL[d]}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export const ReadinessPanel = ({
	audit: initialAudit,
	projectId,
	appableService,
	embedded = false,
}: {
	audit: AppReadinessAuditDto
	projectId?: string | null
	appableService?: IAppableBuilderService
	embedded?: boolean
}) => {
	const [audit, setAudit] = useState(initialAudit)
	const [busy, setBusy] = useState(false)

	const canPatch = Boolean(projectId && projectId !== 'sample' && appableService)

	const patch = async (body: {
		pinnedItemId?: string | null
		itemId?: string
		discussed?: boolean
		decision?: ReadinessDecision | null
	}) => {
		if (!canPatch || !projectId || !appableService) { return }
		setBusy(true)
		try {
			const res = await appableService.patchReadiness({ projectId, ...body })
			if (res.readiness) { setAudit(res.readiness) }
		} finally {
			setBusy(false)
		}
	}

	const onPin = (item: ReadinessItemDto) => {
		void patch({
			pinnedItemId: item.pinned ? null : item.id,
			itemId: item.id,
			discussed: true,
		})
	}

	const onDecision = (item: ReadinessItemDto, decision: ReadinessDecision) => {
		const current = item.userState?.decision ?? null
		void patch({
			itemId: item.id,
			discussed: true,
			decision: current === decision ? null : decision,
		})
	}

	const blockers = audit.launchBlockers.length
		? audit.launchBlockers
		: audit.topGaps.filter((g) => g.priority === 'launch_blocker')
	const soon = audit.items.filter(
		(i) => i.priority !== 'launch_blocker' && !blockers.some((b) => b.id === i.id)
	)

	return (
		<div style={embedded ? { marginTop: 0 } : {
			marginTop: 12,
			padding: 14,
			borderRadius: 16,
			border: `1px solid ${C.line}`,
			background: C.card,
		}}>
			{!embedded && (
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
					<div style={{ fontFamily: "'Clash Display', sans-serif", fontSize: 15, fontWeight: 700, color: C.charcoal }}>
						Launch readiness
					</div>
					<div style={{ fontSize: 11, color: C.muted }}>
						<span style={{ color: C.moss }}>{audit.haveCount} ready</span>
						{' · '}
						<span style={{ color: C.amber }}>{audit.partialCount} partial</span>
						{' · '}
						<span>{audit.discussedCount ?? 0} discussed</span>
						{' · '}
						<span>{audit.missingCount} to plan</span>
					</div>
				</div>
			)}

			{blockers.length > 0 && (
				<>
					<div style={{ fontSize: 10, fontWeight: 700, color: C.coral, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
						Before you ship
					</div>
					{blockers.map((item) => (
						<Row
							key={item.id}
							item={item}
							onPin={canPatch ? onPin : undefined}
							onDecision={canPatch ? onDecision : undefined}
							busy={busy}
						/>
					))}
				</>
			)}

			{soon.length > 0 && (
				<>
					<div style={{ fontSize: 10, fontWeight: 700, color: C.muted, margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
						Also worth planning
					</div>
					{soon.map((item) => (
						<Row
							key={item.id}
							item={item}
							onPin={canPatch ? onPin : undefined}
							onDecision={canPatch ? onDecision : undefined}
							busy={busy}
						/>
					))}
				</>
			)}

			<p style={{ margin: '10px 0 0', fontSize: 10, color: C.muted, lineHeight: 1.4 }}>
				{canPatch
					? 'Tap a line to pin it, or mark Done / Need this / Later / Skip — synced with getappable.com.'
					: 'Connect to getappable.com to sync checklist progress with web.'}
			</p>
		</div>
	)
}
