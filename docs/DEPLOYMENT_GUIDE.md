# Deployment Guide

**Version:** 1.0
**Last Updated:** 2026-02-12
**Status:** Production Ready ✅

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Deployment Procedure](#deployment-procedure)
4. [Rollback Procedure](#rollback-procedure)
5. [Configuration Management](#configuration-management)
6. [Post-Deployment Verification](#post-deployment-verification)

---

## ✅ Pre-Deployment Checklist

Before deploying to production, ensure:

### Code Quality
- [ ] All 7014 tests passing (0 regressions)
- [ ] Code review completed
- [ ] No critical vulnerabilities (security audit passed)
- [ ] Performance benchmarks met (latency <10ms, memory <500MB)

### Configuration
- [ ] `config.json` validated
- [ ] Environment variables set (`.env` file)
- [ ] API keys configured (Bybit API key/secret)
- [ ] Telegram bot token configured (if enabled)

### Infrastructure
- [ ] Node.js 18+ installed
- [ ] Sufficient disk space (>10GB recommended)
- [ ] Network connectivity to Bybit API
- [ ] Monitoring/logging infrastructure ready

### Documentation
- [ ] All documentation up-to-date
- [ ] Runbooks prepared
- [ ] Team trained on emergency procedures

---

## 🛠️ Environment Setup

### 1. System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 2GB
- Disk: 10GB
- Network: Stable connection to Bybit API

**Recommended:**
- CPU: 4+ cores
- RAM: 4GB
- Disk: 20GB
- Network: Low-latency connection

### 2. Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd Edison

# Install dependencies
npm install

# Build project
npm run build
```

### 3. Environment Configuration

Create `.env` file:

```bash
# Bybit API Configuration
BYBIT_API_KEY=your_api_key_here
BYBIT_API_SECRET=your_api_secret_here
BYBIT_TESTNET=false  # Set to true for testnet

# Telegram Configuration (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Logging
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR
LOG_TO_FILE=true
```

**Security Note:** Never commit `.env` file to version control!

### 4. Configuration File

Edit `config.json`:

```json
{
  "exchange": {
    "name": "bybit",
    "testnet": false,
    "rateLimit": {
      "ordersPerSecond": 10,
      "requestsPerSecond": 50
    }
  },
  "trading": {
    "mode": "LIVE",
    "maxPositions": 1,
    "symbols": ["BTCUSDT", "ETHUSDT"]
  },
  "risk": {
    "maxPositionSizeUSDT": 1000,
    "stopLossPercent": 2.0,
    "maxDailyLoss": 100
  }
}
```

---

## 🚀 Deployment Procedure

### Step 1: Prepare Environment

```bash
# 1. Update code to latest version
git pull origin main

# 2. Install/update dependencies
npm install

# 3. Run tests
npm test

# 4. Build project
npm run build
```

### Step 2: Backup Current State

```bash
# Backup configuration
cp config.json config.json.backup.$(date +%Y%m%d_%H%M%S)

# Backup trade journal
cp data/trade-journal.json data/trade-journal.json.backup.$(date +%Y%m%d_%H%M%S)

# Backup logs
tar -czf logs/logs-backup-$(date +%Y%m%d_%H%M%S).tar.gz logs/*.log
```

### Step 3: Start Bot

```bash
# Option 1: Direct start (foreground)
npm start

# Option 2: PM2 (recommended for production)
npm install -g pm2
pm2 start npm --name "edison-bot" -- start
pm2 save
pm2 startup  # Configure auto-start on reboot
```

### Step 4: Verify Deployment

```bash
# Check bot status
pm2 status

# Check logs
pm2 logs edison-bot --lines 50

# Verify WebSocket connection
grep "WebSocket connected" logs/latest.log

# Verify no errors
grep "ERROR" logs/latest.log
```

### Step 5: Monitor Initial Performance

- Monitor for **first 1 hour** continuously
- Check memory usage: `pm2 monit`
- Verify trade execution (if signals generated)
- Check error rates in logs
- Confirm Telegram notifications (if enabled)

---

## ⏮️ Rollback Procedure

If deployment fails or issues detected:

### Quick Rollback

```bash
# 1. Stop bot
pm2 stop edison-bot

# 2. Restore previous version
git checkout <previous-commit-hash>

# 3. Restore configuration
cp config.json.backup.YYYYMMDD_HHMMSS config.json

# 4. Reinstall dependencies
npm install

# 5. Rebuild
npm run build

# 6. Restart bot
pm2 restart edison-bot
```

### Emergency Shutdown

```bash
# Immediate stop
pm2 stop edison-bot

# Close all positions (manual via Bybit UI)
# Check positions at: https://www.bybit.com/app/trade/usdt/BTCUSDT

# OR use emergency close script (if available)
npm run emergency-close
```

---

## ⚙️ Configuration Management

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `config.json` | Main bot configuration | Root directory |
| `.env` | Sensitive credentials | Root directory (not in git) |
| `strategies/json/*.json` | Trading strategies | `strategies/json/` |

### Configuration Validation

```bash
# Validate config.json
npm run validate-config

# Test configuration (dry-run mode)
npm run test-config
```

### Configuration Best Practices

1. **Never hardcode secrets** - use environment variables
2. **Version control config.json** - but NOT `.env`
3. **Test in testnet first** - before production deployment
4. **Document all changes** - maintain changelog
5. **Backup before changes** - always create backups

---

## ✅ Post-Deployment Verification

### Immediate Checks (0-15 minutes)

- [ ] Bot process running (`pm2 status`)
- [ ] WebSocket connected (check logs)
- [ ] No critical errors in logs
- [ ] Memory usage normal (<500MB)
- [ ] CPU usage normal (<50%)

### Short-term Checks (15min - 1 hour)

- [ ] Signal processing working (if signals generated)
- [ ] Order execution functional (if trades occur)
- [ ] Position management correct
- [ ] Telegram notifications working (if enabled)
- [ ] Error recovery working (retry mechanisms)

### Long-term Monitoring (1+ hours)

- [ ] No memory leaks (stable memory usage)
- [ ] Performance metrics healthy
- [ ] Trade journal recording correctly
- [ ] No unexpected errors
- [ ] System stability confirmed

---

## 📊 Monitoring

### Key Metrics to Monitor

1. **System Health:**
   - CPU usage (<50% average)
   - Memory usage (<500MB)
   - Disk usage (<80%)
   - Network latency (<100ms to Bybit API)

2. **Trading Performance:**
   - Signals processed per hour
   - Orders executed successfully
   - Error rate (<1%)
   - Average latency (<10ms)

3. **Error Tracking:**
   - Critical errors (should be 0)
   - Network errors (should recover automatically)
   - API rate limits (should not exceed limits)

### Monitoring Commands

```bash
# System resources
pm2 monit

# Logs (real-time)
pm2 logs edison-bot --lines 100

# Error count
grep -c "ERROR" logs/latest.log

# Memory usage
pm2 describe edison-bot | grep memory
```

---

## 🚨 Common Issues & Solutions

### Issue 1: WebSocket Disconnected

**Symptoms:** "WebSocket disconnected" in logs
**Solution:**
```bash
# Bot should auto-reconnect
# If not, restart:
pm2 restart edison-bot
```

### Issue 2: API Rate Limit Exceeded

**Symptoms:** "Rate limit exceeded" errors
**Solution:**
- Reduce `ordersPerSecond` in config.json
- Reduce `requestsPerSecond` in config.json
- Restart bot

### Issue 3: High Memory Usage

**Symptoms:** Memory >500MB
**Solution:**
```bash
# Check for memory leak
pm2 describe edison-bot

# If memory keeps growing, restart:
pm2 restart edison-bot
```

### Issue 4: Bot Not Starting

**Symptoms:** Bot crashes on startup
**Solution:**
1. Check logs: `pm2 logs edison-bot --err`
2. Verify configuration: `npm run validate-config`
3. Check API credentials in `.env`
4. Ensure sufficient disk space: `df -h`

---

## 📞 Support & Escalation

### Before Escalating

1. Check logs for errors
2. Review recent configuration changes
3. Verify API credentials
4. Check Bybit API status: https://bybit-exchange.github.io/docs/

### Emergency Contacts

- **Critical Issues:** Stop bot immediately, close positions manually
- **API Issues:** Check Bybit status page
- **System Issues:** Check server logs, resource usage

---

## 📝 Deployment History Template

Keep a deployment log:

```markdown
## Deployment - YYYY-MM-DD HH:MM

**Version:** vX.X.X
**Deployed By:** [Name]
**Commit:** [git hash]
**Environment:** Production

**Changes:**
- [List of changes]

**Validation:**
- [ ] Tests passed
- [ ] Configuration validated
- [ ] Backup created
- [ ] Deployment successful
- [ ] Post-deployment checks passed

**Notes:**
- [Any special notes or observations]
```

---

**Next:** See [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for disaster recovery procedures.
