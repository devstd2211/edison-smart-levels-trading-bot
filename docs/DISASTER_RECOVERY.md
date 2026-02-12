# Disaster Recovery Plan

**Version:** 1.0
**Last Updated:** 2026-02-12
**Recovery Time Objective (RTO):** <15 minutes
**Recovery Point Objective (RPO):** <5 minutes

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Backup Procedures](#backup-procedures)
3. [Recovery Scenarios](#recovery-scenarios)
4. [Emergency Procedures](#emergency-procedures)
5. [Data Restore](#data-restore)
6. [Testing & Validation](#testing--validation)

---

## 🎯 Overview

### Purpose

This document outlines procedures for:
- Regular backups of critical data
- Recovery from system failures
- Emergency shutdown procedures
- Data restoration procedures

### Critical Data

| Data Type | File/Location | Backup Frequency | Retention |
|-----------|---------------|------------------|-----------|
| Configuration | `config.json` | Before each change | 30 days |
| Environment | `.env` | Before each change | 30 days |
| Trade Journal | `data/trade-journal.json` | Every 1 hour | 90 days |
| Logs | `logs/*.log` | Daily | 30 days |
| Strategies | `strategies/json/*.json` | Before each change | Forever |

---

## 💾 Backup Procedures

### Automated Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash

# Backup configuration
BACKUP_DIR="backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Backup critical files
echo "Creating backup: $BACKUP_DIR"

# Configuration files
cp config.json "$BACKUP_DIR/config.json"
cp .env "$BACKUP_DIR/.env"

# Trade data
cp -r data/ "$BACKUP_DIR/data/"

# Strategies
cp -r strategies/ "$BACKUP_DIR/strategies/"

# Logs (compress)
tar -czf "$BACKUP_DIR/logs.tar.gz" logs/

# Create manifest
cat > "$BACKUP_DIR/MANIFEST.txt" <<EOF
Backup Date: $(date)
Git Commit: $(git rev-parse HEAD)
Node Version: $(node --version)
NPM Version: $(npm --version)
EOF

echo "Backup completed: $BACKUP_DIR"

# Cleanup old backups (keep 30 days)
find backups/ -type d -mtime +30 -exec rm -rf {} +
```

Make executable:
```bash
chmod +x scripts/backup.sh
```

### Schedule Automated Backups

#### Option 1: Cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add backup every hour
0 * * * * /path/to/Edison/scripts/backup.sh >> /path/to/Edison/logs/backup.log 2>&1

# Add daily cleanup
0 2 * * * find /path/to/Edison/backups/ -type d -mtime +30 -exec rm -rf {} +
```

#### Option 2: Windows Task Scheduler

```powershell
# Create backup task
$action = New-ScheduledTaskAction -Execute "bash" -Argument "scripts/backup.sh"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "Edison-Backup" -Action $action -Trigger $trigger
```

### Manual Backup

```bash
# Quick backup before changes
./scripts/backup.sh

# OR manual backup
BACKUP_DIR="backups/manual-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp config.json "$BACKUP_DIR/"
cp -r data/ "$BACKUP_DIR/"
cp -r strategies/ "$BACKUP_DIR/"
```

---

## 🚨 Recovery Scenarios

### Scenario 1: Configuration Corruption

**Symptoms:**
- Bot fails to start
- Invalid configuration errors
- Unexpected behavior

**Recovery Steps:**

```bash
# 1. Stop bot
pm2 stop edison-bot

# 2. Find latest backup
ls -lt backups/ | head -5

# 3. Restore configuration
cp backups/YYYYMMDD/config.json config.json

# 4. Validate configuration
npm run validate-config

# 5. Restart bot
pm2 restart edison-bot
```

**Time to Recovery:** <5 minutes

---

### Scenario 2: Data Corruption (Trade Journal)

**Symptoms:**
- Trade journal errors
- Missing trades
- Corrupted JSON

**Recovery Steps:**

```bash
# 1. Stop bot
pm2 stop edison-bot

# 2. Backup corrupted file
mv data/trade-journal.json data/trade-journal.json.corrupted

# 3. Restore from backup
cp backups/YYYYMMDD/data/trade-journal.json data/trade-journal.json

# 4. Verify JSON validity
cat data/trade-journal.json | jq . > /dev/null

# 5. Restart bot
pm2 restart edison-bot
```

**Time to Recovery:** <5 minutes
**Data Loss:** Up to 1 hour (last backup interval)

---

### Scenario 3: Complete System Failure

**Symptoms:**
- Server crash
- Disk failure
- Complete data loss

**Recovery Steps:**

```bash
# 1. Setup new environment
# (See DEPLOYMENT_GUIDE.md - Environment Setup)

# 2. Clone repository
git clone <repository-url>
cd Edison

# 3. Restore from latest backup
LATEST_BACKUP=$(ls -t backups/ | head -1)
cp -r "backups/$LATEST_BACKUP"/* .

# 4. Install dependencies
npm install

# 5. Build project
npm run build

# 6. Verify configuration
npm run validate-config

# 7. Start bot
pm2 start npm --name "edison-bot" -- start
```

**Time to Recovery:** <15 minutes
**Data Loss:** Up to 1 hour

---

### Scenario 4: Lost Credentials (.env)

**Symptoms:**
- API authentication failed
- Missing environment variables

**Recovery Steps:**

```bash
# 1. Stop bot
pm2 stop edison-bot

# 2. Restore .env from backup
cp backups/YYYYMMDD/.env .env

# OR create new .env if backup not available
cat > .env <<EOF
BYBIT_API_KEY=your_key_here
BYBIT_API_SECRET=your_secret_here
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
EOF

# 3. Restart bot
pm2 restart edison-bot
```

**Time to Recovery:** <5 minutes

---

### Scenario 5: Network Partition / Exchange API Down

**Symptoms:**
- Continuous network errors
- Cannot connect to Bybit API
- WebSocket disconnections

**Response:**

```bash
# Bot should handle this automatically with retry mechanisms
# Monitor logs:
pm2 logs edison-bot

# If prolonged outage (>30 minutes):
# 1. Check Bybit status: https://bybit-exchange.github.io/docs/
# 2. Close positions manually if needed (via Bybit UI)
# 3. Stop bot if API down for extended period:
pm2 stop edison-bot
```

**Auto-Recovery:** Yes (via ErrorHandler RETRY strategy)
**Manual Intervention:** Only if outage >30 minutes

---

## 🔴 Emergency Procedures

### Emergency Shutdown

**When to Use:**
- Critical bug discovered
- Unexpected behavior
- Risk of significant loss
- System compromise suspected

**Procedure:**

```bash
# 1. IMMEDIATE STOP
pm2 stop edison-bot

# 2. Close all open positions (Bybit UI)
# Go to: https://www.bybit.com/app/trade/usdt/BTCUSDT
# Click "Close All"

# 3. Cancel all pending orders (Bybit UI)
# Go to: Orders tab
# Click "Cancel All"

# 4. Document incident
cat > incident-$(date +%Y%m%d_%H%M%S).txt <<EOF
Incident Time: $(date)
Reason: [Describe reason]
Actions Taken:
- Bot stopped
- Positions closed
- Orders cancelled
Open Positions: [List any positions]
PnL Impact: [Estimate]
Next Steps: [Action plan]
EOF

# 5. Notify team (Telegram/Slack/Email)
```

---

### Emergency Position Close

If bot cannot close positions:

```bash
# Option 1: Bybit Web Interface
# 1. Login to Bybit
# 2. Go to Positions tab
# 3. Click "Close" on each position

# Option 2: Bybit API (manual script)
# Create emergency-close.js:
```

```javascript
const { RestClientV5 } = require('bybit-api');

const client = new RestClientV5({
  key: process.env.BYBIT_API_KEY,
  secret: process.env.BYBIT_API_SECRET,
});

async function emergencyClose() {
  const positions = await client.getPositionInfo({ category: 'linear' });

  for (const pos of positions.result.list) {
    if (parseFloat(pos.size) > 0) {
      console.log(`Closing ${pos.symbol}...`);
      await client.submitOrder({
        category: 'linear',
        symbol: pos.symbol,
        side: pos.side === 'Buy' ? 'Sell' : 'Buy',
        orderType: 'Market',
        qty: pos.size,
        reduceOnly: true,
      });
    }
  }

  console.log('All positions closed');
}

emergencyClose();
```

```bash
# Run emergency close
node emergency-close.js
```

---

## 📥 Data Restore

### Restore Configuration

```bash
# List available backups
ls -lt backups/

# Restore from specific backup
BACKUP_DATE="20260212"
cp backups/$BACKUP_DATE/config.json config.json
cp backups/$BACKUP_DATE/.env .env

# Verify
npm run validate-config
```

### Restore Trade Journal

```bash
# Backup current (corrupted) file
mv data/trade-journal.json data/trade-journal.json.backup

# Restore from backup
cp backups/$BACKUP_DATE/data/trade-journal.json data/trade-journal.json

# Verify JSON
cat data/trade-journal.json | jq . > /dev/null && echo "Valid JSON"
```

### Restore Complete System

```bash
# 1. Choose backup
BACKUP_DATE="20260212"

# 2. Restore all files
cp backups/$BACKUP_DATE/config.json config.json
cp backups/$BACKUP_DATE/.env .env
cp -r backups/$BACKUP_DATE/data/* data/
cp -r backups/$BACKUP_DATE/strategies/* strategies/

# 3. Verify
npm run validate-config
npm test

# 4. Restart
pm2 restart edison-bot
```

---

## ✅ Testing & Validation

### Backup Testing

Test backups monthly:

```bash
# 1. Create test environment
mkdir test-restore
cd test-restore

# 2. Restore latest backup
LATEST=$(ls -t ../backups/ | head -1)
cp -r ../backups/$LATEST/* .

# 3. Validate
npm install
npm run validate-config
npm test

# 4. Cleanup
cd ..
rm -rf test-restore
```

### Recovery Drill

Perform quarterly recovery drills:

1. **Simulate failure** (stop bot, rename files)
2. **Execute recovery** (follow procedures)
3. **Time the recovery** (should be <15 minutes)
4. **Document results** (update procedures if needed)

### Validation Checklist

After any restore:

- [ ] Configuration valid (`npm run validate-config`)
- [ ] Tests passing (`npm test`)
- [ ] Bot starts successfully
- [ ] WebSocket connects
- [ ] No critical errors in logs
- [ ] Trade journal readable
- [ ] Strategies loaded correctly

---

## 📊 Recovery Metrics

Track recovery metrics:

| Metric | Target | Current |
|--------|--------|---------|
| RTO (Recovery Time Objective) | <15 min | TBD |
| RPO (Recovery Point Objective) | <1 hour | 1 hour |
| Backup Success Rate | >99% | TBD |
| Recovery Test Success Rate | 100% | TBD |
| Mean Time to Recovery (MTTR) | <10 min | TBD |

---

## 📞 Escalation

### Recovery Failure

If recovery fails:

1. **Don't panic** - positions can be managed via Bybit UI
2. **Document the issue** - what failed, error messages
3. **Use Bybit UI** - manage positions manually
4. **Review logs** - identify root cause
5. **Restore from older backup** - if recent backup corrupted

### Data Loss

If backup cannot be restored:

1. **Stop bot immediately**
2. **Close positions via Bybit UI**
3. **Export trade history from Bybit** (for journal reconstruction)
4. **Rebuild trade journal** from Bybit data
5. **Update procedures** to prevent recurrence

---

## 🔐 Security

### Backup Security

- **Encrypt backups** containing `.env` file
- **Store off-site** (cloud storage, different server)
- **Restrict access** to backup directory (chmod 700)
- **Never commit** `.env` or backups to git

```bash
# Encrypt sensitive backup
tar -czf - backups/20260212 | openssl enc -aes-256-cbc -salt -out backup-encrypted.tar.gz.enc

# Decrypt when needed
openssl enc -d -aes-256-cbc -in backup-encrypted.tar.gz.enc | tar -xzf -
```

---

**Next:** See [OPERATIONAL_RUNBOOK.md](./OPERATIONAL_RUNBOOK.md) for day-to-day operations.
