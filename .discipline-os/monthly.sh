#!/usr/bin/env bash
set -e
echo "Discipline Loop monthly maintenance (extension) — $(date +%Y-%m-%d)"
echo ""

echo "=== 1/6 Backups verification (companion backend) ==="
echo "Manual: if extension has a companion backend, verify backups."
echo ""

echo "=== 2/6 Bundle audit ==="
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  npm run build || echo "⚠ build failed."
  echo "Check dist/*.zip size — CWS default <2 MB; hard limit 10 MB."
fi
echo ""

echo "=== 3/6 Store listing review ==="
echo "Manual: open Chrome Web Store + Firefox AMO listings."
echo "  - Screenshots reflect current UI?"
echo "  - Description mentions any feature that was removed?"
echo "  - Requested permissions match manifest.json?"
echo "  - Privacy Policy URL still responds?"
echo ""

echo "=== 4/6 Manifest permissions audit ==="
if [ -f "public/manifest.json" ] || [ -f "src/manifest.json" ]; then
  echo "Current permissions (review for minimization):"
  grep -A5 '"permissions"' public/manifest.json src/manifest.json 2>/dev/null | head -30 || true
fi
echo ""

echo "=== 5/6 Dependency budget ==="
command -v depcheck >/dev/null 2>&1 && npx depcheck || echo "Install: npm install -g depcheck"
echo ""

echo "=== 6/6 Findings review ==="
echo "Manual: findings.md §Incidents last 30 days."
