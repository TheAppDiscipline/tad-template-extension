#!/usr/bin/env node
/**
 * Discipline Loop AI Cost Dashboard
 *
 * Reads the Claude Code usage log (~/.claude/usage.json) and prints a daily cost summary.
 *
 * Usage:
 *   node tools/ai-cost-dashboard.js
 *   DISCIPLINE_AI_BUDGET=200 node tools/ai-cost-dashboard.js
 *
 * Requires: Node 18+.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const USAGE_FILE = path.join(os.homedir(), '.claude', 'usage.json');
const BUDGET_DEFAULT = 150;

function loadUsage() {
  if (!fs.existsSync(USAGE_FILE)) {
    console.log('~/.claude/usage.json not found. Is Claude Code installed?');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to parse usage.json:', err.message);
    process.exit(1);
  }
}

function today() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return new Date().toISOString().slice(0, 7); }

function main() {
  const raw = loadUsage();
  const budget = Number(process.env.DISCIPLINE_AI_BUDGET || BUDGET_DEFAULT);
  const todayIso = today();
  const thisMonthIso = thisMonth();
  const entries = Array.isArray(raw) ? raw : (raw.entries || raw.runs || []);

  let costToday = 0;
  let costMonth = 0;
  const dailyCosts = {};

  for (const entry of entries) {
    const date = entry.date || (entry.timestamp ? entry.timestamp.slice(0, 10) : null);
    const cost = Number(entry.cost_usd || entry.cost || entry.total_cost || 0);
    if (!date || !cost) continue;
    if (date.startsWith(thisMonthIso)) {
      costMonth += cost;
      dailyCosts[date] = (dailyCosts[date] || 0) + cost;
    }
    if (date === todayIso) costToday += cost;
  }

  const activeDaysThisMonth = Object.keys(dailyCosts).length;
  const avgDaily = activeDaysThisMonth > 0 ? costMonth / activeDaysThisMonth : 0;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const projected = avgDaily * daysInMonth;
  const budgetPct = budget > 0 ? (projected / budget) * 100 : 0;
  const status =
    projected > budget ? 'OVER BUDGET'
    : projected > budget * 0.8 ? 'near limit (>80%)'
    : 'within budget';

  console.log('Discipline Loop AI Cost Dashboard');
  console.log('------------------------');
  console.log(`Today (${todayIso}):          $${costToday.toFixed(2)}`);
  console.log(`Month-to-date (${thisMonthIso}): $${costMonth.toFixed(2)} across ${activeDaysThisMonth} active days`);
  console.log(`Average/active-day:         $${avgDaily.toFixed(2)}`);
  console.log(`Projected month end:        $${projected.toFixed(2)}`);
  console.log(`Budget:                     $${budget.toFixed(2)}`);
  console.log(`Budget usage:               ${budgetPct.toFixed(0)}% — ${status}`);
  console.log('');
  console.log(`(Day ${dayOfMonth}/${daysInMonth} of month. Override budget with DISCIPLINE_AI_BUDGET=<USD>.)`);

  if (projected > budget) {
    console.log('');
    console.log('Action: projected spend exceeds budget.');
    console.log('  - Audit recent sessions for opus-heavy or cache-miss patterns.');
    console.log('  - Route more work to sonnet/haiku.');
    console.log('  - Raise budget if the spend is genuinely value-producing.');
  }
}

main();
