# Operational Runbook

**Version:** 1.0
**Last Updated:** 2026-02-12
**Purpose:** Day-to-day operations, troubleshooting, and maintenance

---

## 📋 Table of Contents

1. [Daily Operations](#daily-operations)
2. [Monitoring](#monitoring)
3. [Troubleshooting](#troubleshooting)
4. [Maintenance](#maintenance)
5. [Performance Tuning](#performance-tuning)
6. [Common Tasks](#common-tasks)

---

## 📅 Daily Operations

### Morning Checklist (Start of Trading Day)

```bash
# 1. Check bot status
pm2 status edison-bot

# 2. Review overnight logs
tail -100 logs/latest.log | grep -i error

# 3. Check open positions
# Via Bybit UI or logs
grep "Position opened" logs/latest.log | tail -5

# 4. Verify WebSocket connection
grep "WebSocket connected" logs/latest.log | tail -1

# 5. Check memory/CPU usage
pm2 monit

# 6. Review error stats
grep "ERROR" logs/latest.log | wc -l
```

**Expected Results:**
- ✅ Bot status: "online"
- ✅ Errors: <10 per day
- ✅ WebSocket: Connected
- ✅ Memory: <500MB
- ✅ CPU: <50%

---

### Evening Checklist (End of Trading Day)

```bash
# 1. Review daily performance
grep "Daily stats" logs/latest.log | tail -1

# 2. Check trade journal
cat data/trade-journal.json | jq '.trades | length'

# 3. Verify backups completed
ls -lt backups/ | head -3

# 4. Check for recurring errors
grep "ERROR" logs/latest.log | sort | uniq -c | sort -rn

# 5. Plan next day
# - Review any issues
# - Update configuration if needed
# - Schedule maintenance if required
```

---

## 📊 Monitoring

### Real-Time Monitoring

```bash
# Live logs
pm2 logs edison-bot --lines 50

# System resources
pm2 monit

# Error stream only
pm2 logs edison-bot --err --lines 20

# Follow specific pattern
tail -f logs/latest.log | grep "Position"
```

### Key Metrics

**System Health:**
```bash
# Memory usage
pm2 describe edison-bot | grep "heap size"

# CPU usage
pm2 describe edison-bot | grep "cpu"

# Uptime
pm2 describe edison-bot | grep "uptime"

# Restarts (should be 0 or minimal)
pm2 describe edison-bot | grep "restarts"
```

**Trading Performance:**
```bash
# Signals processed today
grep "Signal generated" logs/latest.log | wc -l

# Positions opened today
grep "Position opened" logs/latest.log | wc -l

# Positions closed today
grep "Position closed" logs/latest.log | wc -l

# Win rate (from trade journal)
cat data/trade-journal.json | jq '[.trades[] | select(.pnl > 0)] | length'
```

**Error Rates:**
```bash
# Total errors today
grep "$(date +%Y-%m-%d)" logs/latest.log | grep -c "ERROR"

# By error type
grep "ERROR" logs/latest.log | awk '{print $NF}' | sort | uniq -c | sort -rn

# Critical errors (should be 0)
grep "CRITICAL" logs/latest.log
```

---

## 🔧 Troubleshooting

### Problem: Bot Not Starting

**Symptoms:**
```
pm2 status shows "errored" or "stopped"
```

**Diagnosis:**
```bash
# Check error logs
pm2 logs edison-bot --err --lines 50

# Check configuration
npm run validate-config

# Check dependencies
npm list --depth=0
```

**Solutions:**

1. **Configuration Error:**
```bash
# Restore from backup
cp backups/$(ls -t backups/ | head -1)/config.json config.json
pm2 restart edison-bot
```

2. **Missing Dependencies:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart edison-bot
```

3. **Permission Error:**
```bash
chmod -R 755 .
pm2 restart edison-bot
```

---

### Problem: WebSocket Disconnections

**Symptoms:**
```
Repeated "WebSocket disconnected" in logs
```

**Diagnosis:**
```bash
# Check connection errors
grep "WebSocket" logs/latest.log | tail -20

# Check network
ping api.bybit.com

# Check DNS
nslookup api.bybit.com
```

**Solutions:**

1. **Temporary Network Issue:**
```bash
# Bot should auto-reconnect
# Monitor logs:
pm2 logs edison-bot | grep "WebSocket connected"
```

2. **Persistent Issue:**
```bash
# Restart bot
pm2 restart edison-bot

# If issue persists, check Bybit status
curl -s https://api.bybit.com/v5/market/time
```

3. **Firewall/Proxy Issue:**
```bash
# Test direct connection
telnet api.bybit.com 443

# Check proxy settings
env | grep -i proxy
```

---

### Problem: High Memory Usage

**Symptoms:**
```
Memory >500MB or steadily increasing
```

**Diagnosis:**
```bash
# Check memory trend
pm2 monit

# Check for memory leak
watch -n 5 'pm2 describe edison-bot | grep memory'
```

**Solutions:**

1. **Temporary Spike (normal):**
```bash
# Just monitor, should stabilize
pm2 monit
```

2. **Memory Leak:**
```bash
# Restart bot (releases memory)
pm2 restart edison-bot

# If recurring, check logs for root cause
grep "OutOfMemory\|ENOMEM" logs/latest.log
```

3. **Large Cache:**
```bash
# Clear logs (if very large)
pm2 flush edison-bot

# Rotate logs
mv logs/latest.log logs/archived-$(date +%Y%m%d).log
```

---

### Problem: API Rate Limiting

**Symptoms:**
```
"Rate limit exceeded" errors in logs
```

**Diagnosis:**
```bash
# Count rate limit errors
grep "Rate limit" logs/latest.log | wc -l

# Check recent API calls
grep "API request" logs/latest.log | tail -20
```

**Solutions:**

1. **Temporary:**
```bash
# Wait 60 seconds, rate limits reset
# Bot should handle with RETRY strategy
```

2. **Recurring:**
```bash
# Edit config.json - reduce rates
nano config.json

# Find and reduce:
{
  "rateLimit": {
    "ordersPerSecond": 5,     # Reduce from 10
    "requestsPerSecond": 25   # Reduce from 50
  }
}

# Restart
pm2 restart edison-bot
```

---

### Problem: Orders Not Executing

**Symptoms:**
```
Signals generated but no orders placed
```

**Diagnosis:**
```bash
# Check for order errors
grep "Order" logs/latest.log | grep -i error

# Check balance
# Via Bybit UI or logs
grep "Insufficient balance" logs/latest.log

# Check order validation
grep "Order validation" logs/latest.log | tail -10
```

**Solutions:**

1. **Insufficient Balance:**
```bash
# Check account balance via Bybit UI
# Transfer funds if needed
```

2. **Risk Limits:**
```bash
# Check config.json risk settings
cat config.json | jq '.risk'

# Adjust if too restrictive
```

3. **API Issue:**
```bash
# Check API credentials
grep "authentication" logs/latest.log

# Verify .env file
cat .env | grep BYBIT_API
```

---

## 🛠️ Maintenance

### Weekly Maintenance

**Every Monday:**

```bash
# 1. Review weekly performance
grep "Weekly stats" logs/latest.log

# 2. Cleanup old logs
find logs/ -name "*.log" -mtime +30 -delete

# 3. Cleanup old backups
find backups/ -type d -mtime +30 -exec rm -rf {} +

# 4. Update dependencies (if needed)
npm outdated
# Review and update if safe

# 5. Restart bot (fresh start for week)
pm2 restart edison-bot
```

---

### Monthly Maintenance

**First Sunday of Month:**

```bash
# 1. Full system update
npm update

# 2. Rebuild project
npm run build

# 3. Run full test suite
npm test

# 4. Review monthly performance
# Export trade journal
cat data/trade-journal.json | jq '.trades' > monthly-trades-$(date +%Y%m).json

# 5. Backup and archive
./scripts/backup.sh
tar -czf archive-$(date +%Y%m).tar.gz backups/ logs/ data/

# 6. Restart with fresh logs
pm2 restart edison-bot
pm2 flush edison-bot
```

---

### Configuration Updates

**Safe Update Procedure:**

```bash
# 1. Backup current config
cp config.json config.json.backup.$(date +%Y%m%d_%H%M%S)

# 2. Edit configuration
nano config.json

# 3. Validate changes
npm run validate-config

# 4. Test in dry-run mode (if available)
npm run test-config

# 5. Apply changes
pm2 restart edison-bot

# 6. Monitor for 15 minutes
pm2 logs edison-bot --lines 100

# 7. Rollback if issues
# cp config.json.backup.YYYYMMDD_HHMMSS config.json
# pm2 restart edison-bot
```

---

## ⚡ Performance Tuning

### Optimize Memory Usage

```bash
# 1. Check current usage
pm2 describe edison-bot | grep memory

# 2. Enable memory optimization in config.json
{
  "optimization": {
    "maxHistorySize": 100,    # Reduce if needed
    "cacheSize": 1000,         # Reduce if needed
    "logRetentionDays": 7      # Reduce if needed
  }
}

# 3. Restart with optimization
pm2 restart edison-bot --max-memory-restart 500M
```

---

### Optimize Latency

```bash
# 1. Check current latency
grep "Latency" logs/latest.log | tail -20

# 2. Optimize network
# - Use server closer to Bybit (HK, SG)
# - Use wired connection
# - Disable VPN if possible

# 3. Reduce polling intervals (if applicable)
{
  "intervals": {
    "candleUpdate": 5000,    # Reduce if needed
    "healthCheck": 60000     # Increase to reduce overhead
  }
}
```

---

### Optimize CPU Usage

```bash
# 1. Check current CPU
pm2 monit

# 2. Reduce concurrent operations
{
  "performance": {
    "maxConcurrentAnalyzers": 3,  # Reduce if high CPU
    "analysisInterval": 60000      # Increase if needed
  }
}

# 3. Use clustering (if very high traffic)
pm2 start npm --name edison-bot -- start -i 2  # 2 instances
```

---

## 📝 Common Tasks

### View Recent Trades

```bash
# Last 10 trades
cat data/trade-journal.json | jq '.trades[-10:]'

# Today's trades
cat data/trade-journal.json | jq --arg date "$(date +%Y-%m-%d)" '.trades[] | select(.timestamp | startswith($date))'

# Winning trades
cat data/trade-journal.json | jq '.trades[] | select(.pnl > 0)'
```

---

### Check Win Rate

```bash
# Total trades
TOTAL=$(cat data/trade-journal.json | jq '.trades | length')

# Winning trades
WINS=$(cat data/trade-journal.json | jq '[.trades[] | select(.pnl > 0)] | length')

# Calculate win rate
echo "scale=2; $WINS * 100 / $TOTAL" | bc
```

---

### Export Performance Report

```bash
# Generate monthly report
cat > monthly-report-$(date +%Y%m).txt <<EOF
Performance Report: $(date +%B\ %Y)

Total Trades: $(cat data/trade-journal.json | jq '.trades | length')
Winning Trades: $(cat data/trade-journal.json | jq '[.trades[] | select(.pnl > 0)] | length')
Losing Trades: $(cat data/trade-journal.json | jq '[.trades[] | select(.pnl < 0)] | length')

Total PnL: $(cat data/trade-journal.json | jq '[.trades[].pnl] | add')
Best Trade: $(cat data/trade-journal.json | jq '[.trades[].pnl] | max')
Worst Trade: $(cat data/trade-journal.json | jq '[.trades[].pnl] | min')

Win Rate: $(echo "scale=2; $(cat data/trade-journal.json | jq '[.trades[] | select(.pnl > 0)] | length') * 100 / $(cat data/trade-journal.json | jq '.trades | length')" | bc)%
EOF

cat monthly-report-$(date +%Y%m).txt
```

---

### Update Strategy

```bash
# 1. Backup current strategy
cp strategies/json/simple-levels.strategy.json strategies/json/simple-levels.strategy.json.backup

# 2. Edit strategy
nano strategies/json/simple-levels.strategy.json

# 3. Validate JSON
cat strategies/json/simple-levels.strategy.json | jq . > /dev/null

# 4. Restart bot (loads new strategy)
pm2 restart edison-bot

# 5. Monitor for 1 hour
pm2 logs edison-bot
```

---

## 🚨 Emergency Response

### Immediate Actions for Critical Errors

1. **Check if bot is running:**
   ```bash
   pm2 status edison-bot
   ```

2. **Check recent errors:**
   ```bash
   pm2 logs edison-bot --err --lines 20
   ```

3. **Check open positions:**
   - Via Bybit UI
   - Or: `grep "Position opened" logs/latest.log | tail -5`

4. **If critical issue:**
   ```bash
   pm2 stop edison-bot
   # Close positions manually via Bybit UI
   ```

5. **Document incident:**
   ```bash
   # Save error logs
   pm2 logs edison-bot --err --lines 500 > incident-$(date +%Y%m%d_%H%M%S).log
   ```

---

## 📞 Contact & Support

### Before Contacting Support

1. ✅ Check this runbook
2. ✅ Review recent logs
3. ✅ Check Bybit API status
4. ✅ Verify configuration
5. ✅ Document the issue

### Issue Template

```markdown
## Issue Report

**Date/Time:** YYYY-MM-DD HH:MM
**Severity:** Critical / High / Medium / Low

**Symptoms:**
- [Describe what's happening]

**Impact:**
- Bot Status: Running / Stopped
- Open Positions: X
- Recent Errors: [Count]

**Actions Taken:**
- [List what you tried]

**Logs:**
```
[Paste relevant logs]
```

**Configuration:**
- Bot Version: [git hash]
- Node Version: [version]
- Environment: Production / Testnet

**Next Steps:**
- [What help is needed]
```

---

**See Also:**
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment procedures
- [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) - Recovery procedures
