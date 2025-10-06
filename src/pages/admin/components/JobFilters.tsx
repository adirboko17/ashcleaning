import React from 'react';
import { Calendar, Search } from 'lucide-react';

interface JobFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedDate: string;
  onDateChange: (value: string) => void;
  statusFilter: 'all' | 'pending' | 'completed';
  onStatusChange: (status: 'all' | 'pending' | 'completed') => void;
  totalJobs: number;
  filteredCount: number;
}

export default function JobFilters({
  searchTerm,
  onSearchChange,
  selectedDate,
  onDateChange,
  statusFilter,
  onStatusChange,
  totalJobs,
  filteredCount
}: JobFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="חיפוש לפי לקוח, סניף, או עובד..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Date Filter */}
            <div className="relative flex-1">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                dir="ltr"
              />
              <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="flex rounded-lg border border-gray-300 p-1">
              <button
                onClick={() => onStatusChange('all')}
                className={`flex-1 px-3 py-1 rounded ${
                  statusFilter === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                הכל
              </button>
              <button
                onClick={() => onStatusChange('pending')}
                className={`flex-1 px-3 py-1 rounded ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                ממתינות
              </button>
              <button
                onClick={() => onStatusChange('completed')}
                className={`flex-1 px-3 py-1 rounded ${
                  statusFilter === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                הושלמו
              </button>
            </div>
          </div>
        </div>

        <p className="mt-2 text-sm text-gray-500">
          מציג {filteredCount} מתוך {totalJobs} עבודות
        </p>
      </div>
    </div>
  );
}