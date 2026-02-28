/**
 * Session Detector Tests
 */

import { SessionDetector, TradingSession } from '../../utils/session-detector';

describe('SessionDetector', () => {
  describe('getCurrentSession', () => {
    it('should return ASIAN session for 00:00-07:59 UTC', () => {
      // 2:00 AM UTC
      const timestamp = new Date('2025-10-26T02:00:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp)).toBe(TradingSession.ASIAN);

      // 7:59 AM UTC
      const timestamp2 = new Date('2025-10-26T07:59:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp2)).toBe(TradingSession.ASIAN);
    });

    it('should return LONDON session for 08:00-12:59 UTC', () => {
      // 8:00 AM UTC
      const timestamp = new Date('2025-10-26T08:00:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp)).toBe(TradingSession.LONDON);

      // 12:59 PM UTC
      const timestamp2 = new Date('2025-10-26T12:59:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp2)).toBe(TradingSession.LONDON);
    });

    it('should return OVERLAP session for 13:00-15:59 UTC', () => {
      // 1:00 PM UTC
      const timestamp = new Date('2025-10-26T13:00:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp)).toBe(TradingSession.OVERLAP);

      // 3:59 PM UTC
      const timestamp2 = new Date('2025-10-26T15:59:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp2)).toBe(TradingSession.OVERLAP);
    });

    it('should return NY session for 16:00-20:59 UTC', () => {
      // 4:00 PM UTC
      const timestamp = new Date('2025-10-26T16:00:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp)).toBe(TradingSession.NY);

      // 8:59 PM UTC
      const timestamp2 = new Date('2025-10-26T20:59:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp2)).toBe(TradingSession.NY);
    });

    it('should return ASIAN session for 21:00-23:59 UTC', () => {
      // 9:00 PM UTC
      const timestamp = new Date('2025-10-26T21:00:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp)).toBe(TradingSession.ASIAN);

      // 11:59 PM UTC
      const timestamp2 = new Date('2025-10-26T23:59:00Z').getTime();
      expect(SessionDetector.getCurrentSession(timestamp2)).toBe(TradingSession.ASIAN);
    });

    it('should use current time if no timestamp provided', () => {
      const session = SessionDetector.getCurrentSession();
      expect(session).toBeDefined();
      expect(Object.values(TradingSession)).toContain(session);
    });
  });

  describe('getSessionName', () => {
    it('should return correct names for each session', () => {
      expect(SessionDetector.getSessionName(TradingSession.ASIAN)).toBe(
        'Asian Session (Low Volatility)',
      );
      expect(SessionDetector.getSessionName(TradingSession.LONDON)).toBe(
        'London Session (High Volatility)',
      );
      expect(SessionDetector.getSessionName(TradingSession.NY)).toBe(
        'NY Session (High Volatility)',
      );
      expect(SessionDetector.getSessionName(TradingSession.OVERLAP)).toBe(
        'London/NY Overlap (Very High Volatility)',
      );
    });
  });

  describe('isInSession', () => {
    it('should return true when in specified session', () => {
      const asianTime = new Date('2025-10-26T02:00:00Z').getTime();
      expect(SessionDetector.isInSession(TradingSession.ASIAN, asianTime)).toBe(true);

      const londonTime = new Date('2025-10-26T10:00:00Z').getTime();
      expect(SessionDetector.isInSession(TradingSession.LONDON, londonTime)).toBe(true);

      const overlapTime = new Date('2025-10-26T14:00:00Z').getTime();
      expect(SessionDetector.isInSession(TradingSession.OVERLAP, overlapTime)).toBe(true);

      const nyTime = new Date('2025-10-26T18:00:00Z').getTime();
      expect(SessionDetector.isInSession(TradingSession.NY, nyTime)).toBe(true);
    });

    it('should return false when not in specified session', () => {
      const asianTime = new Date('2025-10-26T02:00:00Z').getTime();
      expect(SessionDetector.isInSession(TradingSession.LONDON, asianTime)).toBe(false);

      const londonTime = new Date('2025-10-26T10:00:00Z').getTime();
      expect(SessionDetector.isInSession(TradingSession.NY, londonTime)).toBe(false);
    });
  });

  describe('getSessionVolatility', () => {
    it('should return 1.0 for Asian session', () => {
      expect(SessionDetector.getSessionVolatility(TradingSession.ASIAN)).toBe(1.0);
    });

    it('should return 1.8 for London session', () => {
      expect(SessionDetector.getSessionVolatility(TradingSession.LONDON)).toBe(1.8);
    });

    it('should return 1.8 for NY session', () => {
      expect(SessionDetector.getSessionVolatility(TradingSession.NY)).toBe(1.8);
    });

    it('should return 1.8 for Overlap session', () => {
      expect(SessionDetector.getSessionVolatility(TradingSession.OVERLAP)).toBe(1.8);
    });
  });

  describe('edge cases', () => {
    it('should handle midnight correctly', () => {
      const midnight = new Date('2025-10-26T00:00:00Z').getTime();
      expect(SessionDetector.getCurrentSession(midnight)).toBe(TradingSession.ASIAN);
    });

    it('should handle session boundaries correctly', () => {
      // 7:59 -> ASIAN
      const beforeLondon = new Date('2025-10-26T07:59:59Z').getTime();
      expect(SessionDetector.getCurrentSession(beforeLondon)).toBe(TradingSession.ASIAN);

      // 8:00 -> LONDON
      const londonStart = new Date('2025-10-26T08:00:00Z').getTime();
      expect(SessionDetector.getCurrentSession(londonStart)).toBe(TradingSession.LONDON);

      // 12:59 -> LONDON
      const beforeOverlap = new Date('2025-10-26T12:59:59Z').getTime();
      expect(SessionDetector.getCurrentSession(beforeOverlap)).toBe(TradingSession.LONDON);

      // 13:00 -> OVERLAP
      const overlapStart = new Date('2025-10-26T13:00:00Z').getTime();
      expect(SessionDetector.getCurrentSession(overlapStart)).toBe(TradingSession.OVERLAP);
    });
  });
});
