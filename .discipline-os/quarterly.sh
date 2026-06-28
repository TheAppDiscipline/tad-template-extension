#!/usr/bin/env bash
set -e
echo "Discipline Loop quarterly maintenance (extension) — $(date +%Y-%m-%d)"
echo "Timebox: 1 hour."
echo ""

echo "=== 1/4 Full security review ==="
echo "- Agent(discipline-security-reviewer) on main."
echo "- gitleaks detect."
echo "- Manifest V3 compliance: no remote script execution; CSP strict; no unsafe-eval."
echo "- Single-purpose policy: extension still matches declared purpose?"
echo ""

echo "=== 2/4 Compliance review ==="
echo "- Privacy Policy reflects data flows."
echo "- CWS declared 'data usage' still accurate."
echo "- Firefox AMO: reviewer-friendly note up-to-date if using obfuscation (don't) or remote host."
echo ""

echo "=== 3/4 Tech debt inventory ==="
grep -rE 'TODO|FIXME|HACK' entrypoints/ src/ 2>/dev/null | head -20 || echo "  None."
echo ""

echo "=== 4/4 Breach drill ==="
echo "Simulate 1 scenario (15 min). Extension scenarios: host permission abuse, message API auth bypass, stolen OAuth token from background service worker."
