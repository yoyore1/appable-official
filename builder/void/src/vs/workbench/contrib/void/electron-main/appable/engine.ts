/*--------------------------------------------------------------------------------------
 *  Appable Builder — core build loop (electron-main).
 *  validate user → fetch master prompt → inject similar builds → generate SwiftUI
 *  (Kimi K2.6 / deterministic) → error-fixing loop → ship (Mac Xcode / Windows
 *  Codemagic) → report usage (build/review split) → write to platform cache.
 *  Emits friendly ProgressEvents; raw machinery is sent as `detail`.
 *--------------------------------------------------------------------------------------*/

import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, rm } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import * as os from 'os';

import {
	BuildMode, BuildOptions, BuildResult, ChatRequest, ChatResponse, InterviewAnswers,
	MasterBuildPrompt, ProgressEvent, ShipPath, Vibe,
} from '../../common/appableBuilderTypes.js';
import { INTERVIEW_QUESTIONS } from '../../common/appableInterview.js';
import { buildMasterPromptFromInterview } from './masterPlan.js';
import { GeneratedFile, bundleIdFor, generateSwiftUIProject } from './swiftgen.js';
import { SWIFT_DESIGN_RULES } from './swiftDesignPrompt.js';
import { loadAppableEnv } from './loadEnv.js';

const run = promisify(execFile);
type Emit = (e: ProgressEvent) => void;

// ---- config (lazy — after loadAppableEnv reads void/.env.local) -------------
type EngineCfg = {
	buildModel: { baseUrl: string | undefined; key: string | undefined; name: string };
	platformUrl: string | undefined;
	platformKey: string;
	baseBudget: number;
	fullBudget: number;
	maxFixRounds: number;
	split: number;
	outDir: string;
};
type EngineHas = { buildModel: boolean; platform: boolean };

let _cfg: EngineCfg | undefined;
let _has: EngineHas | undefined;

function env(k: string): string | undefined {
	const v = process.env[k];
	return v && v.trim() !== '' ? v.trim() : undefined;
}
function numEnv(k: string, d: number): number {
	const v = env(k); const n = v ? Number(v) : NaN;
	return Number.isFinite(n) ? n : d;
}

function cfg(): EngineCfg {
	if (!_cfg) {
		_cfg = {
			buildModel: { baseUrl: env('BUILD_MODEL_BASE_URL'), key: env('BUILD_MODEL_KEY'), name: env('BUILD_MODEL_NAME') ?? 'moonshotai/Kimi-K2.6' },
			platformUrl: env('APPABLE_API_URL'),
			platformKey: env('APPABLE_API_KEY') ?? 'dev-service-key',
			baseBudget: numEnv('BASE_BUILD_BUDGET', 40000),
			fullBudget: numEnv('FULL_BUILD_BUDGET', 200000),
			maxFixRounds: numEnv('ERROR_FIX_MAX_ROUNDS', 6),
			split: numEnv('BUILD_REVIEW_SPLIT', 0.8),
			outDir: env('APPABLE_OUTPUT_DIR') ?? join(os.homedir(), 'AppableBuilds'),
		};
	}
	return _cfg;
}
function has(): EngineHas {
	if (!_has) {
		const c = cfg();
		_has = { buildModel: Boolean(c.buildModel.baseUrl && c.buildModel.key), platform: Boolean(c.platformUrl) };
	}
	return _has;
}

/** Call once with the Void app root so void/.env.local is found even if cwd differs. */
export function primeAppableEnv(appRoot?: string): void {
	loadAppableEnv(appRoot ? [appRoot] : []);
	_cfg = undefined;
	_has = undefined;
}

const sampleMasterPrompt: MasterBuildPrompt = {
	appName: 'PlantPal',
	description: 'A calm companion that reminds you to water your plants and tracks their health.',
	audience: 'Busy plant lovers who forget to water.',
	twist: null,
	features: ['Watering reminders', 'Plant journal', 'Care tips'],
	layoutArchetype: 'tracker-dashboard',
	vibe: 'Soft',
	colors: 'Sage green & cream',
	screens: ['Onboarding', 'Home', 'Watering reminders screen', 'Plant journal screen', 'Profile'],
	referenceApp: null,
};

// ---- platform client --------------------------------------------------------
interface PlatformUser { userId: string; email: string; name: string | null; buildPower: number; reviewBalance: number; dataSharingOptIn: boolean; depositPaid: boolean }

const DEV_MOCK_USER: PlatformUser = {
	userId: 'usr_dev',
	email: 'dev@appable.local',
	name: 'Dev',
	buildPower: 99_999,
	reviewBalance: 500,
	dataSharingOptIn: true,
	depositPaid: true,
};

/** Skip login API in local dev — project ID + service key is enough to test. */
function isDevBypass(): boolean {
	if (env('APPABLE_DEV_BYPASS') === 'true' || env('APPABLE_DEV_BYPASS') === '1') { return true; }
	const url = cfg().platformUrl?.toLowerCase() ?? '';
	return url.includes('localhost') || url.includes('127.0.0.1');
}

async function papi<T>(path: string, init: { method: string; body?: string }): Promise<T> {
	const res = await fetch(`${cfg().platformUrl}${path}`, {
		method: init.method,
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg().platformKey}` },
		body: init.body,
	});
	if (!res.ok) {
		const hint = await res.text().catch(() => '');
		throw new Error(`platform ${path} → ${res.status}${hint ? ` (${hint.slice(0, 120)})` : ''}`);
	}
	return res.json() as Promise<T>;
}

async function validateUser(email: string, password: string): Promise<PlatformUser> {
	if (!has().platform || isDevBypass()) { return { ...DEV_MOCK_USER, email: email || DEV_MOCK_USER.email }; }
	return papi<PlatformUser>('/api/auth/validate', { method: 'POST', body: JSON.stringify({ email, password }) });
}

async function fetchMasterPrompt(projectId: string): Promise<{ userId: string; masterPrompt: MasterBuildPrompt }> {
	if (!has().platform || projectId === 'sample') { return { userId: 'usr_mock', masterPrompt: sampleMasterPrompt }; }
	return papi('/api/projects/' + projectId + '/master-prompt', { method: 'GET' });
}

/** Pull a saved plan from the platform — used when the user pastes a project ID. */
export async function fetchPlanForProject(projectId: string): Promise<MasterBuildPrompt> {
	loadAppableEnv();
	const { masterPrompt } = await fetchMasterPrompt(projectId);
	return masterPrompt;
}

interface SimilarBuild { id: string; category: string; features: string[]; vibe: Vibe; colors: string; codeRef: string; score: number }
async function findSimilar(category: string, features: string[], vibe: Vibe, userId: string | null): Promise<SimilarBuild[]> {
	if (!has().platform) { return []; }
	try {
		const r = await papi<{ matches: SimilarBuild[] }>('/api/cache/similar', { method: 'POST', body: JSON.stringify({ spec: { category, features, vibe }, userId, limit: 3 }) });
		return r.matches ?? [];
	} catch { return []; }
}
async function reportUsage(userId: string, build: number, review: number): Promise<void> {
	if (!has().platform || userId === 'usr_mock') { return; }
	try { await papi('/api/usage', { method: 'POST', body: JSON.stringify({ userId, build, review }) }); } catch { /* best effort */ }
}
async function postCache(userId: string, category: string, mp: MasterBuildPrompt, codeRef: string): Promise<void> {
	if (!has().platform || userId === 'usr_mock') { return; }
	try { await papi('/api/cache', { method: 'POST', body: JSON.stringify({ userId, category, features: mp.features, vibe: mp.vibe, colors: mp.colors, codeRef }) }); } catch { /* best effort */ }
}

// ---- model (Kimi or deterministic) -----------------------------------------
function estimateTokens(s: string): number { return Math.ceil(s.length / 4); }

async function generateProject(mp: MasterBuildPrompt, mode: BuildMode, refs: SimilarBuild[], projectId?: string): Promise<GeneratedFile[]> {
	if (!has().buildModel) { return generateSwiftUIProject(mp, mode, projectId); }
	const refCtx = refs.length ? '\nReference structures (adapt, don\'t copy):\n' + refs.map((r) => `- ${r.category}/${r.vibe}: ${r.features.join(', ')}`).join('\n') : '';
	const system = 'You are an expert iOS engineer. Generate a complete native SwiftUI app as an XcodeGen project. Respond with STRICT JSON { "files": [ { "path", "contents" } ] }. Include project.yml, Resources/Info.plist, an @main App, themed SwiftUI views per screen, mock data. ' +
		(mode === 'full' ? 'FULL build: also wire Supabase auth/db, RevenueCat paywall, push.' : 'BASE build: UI only with mock data.') +
		'\n\n' + SWIFT_DESIGN_RULES + refCtx;
	try {
		const res = await fetch(`${cfg().buildModel.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg().buildModel.key}` },
			body: JSON.stringify({ model: cfg().buildModel.name, temperature: 0.3, max_tokens: 8000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(mp) }] }),
		});
		const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
		const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
		if (Array.isArray(parsed?.files) && parsed.files.length) { return parsed.files as GeneratedFile[]; }
	} catch { /* fall through */ }
	return generateSwiftUIProject(mp, mode, projectId);
}

// ---- assistant chat + interview → plan (Kimi) ------------------------------
interface KimiMsg { role: 'system' | 'user' | 'assistant'; content: string }

async function callKimi(messages: KimiMsg[], opts?: { json?: boolean; maxTokens?: number }): Promise<string | undefined> {
	if (!has().buildModel) { return undefined; }
	try {
		const res = await fetch(`${cfg().buildModel.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg().buildModel.key}` },
			body: JSON.stringify({
				model: cfg().buildModel.name,
				temperature: opts?.json ? 0.3 : 0.6,
				max_tokens: opts?.maxTokens ?? 1200,
				...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
				messages,
			}),
		});
		const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
		return data?.choices?.[0]?.message?.content ?? undefined;
	} catch { return undefined; }
}

export async function chatWithAgent(req: ChatRequest): Promise<ChatResponse> {
	loadAppableEnv();
	const planCtx = req.masterPrompt
		? `\nThe user's current app plan: ${JSON.stringify(req.masterPrompt)}. Give specific, friendly, non-technical advice to improve THIS app.`
		: '\nThe user has not picked an app yet. Help them shape an idea into a clear iOS app plan.';
	const system =
		'You are Appable\'s friendly building assistant. You help non-technical people design and improve a real iOS app. ' +
		'Be warm, concise, and concrete. Never mention tokens, APIs, or compiler details — talk in outcomes and screens.' + planCtx;
	const messages: KimiMsg[] = [{ role: 'system', content: system }, ...req.messages.map(m => ({ role: m.role, content: m.content }))];
	const reply = await callKimi(messages, { maxTokens: 700 });
	if (reply && reply.trim()) { return { reply: reply.trim(), model: 'kimi' }; }
	return {
		reply: 'I\'m offline right now (the build model isn\'t connected), but I saved what you said. ' +
			'Once your key is set I\'ll give tailored advice. For now: keep your app to 3 core screens and one clear action each.',
		model: 'offline',
	};
}

export async function generatePlanFromInterview(answers: InterviewAnswers): Promise<MasterBuildPrompt> {
	loadAppableEnv();
	const base = buildMasterPromptFromInterview(answers);

	const system =
		'You convert a short app interview into a structured iOS build plan. ' +
		'Respond with STRICT JSON: { "appName", "description", "audience", "twist" (null), "features": string[3], ' +
		'"layoutArchetype" (tracker-dashboard|swipe-cards|social-feed|chat-messaging|marketplace-shop|booking-scheduling|content-library|habit-streak|journal-notes|onboarding-heavy-utility), ' +
		'"vibe", "colors", "screens": string[4-6], "referenceApp" (null) }. ' +
		'Use the provided appName exactly. features MUST reflect what the user said. screens always include Onboarding and Home.';
	const user = JSON.stringify({ answers, deterministicDraft: base });
	const raw = await callKimi([{ role: 'system', content: system }, { role: 'user', content: user }], { json: true, maxTokens: 1200 });
	if (raw) {
		try {
			const p = JSON.parse(raw) as Partial<MasterBuildPrompt>;
			if (p.appName && Array.isArray(p.features) && p.features.length >= 2) {
				return {
					...base,
					...p,
					twist: p.twist ?? null,
					referenceApp: p.referenceApp ?? null,
					layoutArchetype: p.layoutArchetype ?? base.layoutArchetype,
					features: p.features.slice(0, 5),
					vibe: (p.vibe as Vibe) ?? base.vibe,
				};
			}
		} catch { /* fall through */ }
	}
	return base;
}

function interviewTurnsFromAnswers(answers: InterviewAnswers) {
	return INTERVIEW_QUESTIONS.map((q) => ({
		questionId: q.id,
		question: q.prompt,
		answer: String(answers[q.id] ?? '').trim(),
	})).filter((t) => t.answer.length > 0);
}

/** Persist Void interview + plan on the platform (legal URLs, ready status). */
export async function syncInterviewProject(
	answers: InterviewAnswers,
	masterPrompt: MasterBuildPrompt,
	email?: string,
	password?: string
): Promise<{ projectId: string }> {
	loadAppableEnv();
	if (!has().platform || isDevBypass()) {
		return { projectId: 'sample' };
	}
	const user = await validateUser(email ?? 'you@gmail.com', password ?? 'mock');
	const res = await papi<{ projectId: string }>('/api/projects/from-builder-interview', {
		method: 'POST',
		body: JSON.stringify({
			userId: user.userId,
			interview: interviewTurnsFromAnswers(answers),
			masterPrompt,
			target: 'swift',
		}),
	});
	return res;
}

// ---- compile / error checks -------------------------------------------------
interface CompileIssue { file: string; line?: number; message: string }

function staticCheck(files: GeneratedFile[]): CompileIssue[] {
	const issues: CompileIssue[] = [];
	for (const f of files) {
		if (!f.path.endsWith('.swift')) { continue; }
		const usesSwiftUI = /\bsome View\b|: View\b|@main|SwiftUI/.test(f.contents);
		if (usesSwiftUI && !/^\s*import SwiftUI/m.test(f.contents)) { issues.push({ file: f.path, message: 'missing import SwiftUI' }); }
		const open = (f.contents.match(/{/g) ?? []).length;
		const close = (f.contents.match(/}/g) ?? []).length;
		if (open !== close) { issues.push({ file: f.path, message: `unbalanced braces (${open}/${close})` }); }
	}
	return issues;
}

async function xcodeBuild(projectDir: string): Promise<CompileIssue[]> {
	try { await run('xcodegen', ['generate'], { cwd: projectDir }); }
	catch { return [{ file: 'project.yml', message: 'xcodegen not installed — run `brew install xcodegen`' }]; }
	try {
		const { stdout, stderr } = await run('xcodebuild', ['-sdk', 'iphonesimulator', 'build', 'CODE_SIGNING_ALLOWED=NO'], { cwd: projectDir, maxBuffer: 1024 * 1024 * 32 });
		return parseXcodeErrors(stdout + '\n' + stderr);
	} catch (e) {
		const o = String((e as { stdout?: string }).stdout ?? '') + String((e as { stderr?: string }).stderr ?? '');
		return parseXcodeErrors(o);
	}
}
function parseXcodeErrors(out: string): CompileIssue[] {
	const issues: CompileIssue[] = []; const re = /^(.*?\.swift):(\d+):\d+:\s+error:\s+(.*)$/gm; let m: RegExpExecArray | null;
	while ((m = re.exec(out))) { issues.push({ file: m[1], line: Number(m[2]), message: m[3] }); }
	return issues;
}
function mockFix(files: GeneratedFile[], issues: CompileIssue[]): GeneratedFile[] {
	const changed: GeneratedFile[] = [];
	for (const i of issues) {
		const f = files.find((x) => x.path === i.file); if (!f) { continue; }
		if (/missing import SwiftUI/.test(i.message) && !f.contents.startsWith('import SwiftUI')) { changed.push({ path: f.path, contents: 'import SwiftUI\n' + f.contents }); }
	}
	return changed;
}

// ---- codemagic (windows path) ----------------------------------------------
function codemagicYaml(mp: MasterBuildPrompt, app: string): string {
	return `# Generated by Appable Builder — cloud build for Windows users.
workflows:
  appable-ios:
    name: ${mp.appName} (iOS)
    instance_type: mac_mini_m2
    max_build_duration: 60
    environment:
      vars:
        XCODE_PROJECT: "${app}.xcodeproj"
        XCODE_SCHEME: "${app}"
      xcode: latest
    scripts:
      - name: Install XcodeGen
        script: brew install xcodegen
      - name: Generate Xcode project
        script: xcodegen generate
      - name: Build & archive
        script: |
          xcodebuild -project "$XCODE_PROJECT" -scheme "$XCODE_SCHEME" \\
            -sdk iphoneos -configuration Release archive \\
            -archivePath build/${app}.xcarchive CODE_SIGNING_ALLOWED=NO
    artifacts:
      - build/**/*.xcarchive
`;
}
function codemagicGuide(mp: MasterBuildPrompt): string[] {
	return [
		'You\'re on Windows, so we\'ll build your app in the cloud — it\'ll land on your iPhone.',
		'1. Create a free account at codemagic.io and sign in with GitHub.',
		`2. I added a codemagic.yaml to your ${mp.appName} project — push it to a new GitHub repo.`,
		'3. In Codemagic, add the repo and pick the \'Appable iOS\' workflow.',
		'4. Add your Apple ID / App Store Connect API key when prompted (one-time).',
		'5. Hit Start build — then accept the TestFlight invite on your iPhone.',
		'That\'s it — open TestFlight and your app is there. 🎉',
	];
}

// ---- fs ---------------------------------------------------------------------
async function writeProject(baseDir: string, folder: string, files: GeneratedFile[]): Promise<string> {
	const dir = resolve(baseDir, folder);
	await rm(dir, { recursive: true, force: true });
	for (const f of files) { const full = join(dir, f.path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, f.contents, 'utf8'); }
	return dir;
}
async function writeOne(dir: string, f: GeneratedFile): Promise<void> { const full = join(dir, f.path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, f.contents, 'utf8'); }

function detectShip(): { ship: ShipPath; canXcode: boolean } {
	const isMac = os.platform() === 'darwin';
	return { ship: isMac ? 'mac' : 'windows', canXcode: isMac };
}
function folderName(appName: string): string { return appName.replace(/[^a-zA-Z0-9]/g, '') || 'App'; }
function applyFixes(files: GeneratedFile[], fixes: GeneratedFile[]): GeneratedFile[] {
	const map = new Map(files.map((f) => [f.path, f]));
	for (const fix of fixes) { map.set(fix.path, fix); }
	return [...map.values()];
}

// ---- orchestrator -----------------------------------------------------------
function prog(emit: Emit, kind: ProgressEvent['kind'], message: string, percent: number): void {
	emit({ kind, message, percent });
}

export async function buildApp(opts: BuildOptions, emit: Emit): Promise<BuildResult> {
	loadAppableEnv();
	const osi = detectShip();
	prog(emit, 'heading', 'Appable Builder', 0);
	emit({ kind: 'detail', message: `platform=${os.platform()} ship=${osi.ship} model=${has().buildModel ? 'Kimi' : 'mock'} api=${has().platform ? 'live' : 'mock'}` });

	const devBypass = isDevBypass();
	prog(emit, 'step', devBypass ? 'Connecting to your plan…' : 'Signing you in…', 5);
	const user = await validateUser(opts.email ?? 'you@gmail.com', opts.password ?? 'mock');
	prog(emit, 'ok', devBypass
		? 'Dev mode — skipping login. Pulling your saved plan…'
		: `Welcome, ${user.name ?? user.email}. You have ${user.buildPower} build power.`, 10);
	if (user.buildPower <= 0) { throw new Error('You\'re out of build power — top up on getappable.com to keep going.'); }

	prog(emit, 'step', 'Getting your app plan…', 14);
	let mp: MasterBuildPrompt; let userId: string;
	if (opts.masterPrompt) {
		mp = opts.masterPrompt; userId = user.userId;
		emit({ kind: 'detail', message: 'using plan from in-Builder interview' });
	} else {
		const fetched = await fetchMasterPrompt(opts.projectId);
		mp = fetched.masterPrompt; userId = fetched.userId;
	}
	prog(emit, 'ok', `Building “${mp.appName}” — ${mp.vibe.toLowerCase()}, for ${mp.audience}`, 18);

	const category = (mp.features[0] ?? 'app').toLowerCase().split(' ')[0];
	const refs = await findSimilar(category, mp.features, mp.vibe, userId);
	if (refs.length) { emit({ kind: 'detail', message: `injected ${refs.length} reference build(s) from cache` }); }
	prog(emit, 'step', 'Designing your onboarding ✨', 24);

	// Codegen is the long pole — tick progress so the UI keeps moving.
	let genPct = 26;
	const genTick = setInterval(() => {
		genPct = Math.min(49, genPct + 1.2);
		emit({ kind: 'step', message: 'Generating SwiftUI…', percent: genPct });
	}, 1100);
	let files: GeneratedFile[];
	try {
		files = await generateProject(mp, opts.mode, refs, opts.projectId !== 'sample' ? opts.projectId : undefined);
	} finally {
		clearInterval(genTick);
	}
	prog(emit, 'step', 'Tailoring privacy & support for this app…', 50);
	prog(emit, 'step', 'Setting up your screens', 52);
	prog(emit, 'step', 'Making it beautiful…', 58);

	const folder = folderName(mp.appName);
	const projectDir = await writeProject(cfg().outDir, folder, files);
	prog(emit, 'ok', `Created ${files.length} files`, 70);
	emit({ kind: 'detail', message: `→ ${projectDir}` });

	let rounds = 0; let compiled = false;
	prog(emit, 'step', 'Running a quality check', 76);
	while (rounds < cfg().maxFixRounds) {
		const issues = osi.canXcode ? await xcodeBuild(projectDir) : staticCheck(files);
		if (issues.length === 0) { compiled = true; break; }
		rounds++;
		prog(emit, 'fixing', `Hit a small snag — fixing it now (round ${rounds}).`, 78 + Math.min(rounds * 3, 8));
		issues.forEach((i) => emit({ kind: 'detail', message: `${i.file}${i.line ? ':' + i.line : ''} — ${i.message}` }));
		const fixes = osi.canXcode && has().buildModel ? [] : mockFix(files, issues);
		if (fixes.length === 0) { emit({ kind: 'detail', message: 'no automatic fix available; stopping loop' }); break; }
		files = applyFixes(files, fixes);
		for (const f of fixes) { await writeOne(projectDir, f); }
	}
	prog(emit, compiled ? 'ok' : 'fixing', compiled
		? (rounds === 0 ? 'Everything compiled first try.' : `All sorted after ${rounds} fix round(s).`)
		: 'This one\'s being stubborn — saved everything; you can retry or get help.', 88);

	let yaml: string | undefined;
	if (osi.ship === 'windows') {
		yaml = codemagicYaml(mp, folder);
		await writeOne(projectDir, { path: 'codemagic.yaml', contents: yaml });
		emit({ kind: 'heading', message: 'Get it on your iPhone (Windows → Codemagic)' });
		codemagicGuide(mp).forEach((line) => emit({ kind: 'step', message: line }));
	} else {
		emit({ kind: 'heading', message: 'Run it on your Mac' });
		emit({ kind: 'step', message: 'Tap “Open in Xcode” or “Run” — I\'ll launch the simulator for you.' });
	}
	prog(emit, 'step', 'Wrapping up…', 96);

	const budget = opts.mode === 'full' ? cfg().fullBudget : cfg().baseBudget;
	const totalTokens = Math.min(budget, files.reduce((s, f) => s + estimateTokens(f.contents), estimateTokens(JSON.stringify(mp))));
	const buildPower = Math.max(1, Math.round((totalTokens * cfg().split) / 100));
	const reviewPower = Math.max(0, Math.round((totalTokens * (1 - cfg().split)) / 100));
	await reportUsage(userId, buildPower, reviewPower);
	emit({ kind: 'detail', message: `usage reported: ${buildPower} build / ${reviewPower} review power` });

	await postCache(userId, category, mp, projectDir);
	prog(emit, 'celebrate', `Meet ${mp.appName}. This is really yours.`, 100);

	return {
		appName: mp.appName, bundleId: bundleIdFor(mp.appName), mode: opts.mode, projectDir,
		fileCount: files.length, rounds, compiled, usage: { build: buildPower, review: reviewPower },
		shipPath: osi.ship, codemagicYaml: yaml,
	};
}
