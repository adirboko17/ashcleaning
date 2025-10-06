import React from 'react';
import { X } from 'lucide-react';
import { localToUTC } from '../../../utils/dateUtils';
import { useAuthStore } from '../../../store/authStore';

interface Job {
  id: string;
  branch: {
    id: string;
    name: string;
    address: string;
    client: {
      id: string;
      full_name: string;
    };
  };
  scheduled_date: string;
  status: 'pending' | 'completed';
  completed_date?: string;
  receipt_url?: string;
  employee: {
    id: string;
    full_name: string;
  };
}

interface Employee {
  id: string;
  full_name: string;
}

interface JobModalsProps {
  selectedJob: Job | null;
  showEditModal: boolean;
  showDeleteModal: boolean;
  editForm: {
    employee_id: string;
    scheduled_date: string;
  };
  employees: Employee[];
  isSubmitting: boolean;
  error: string | null;
  onEditSubmit: (e: React.FormEvent) => void;
  onDeleteConfirm: () => void;
  onEditClose: () => void;
  onDeleteClose: () => void;
  onEditFormChange: (field: string, value: string) => void;
}

export default function JobModals({
  selectedJob,
  showEditModal,
  showDeleteModal,
  editForm,
  employees,
  isSubmitting,
  error,
  onEditSubmit,
  onDeleteConfirm,
  onEditClose,
  onDeleteClose,
  onEditFormChange
}: JobModalsProps) {
  const user = useAuthStore(state => state.user);
  const isAdmin = user?.role === 'admin';

  if (!selectedJob) return null;

  return (
    <>
      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">עריכת עבודה</h2>
              <button
                onClick={onEditClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={onEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  עובד
                </label>
                <select
                  value={editForm.employee_id}
                  onChange={(e) => onEditFormChange('employee_id', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">בחר עובד</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  תאריך ושעה
                </label>
                <input
                  type="datetime-local"
                  value={editForm.scheduled_date}
                  onChange={(e) => onEditFormChange('scheduled_date', e.target.value)}
                  className="input"
                  required
                  dir="ltr"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-4 space-x-reverse">
                <button
                  type="button"
                  onClick={onEditClose}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">מחיקת עבודה</h2>
              <button
                onClick={onDeleteClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700">
                האם אתה בטוח שברצונך למחוק את העבודה?
              </p>
              <p className="text-sm text-red-600 mt-2">
                פעולה זו אינה ניתנת לביטול.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-4">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-4 space-x-reverse">
              <button
                type="button"
                onClick={onDeleteClose}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onDeleteConfirm}
                className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'מוחק...' : 'מחק עבודה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}