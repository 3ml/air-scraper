import { useEffect } from 'react';
import { useApi } from '../hooks/useApi';

interface Stats {
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  performance: {
    avgDurationMs: number | null;
    successRate: number;
  };
  recent: {
    last24h: number;
    lastHour: number;
  };
}

interface Health {
  status: string;
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    browserPool: number;
    pendingTasks: number;
    runningTasks: number;
  };
}

function Dashboard() {
  const { data: stats, loading: statsLoading, fetchData: fetchStats } = useApi<Stats>();
  const { data: health, loading: healthLoading, fetchData: fetchHealth } = useApi<Health>();

  useEffect(() => {
    fetchStats('/admin/stats');
    fetchHealth('/health');

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchStats('/admin/stats');
      fetchHealth('/health');
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchStats, fetchHealth]);

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Health Status */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">System Status</h2>
          {healthLoading ? (
            <span className="loading loading-spinner"></span>
          ) : health ? (
            <div className="flex flex-wrap gap-4">
              <div className="stat">
                <div className="stat-title">Status</div>
                <div className={`stat-value text-sm ${health.status === 'ok' ? 'text-success' : 'text-error'}`}>
                  {health.status.toUpperCase()}
                </div>
              </div>
              <div className="stat">
                <div className="stat-title">Uptime</div>
                <div className="stat-value text-sm">{formatUptime(health.uptime)}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Version</div>
                <div className="stat-value text-sm">{health.version}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Database</div>
                <div className={`stat-value text-sm ${health.checks.database ? 'text-success' : 'text-error'}`}>
                  {health.checks.database ? 'OK' : 'ERROR'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-error">Failed to load health status</div>
          )}
        </div>
      </div>

      {/* Task Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statsLoading ? (
          <div className="col-span-5 flex justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : stats ? (
          <>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">Total</div>
              <div className="stat-value">{stats.tasks.total}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">Pending</div>
              <div className="stat-value text-warning">{stats.tasks.pending}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">Running</div>
              <div className="stat-value text-info">{stats.tasks.running}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">Completed</div>
              <div className="stat-value text-success">{stats.tasks.completed}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">Failed</div>
              <div className="stat-value text-error">{stats.tasks.failed}</div>
            </div>
          </>
        ) : null}
      </div>

      {/* Performance Metrics */}
      {stats && (
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Performance</h2>
            <div className="flex flex-wrap gap-8">
              <div>
                <div className="text-sm opacity-70">Avg Duration</div>
                <div className="text-2xl font-bold">{formatDuration(stats.performance.avgDurationMs)}</div>
              </div>
              <div>
                <div className="text-sm opacity-70">Success Rate</div>
                <div className="text-2xl font-bold">{stats.performance.successRate}%</div>
              </div>
              <div>
                <div className="text-sm opacity-70">Last 24h</div>
                <div className="text-2xl font-bold">{stats.recent.last24h}</div>
              </div>
              <div>
                <div className="text-sm opacity-70">Last Hour</div>
                <div className="text-2xl font-bold">{stats.recent.lastHour}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
