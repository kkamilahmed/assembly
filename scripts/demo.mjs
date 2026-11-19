#!/usr/bin/env node
// Asks which demo to run, then starts it.
//
//   npm run demo             pick from a menu
//   npm run demo -- fraud    start one directly (by name or number)
//
// Every demo is its own Vite app under demos/<name>. The launcher installs
// that app's dependencies on first run and starts its dev server on the
// demo's own port, opening the browser on it.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { stdin, stdout, argv, exit } from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const DEMOS = [
  { key: 'bakery', port: 5181, title: 'Goldcrust bakery', story: 'Food processing; the oven runs hot and burns loaves' },
  { key: 'battery', port: 5182, title: 'Voltline EV battery plant', story: 'Manufacturing; the laser welder drifts and welds go weak' },
  { key: 'pharma', port: 5183, title: 'Meridian Pharma tablet line', story: 'Healthcare; the tablet press drifts and tablets come out underdosed' },
  { key: 'fraud', port: 5184, title: 'Northgate Payments globe', story: 'Fraud detection; card testing through TechDealz Online' },
];

const find = (answer) => DEMOS.find((d, i) => d.key === answer || String(i + 1) === answer);

async function pick() {
  const arg = argv[2]?.trim().toLowerCase();
  if (arg) {
    const demo = find(arg);
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
      const demo = find(line.trim().toLowerCase());
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
  const dir = join(root, 'demos', demo.key);
  if (!existsSync(join(dir, 'node_modules'))) {
    console.log(`\nInstalling ${demo.title} dependencies (first run only)...`);
    execFileSync('npm', ['ci'], { cwd: dir, stdio: 'inherit' });
  }
  console.log(`\nStarting ${demo.title} on http://localhost:${demo.port}  (Ctrl+C to stop)\n`);
  const child = spawn('npx', ['vite', '--port', String(demo.port), '--strictPort', '--open'], { cwd: dir, stdio: 'inherit' });
  child.on('exit', (code) => exit(code ?? 0));
} catch (err) {
  console.error(`\n${err.message}`);
  exit(1);
}
