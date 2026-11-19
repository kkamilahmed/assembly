#!/usr/bin/env node
// Asks which demo to run, then starts it.
//
//   npm run demo             pick from a menu
//   npm run demo -- fraud    start one directly (by key or number)
//
// Each demo lives on its own branch. The launcher reuses a worktree that
// already has the branch checked out, or creates one under .demos/<branch>,
// installs its dependencies if needed, and starts its dev server on the
// demo's own port with the browser opening on it.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';

const DEMOS = [
  { key: 'car', branch: 'main', port: 5180, title: 'Car assembly plant', story: 'Manufacturing; the weld robot drifts off its seam' },
  { key: 'bakery', branch: 'food-processing', port: 5181, title: 'Golden Crust bakery', story: 'Food processing; the oven runs hot and burns loaves' },
  { key: 'battery', branch: 'battery', port: 5182, title: 'Voltline EV battery plant', story: 'Manufacturing; the laser welder drifts and welds go weak' },
  { key: 'pharma', branch: 'healthcare', port: 5183, title: 'Meridian Pharma tablet line', story: 'Healthcare; the tablet press drifts and tablets come out underdosed' },
  { key: 'fraud', branch: 'fraud', port: 5184, title: 'Northgate Payments globe', story: 'Fraud detection; card testing through TechDealz Online' },
];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const root = git('rev-parse', '--show-toplevel');

function worktreeFor(branch) {
  let path = null;
  for (const line of git('worktree', 'list', '--porcelain').split('\n')) {
    if (line.startsWith('worktree ')) path = line.slice('worktree '.length);
    if (line === `branch refs/heads/${branch}`) return path;
  }
  return null;
}

function branchExists(ref) {
  try {
    git('rev-parse', '--verify', '--quiet', ref);
    return true;
  } catch {
    return false;
  }
}

function ensureWorktree(branch) {
  const existing = worktreeFor(branch);
  if (existing) return existing;
  const dir = resolve(root, '.demos', branch);
  if (!branchExists(`refs/heads/${branch}`)) {
    console.log(`Fetching ${branch} from origin...`);
    try {
      git('fetch', 'origin', `${branch}:${branch}`);
    } catch {
      throw new Error(`Branch "${branch}" isn't here or on origin. Push it, or fetch it, then try again.`);
    }
  }
  console.log(`Checking out ${branch} into ${dir}`);
  git('worktree', 'add', dir, branch);
  return dir;
}

function ensureDeps(dir) {
  if (existsSync(join(dir, 'node_modules'))) return;
  console.log('Installing dependencies (first run only)...');
  execFileSync('npm', ['ci'], { cwd: dir, stdio: 'inherit' });
}

async function pick() {
  const arg = argv[2];
  if (arg) {
    const demo = DEMOS.find((d, i) => d.key === arg || d.branch === arg || String(i + 1) === arg);
    if (!demo) throw new Error(`No demo called "${arg}". Choose one of: ${DEMOS.map((d) => d.key).join(', ')}`);
    return demo;
  }
  console.log('\nWhich demo do you want to run?\n');
  DEMOS.forEach((d, i) => console.log(`  ${i + 1}. ${d.title.padEnd(30)} ${d.story}`));
  // Read answers as a stream of lines rather than with rl.question(), so
  // lines that arrive before the prompt (piped or pasted input) aren't lost.
  const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
  const ask = () => stdout.write(`\nNumber or name [1-${DEMOS.length}]: `);
  try {
    ask();
    for await (const line of rl) {
      const answer = line.trim().toLowerCase();
      const demo = DEMOS.find((d, i) => String(i + 1) === answer || d.key === answer || d.branch === answer);
      if (demo) return demo;
      console.log(`Type a number from 1 to ${DEMOS.length}, or a name: ${DEMOS.map((d) => d.key).join(', ')}.`);
      ask();
    }
    throw new Error('No demo picked.');
  } finally {
    rl.close();
  }
}

try {
  const demo = await pick();
  const dir = ensureWorktree(demo.branch);
  ensureDeps(dir);
  console.log(`\nStarting ${demo.title} on http://localhost:${demo.port}  (Ctrl+C to stop)\n`);
  const child = spawn('npx', ['vite', '--port', String(demo.port), '--strictPort', '--open'], { cwd: dir, stdio: 'inherit' });
  child.on('exit', (code) => exit(code ?? 0));
} catch (err) {
  console.error(`\n${err.message}`);
  exit(1);
}
