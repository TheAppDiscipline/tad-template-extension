#!/usr/bin/env bash
set -e
echo "Discipline Loop weekly maintenance (extension) — $(date +%Y-%m-%d)"
echo ""
echo "=== 1/4 Outdated deps ==="
npm outdated || true
echo ""
echo "=== 2/4 Security audit ==="
npm audit --production || echo "⚠ audit found issues."
echo ""
echo "=== 3/4 Gates ==="
if npm run gate; then echo "✅ Gate green."; else echo "⚠ Gate failed."; fi
echo ""
echo "=== 4/4 Report ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
