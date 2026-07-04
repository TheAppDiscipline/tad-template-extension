# .discipline-os/ — Maintenance Automation (Discipline Loop)

Scripts to keep solo-builder maintenance from becoming "intention without habit". The doctrine behind them lives in The App Discipline vault (sold separately).

## Setup

Add these entries to your `package.json` under `scripts`:

```json
{
  "scripts": {
    "discipline-os:weekly": "bash .discipline-os/weekly.sh",
    "discipline-os:monthly": "bash .discipline-os/monthly.sh",
    "discipline-os:quarterly": "bash .discipline-os/quarterly.sh"
  }
}
```

## Cadence

| Script | Cadence | Time | What |
|---|---|---|---|
| `weekly` | Every Monday | <2 min | `npm outdated` · `npm audit` · `npm run gate` |
| `monthly` | First Sunday | <10 min | Backups (if companion backend) · bundle audit · CWS/AMO listing review · findings review |
| `quarterly` | Jan/Apr/Jul/Oct | <1 h | Security · compliance · tech debt · breach drill + manifest audit |

## Extension-specific notes

- `monthly.sh`: includes Chrome Web Store + Firefox AMO listing review (are screenshots, description, permissions still accurate?).
- `quarterly.sh`: includes MV3 migration readiness check and permission minimization review (CWS rejects overreach).

## Windows compatibility

Scripts require bash. Git Bash or WSL.
