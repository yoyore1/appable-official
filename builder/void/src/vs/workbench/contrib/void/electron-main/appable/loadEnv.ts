/*--------------------------------------------------------------------------------------
 *  Appable Builder — load .env.local / .env (same idea as the standalone CLI).
 *  Uses VS Code's envfile parser. Does not override vars already in process.env.
 *--------------------------------------------------------------------------------------*/

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { parseEnvFile } from '../../../../../base/common/envfile.js';

const loadedFrom = new Set<string>();

function applyFile(path: string): void {
	if (loadedFrom.has(path) || !existsSync(path)) {
		return;
	}
	loadedFrom.add(path);
	const parsed = parseEnvFile(readFileSync(path, 'utf8'));
	for (const [key, value] of parsed) {
		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

function isVoidRoot(dir: string): boolean {
	return existsSync(join(dir, 'product.json')) && existsSync(join(dir, 'package.json'));
}

/** Load Appable env files from cwd, optional extra roots, and parents up to the Void repo root. */
export function loadAppableEnv(extraRoots: string[] = []): void {
	const roots: string[] = [];
	const seen = new Set<string>();
	const add = (dir: string) => {
		const n = dir.trim();
		if (!n || seen.has(n)) {
			return;
		}
		seen.add(n);
		roots.push(n);
	};

	for (const r of extraRoots) {
		add(r);
	}
	add(process.cwd());

	let dir = process.cwd();
	for (let i = 0; i < 10; i++) {
		if (isVoidRoot(dir)) {
			add(dir);
			break;
		}
		const parent = dirname(dir);
		if (parent === dir) {
			break;
		}
		dir = parent;
	}

	for (const root of roots) {
		applyFile(join(root, '.env.local'));
		applyFile(join(root, '.env'));
	}
}
