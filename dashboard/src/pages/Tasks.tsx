import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

interface Task {
  id: number;
  uuid: string;
  requestId: string;
  action: string;
  status: string;
  priority: number;
  attemptCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  inputData: Record<string, unknown>;
  resultData: Record<string, unknown> | null;
  errorMessage: string | null;
}

interface TasksResponse {
  tasks: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

function Tasks() {
  const { data, loading, error, fetchData } = useApi<TasksResponse>();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.append('status', statusFilter);
    fetchData(`/admin/tasks?${params}`);
  }, [fetchData, page, statusFilter]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'badge-warning',
      running: 'badge-info',
      completed: 'badge-success',
      failed: 'badge-error',
      cancelled: 'badge-neutral',
    };
    return badges[status] || 'badge-ghost';
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('it-IT');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tasks</h1>

        {/* Status filter */}
        <select
          className="select select-bordered w-48"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : data ? (
        <>
          {/* Tasks table */}
          <div className="overflow-x-auto">
            <table className="table table-zebra bg-base-100">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Created</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((task) => (
                  <tr key={task.uuid}>
                    <td className="font-mono text-xs">{task.uuid.substring(0, 8)}...</td>
                    <td>{task.action}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td>{task.attemptCount}</td>
                    <td className="text-sm">{formatDate(task.createdAt)}</td>
                    <td className="text-sm">{formatDate(task.completedAt)}</td>
                    <td>
                      <button
                        className="btn btn-xs btn-ghost"
                        onClick={() => setSelectedTask(task)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                Page {page} of {data.pagination.pages}
              </button>
              <button
                className="join-item btn"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                »
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* Task detail modal */}
      {selectedTask && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Task Details</h3>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm opacity-70">UUID</div>
                  <div className="font-mono text-sm">{selectedTask.uuid}</div>
                </div>
                <div>
                  <div className="text-sm opacity-70">Request ID</div>
                  <div className="font-mono text-sm">{selectedTask.requestId}</div>
                </div>
                <div>
                  <div className="text-sm opacity-70">Action</div>
                  <div>{selectedTask.action}</div>
                </div>
                <div>
                  <div className="text-sm opacity-70">Status</div>
                  <span className={`badge ${getStatusBadge(selectedTask.status)}`}>
                    {selectedTask.status}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-sm opacity-70 mb-1">Input Data</div>
                <pre className="bg-base-200 p-2 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedTask.inputData, null, 2)}
                </pre>
              </div>

              {selectedTask.resultData && (
                <div>
                  <div className="text-sm opacity-70 mb-1">Result Data</div>
                  <pre className="bg-base-200 p-2 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedTask.resultData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedTask.errorMessage && (
                <div className="alert alert-error">
                  <div>
                    <div className="font-bold">Error</div>
                    <div>{selectedTask.errorMessage}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setSelectedTask(null)}>
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setSelectedTask(null)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}

export default Tasks;
