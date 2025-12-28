import React from 'react';
import { Calendar, CheckCircle, Clock, Image, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { utcToIsrael, formatHebrewDate, formatTime } from '../../../utils/dateUtils';
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

interface JobCardProps {
  job: Job;
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
  onViewImage: (url: string) => void;
}

export default function JobCard({ job, onEdit, onDelete, onViewImage }: JobCardProps) {
  const scheduledDate = utcToIsrael(job.scheduled_date);
  const completedDate = job.completed_date ? utcToIsrael(job.completed_date) : null;
  const user = useAuthStore(state => state.user);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Date and Time */}
        <div className="flex items-center text-gray-600">
          <Calendar className="h-5 w-5 ml-2" />
          <div>
            <p className="font-medium">
              {formatHebrewDate(scheduledDate)}
            </p>
            <p className="text-sm">
              {formatTime(scheduledDate)}
            </p>
          </div>
        </div>

        {/* Client and Branch */}
        <div className="flex-1">
          <Link
            to={job.branch?.client?.id ? `/admin/clients/${job.branch.client.id}` : '#'}
            className="font-medium text-gray-900 hover:text-blue-600"
          >
            {job.branch?.client?.full_name || 'לקוח לא ידוע'}
          </Link>
          <p className="text-sm text-gray-600">
            {job.branch?.name || 'סניף לא ידוע'} - {job.branch?.address || 'כתובת לא ידועה'}
          </p>
        </div>

        {/* Employee */}
        <div className="flex items-center text-gray-600">
          <span>{job.employee?.full_name || 'לא משויך'}</span>
        </div>

        {/* Status and Actions */}
        <div className="flex items-center gap-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            job.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {job.status === 'completed' ? (
              <CheckCircle className="h-4 w-4 ml-1" />
            ) : (
              <Clock className="h-4 w-4 ml-1" />
            )}
            {job.status === 'completed' ? 'הושלם' : 'ממתין'}
          </span>

          <div className="flex items-center space-x-2 space-x-reverse">
            {(job.status === 'pending' || isAdmin) && (
              <>
                <button
                  onClick={() => onEdit(job)}
                  className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="ערוך עבודה"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(job)}
                  className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                  title="מחק עבודה"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            {job.status === 'completed' && job.receipt_url && (
              <button
                onClick={() => onViewImage(job.receipt_url!)}
                className="text-blue-600 hover:text-blue-700 flex items-center"
              >
                <Image className="h-4 w-4 ml-1" />
                צפה בתמונה
              </button>
            )}
          </div>
        </div>
      </div>

      {completedDate && (
        <p className="mt-2 text-sm text-gray-500">
          הושלם ב-{formatTime(completedDate)}
        </p>
      )}
    </div>
  );
}