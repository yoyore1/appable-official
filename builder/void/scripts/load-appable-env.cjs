/*--------------------------------------------------------------------------------------
 *  Loads void/.env.local + .env into process.env (or emits Windows SET lines).
 *  Usage:
 *    node scripts/load-appable-env.cjs              → mutates process.env, prints status
 *    node scripts/load-appable-env.cjs --emit-bat   → prints SET "KEY=value" for code-appable.bat
 *--------------------------------------------------------------------------------------*/

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function parseLine(line) {
	const t = line.trim();
	if (!t || t.startsWith('#')) {
		return null;
	}
	const i = t.indexOf('=');
	if (i < 0) {
		return null;
	}
	const key = t.slice(0, i).trim();
	let val = t.slice(i + 1).trim();
	if (
		(val.startsWith('"') && val.endsWith('"')) ||
		(val.startsWith("'") && val.endsWith("'"))
	) {
		val = val.slice(1, -1);
	}
	return { key, val };
}

function loadFile(filePath, into) {
	if (!fs.existsSync(filePath)) {
		return 0;
	}
	let n = 0;
	for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const parsed = parseLine(line);
		if (!parsed) {
			continue;
		}
		if (into[parsed.key] === undefined) {
			into[parsed.key] = parsed.val;
			n++;
		}
	}
	return n;
}

const fromFiles = {};
let count = 0;
count += loadFile(path.join(root, '.env.local'), fromFiles);
count += loadFile(path.join(root, '.env'), fromFiles);

if (process.argv.includes('--emit-bat')) {
	for (const [key, val] of Object.entries(fromFiles)) {
		const safe = String(val).replace(/"/g, '""');
		console.log(`set "${key}=${safe}"`);
	}
} else {
	for (const [key, val] of Object.entries(fromFiles)) {
		if (process.env[key] === undefined) {
			process.env[key] = val;
		}
	}
	if (!process.argv.includes('--quiet')) {
		console.log(`[appable] loaded ${count} env var(s) from ${root}`);
	}
}
