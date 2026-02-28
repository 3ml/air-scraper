import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

interface Log {
  id: number;
  taskId: number | null;
  requestId: string;
  level: string;
  message: string;
  context: Record<string, unknown> | null;
  source: string;
  timestamp: string;
}

interface LogsResponse {
  logs: Log[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

function Logs() {
  const { data, loading, error, fetchData } = useApi<LogsResponse>();
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [requestIdFilter, setRequestIdFilter] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadLogs = () => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (levelFilter) params.append('level', levelFilter);
    if (requestIdFilter) params.append('requestId', requestIdFilter);
    fetchData(`/admin/logs?${params}`);
  };

  useEffect(() => {
    loadLogs();
  }, [page, levelFilter, requestIdFilter]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, page, levelFilter, requestIdFilter]);

  const getLevelBadge = (level: string) => {
    const badges: Record<string, string> = {
      trace: 'badge-ghost',
      debug: 'badge-neutral',
      info: 'badge-info',
      warn: 'badge-warning',
      error: 'badge-error',
      fatal: 'badge-error',
    };
    return badges[level] || 'badge-ghost';
  };

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Logs</h1>

        <div className="flex gap-2 items-center">
          {/* Auto-refresh toggle */}
          <label className="label cursor-pointer gap-2">
            <span className="label-text">Auto-refresh</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
          </label>

          {/* Level filter */}
          <select
            className="select select-bordered select-sm w-32"
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All levels</option>
            <option value="trace">Trace</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="fatal">Fatal</option>
          </select>

          {/* Request ID filter */}
          <input
            type="text"
            placeholder="Request ID"
            className="input input-bordered input-sm w-48"
            value={requestIdFilter}
            onChange={(e) => {
              setRequestIdFilter(e.target.value);
              setPage(1);
            }}
          />

          <button className="btn btn-sm" onClick={loadLogs}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : data ? (
        <>
          {/* Logs list */}
          <div className="space-y-2">
            {data.logs.map((log) => (
              <div
                key={log.id}
                className={`card bg-base-100 shadow-sm ${
                  log.level === 'error' || log.level === 'fatal' ? 'border-l-4 border-error' : ''
                }`}
              >
                <div className="card-body p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 min-w-20">
                      <span className={`badge badge-sm ${getLevelBadge(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-xs opacity-50">{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{log.message}</div>
                      <div className="flex gap-2 text-xs opacity-70 mt-1">
                        <span>Source: {log.source}</span>
                        <span>|</span>
                        <span className="font-mono">{log.requestId.substring(0, 8)}...</span>
                        {log.taskId && (
                          <>
                            <span>|</span>
                            <span>Task #{log.taskId}</span>
                          </>
                        )}
                      </div>
                      {log.context && Object.keys(log.context).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer opacity-70">
                            Context
                          </summary>
                          <pre className="bg-base-200 p-2 rounded text-xs mt-1 overflow-auto">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.logs.length === 0 && (
            <div className="text-center py-8 opacity-50">No logs found</div>
          )}

          {/* Pagination */}
          <div className="flex justify-center">
            <div className="join">
              <button
                className="join-item btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                «
              </button>
              <button className="join-item btn">
                Page {page} of {data.pagination.pages || 1}
              </button>
              <button
                className="join-item btn"
                disabled={page >= (data.pagination.pages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                »
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default Logs;
