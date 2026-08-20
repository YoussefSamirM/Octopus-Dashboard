const { calculateWfmDay } = require('./engine.cjs');

describe('WFM Calculation Engine', () => {
  it('should correctly merge overlapping online intervals for the same agent', () => {
    // Agent is online 10:00 - 10:20 and 10:10 - 10:30 (overlap) -> total should be 30 mins
    const rawStatusLogs = [
      { email: 'agent1', status: 'ONLINE', start: new Date('2026-08-10T10:00:00').getTime(), end: new Date('2026-08-10T10:20:00').getTime() },
      { email: 'agent1', status: 'ONLINE', start: new Date('2026-08-10T10:10:00').getTime(), end: new Date('2026-08-10T10:30:00').getTime() }
    ];

    const input = {
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      rawStatusLogs,
      reqStd: { 'Combined': { '2026-08-10': { '600': { hours: 1, agents: 2 } } } },
      reskills: [],
      att: { '2026-08-10': { 'agent1': 'Combined' } },
      dStats: {}
    };

    const { globalProcessedData } = calculateWfmDay(input);
    const dayData = globalProcessedData['2026-08-10'].std;
    const combinedLOB = dayData.Combined;
    
    // Interval 600 is 10:00. 
    // They are online from 10:00 to 10:30, which is exactly 30 minutes (0.5 hours).
    const interval10 = combinedLOB.intervals.find(i => i.label === '10:00');
    expect(interval10).toBeDefined();
    expect(interval10.act).toBe(0.5); // 30 mins = 0.5 hours
    expect(interval10.req).toBe(1);
    expect(interval10.bill).toBe(0.5); // billable is Math.min(act, req)
  });

  it('should correctly allocate time across interval boundaries', () => {
    // Online from 10:15 to 10:45.
    // This spans two intervals: 10:00-10:30 (15 mins) and 10:30-11:00 (15 mins).
    const rawStatusLogs = [
      { email: 'agent1', status: 'ONLINE', start: new Date('2026-08-10T10:15:00').getTime(), end: new Date('2026-08-10T10:45:00').getTime() }
    ];

    const input = {
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      rawStatusLogs,
      reqStd: { 
        'Combined': { 
          '2026-08-10': { 
            '600': { hours: 1, agents: 2 }, // 10:00
            '630': { hours: 1, agents: 2 }  // 10:30
          } 
        } 
      },
      reskills: [],
      att: { '2026-08-10': { 'agent1': 'Combined' } },
      dStats: {}
    };

    const { globalProcessedData } = calculateWfmDay(input);
    const dayData = globalProcessedData['2026-08-10'].std;
    
    const interval1000 = dayData.Combined.intervals.find(i => i.label === '10:00');
    expect(interval1000.act).toBe(0.25); // 15 mins = 0.25 hours

    const interval1030 = dayData.Combined.intervals.find(i => i.label === '10:30');
    expect(interval1030.act).toBe(0.25); // 15 mins = 0.25 hours
  });
});
