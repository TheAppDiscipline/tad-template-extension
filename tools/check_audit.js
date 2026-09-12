/** Production high/critical audit. Unavailable or invalid evidence always fails.
 * Canonical copy: tad-template-web/tools/check_audit.js; mirrored in all lanes.
 * Development dependencies still require a separate complete npm audit.
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const incomplete = reason => ({ code: 1, message: `[FAIL] Dependency audit could not be verified: ${reason}. Check registry connectivity/authentication and rerun npm run audit:high. Registry output is omitted to protect credentials.` });

export function evaluateAudit(result) {
  if (result.error || result.signal || ![0, 1].includes(result.status)) return incomplete('npm did not complete normally');
  let report;
  try { report = JSON.parse(result.stdout); } catch { return incomplete('npm returned invalid JSON'); }
  if (!record(report) || 'error' in report || report.auditReportVersion !== 2
    || !record(report.metadata) || !record(report.metadata.vulnerabilities)
    || !record(report.vulnerabilities) || !record(report.metadata.dependencies)) {
    return incomplete('npm returned an error or an incomplete audit report');
  }
  const counts = report.metadata.vulnerabilities;
  if (![...severities, 'total'].every(key => count(counts[key]))
    || !['prod', 'dev', 'optional', 'peer', 'peerOptional', 'total'].every(key => count(report.metadata.dependencies[key]))) {
    return incomplete('audit counts are missing or invalid');
  }
  // Arborist counts the root in dependency categories but excludes it from total.
  // Categories overlap: neither a sum equality nor prod <= total is valid.
  const dependencies = report.metadata.dependencies;
  if (['prod', 'dev', 'optional', 'peer', 'peerOptional']
    .some(key => dependencies[key] > dependencies.total + 1)) {
    return incomplete('dependency counts exceed the inventory including its root');
  }
  // Every inventory node has a category; production is disjoint from all others.
  // Use exact sums even when individually safe counts add beyond MAX_SAFE_INTEGER.
  const inventorySize = BigInt(dependencies.total) + 1n;
  const production = BigInt(dependencies.prod);
  const nonProduction = ['dev', 'optional', 'peer', 'peerOptional'].map(key => BigInt(dependencies[key]));
  const categorySum = production + nonProduction.reduce((sum, value) => sum + value, 0n);
  const largestNonProduction = nonProduction.reduce((max, value) => value > max ? value : max, 0n);
  if (categorySum < inventorySize || production + largestNonProduction > inventorySize) {
    return incomplete('dependency categories contradict the inventory partition');
  }
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const observed = Object.fromEntries(severities.map(key => [key, 0]));
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (!record(entry) || !severities.includes(entry.severity) || !text(name) || entry.name !== name
      || !Array.isArray(entry.via) || !entry.via.length
      || !Array.isArray(entry.nodes) || !entry.nodes.length || !entry.nodes.every(text)
      || new Set(entry.nodes).size !== entry.nodes.length) {
      return incomplete('vulnerability details are incomplete');
    }
    let directSeverity = -1;
    let hasMetavulnerability = false;
    for (const advisory of entry.via) {
      if (typeof advisory === 'string') {
        // Named metavulnerabilities may concern only a subset of the target's advisories.
        // Do not infer their severity from the target's aggregate maximum.
        if (!text(advisory) || !Object.hasOwn(report.vulnerabilities, advisory)) {
          return incomplete('metavulnerability reference is missing');
        }
        hasMetavulnerability = true;
        continue;
      }
      if (!record(advisory) || !count(advisory.source) || advisory.source === 0
        || !['name', 'dependency', 'title', 'url', 'range'].every(key => text(advisory[key]))
        || !severities.includes(advisory.severity)
        || ('cvss' in advisory && (!record(advisory.cvss)
          || !(advisory.cvss.score === null || (typeof advisory.cvss.score === 'number'
            && Number.isFinite(advisory.cvss.score) && advisory.cvss.score >= 0 && advisory.cvss.score <= 10))
          || !(advisory.cvss.vectorString === null || text(advisory.cvss.vectorString))))
        || ('cwe' in advisory && (!Array.isArray(advisory.cwe) || !advisory.cwe.every(text)))) {
        return incomplete('nested advisory details are incomplete');
      }
      directSeverity = Math.max(directSeverity, severities.indexOf(advisory.severity));
    }
    const severity = severities.indexOf(entry.severity);
    if (severity < directSeverity || (!hasMetavulnerability && severity !== directSeverity)) {
      return incomplete('aggregate severity contradicts nested advisories');
    }
    observed[entry.severity]++;
  }
  if (severities.some(key => observed[key] !== counts[key])
    || severities.reduce((sum, key) => sum + counts[key], 0) !== counts.total) return incomplete('audit totals contradict vulnerability details');
  // --audit-level=high makes exit 1 meaningful only with proven high/critical findings.
  const blocked = counts.high + counts.critical > 0;
  if (result.status !== (blocked ? 1 : 0)) return incomplete('npm exit status contradicts the reported threshold');
  return blocked
    ? { code: 1, message: `[FAIL] ${counts.critical} critical + ${counts.high} high production vulnerabilities. Review npm audit and update or replace affected dependencies.` }
    : { code: 0, message: `[PASS] No high/critical production vulnerabilities (moderate: ${counts.moderate}, low: ${counts.low}).` };
}

export function runAudit() {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['audit', '--omit=dev', '--audit-level=high', '--json'], {
      encoding: 'utf8', shell: process.platform === 'win32', timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  const verdict = evaluateAudit(result);
  console.log(verdict.message);
  return verdict.code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = runAudit();
