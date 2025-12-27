import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Search, Building2, User, Clock, Image, X, CheckCircle, MapPin } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { compressReceiptImage } from '../../utils/receiptImage';

interface Job {
  id: string;
  branch: {
    id: string;
    name: string | null;
    address: string | null;
    client: {
      id: string;
      full_name: string | null;
    } | null;
  } | null;
  employee: {
    id: string;
    full_name: string | null;
  } | null;
  scheduled_date: string;
  status: 'pending' | 'completed';
}

export default function ExecuteJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPendingJobs();
  }, []);

  async function fetchPendingJobs() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          scheduled_date,
          status,
          branch:branches (
            id,
            name,
            address,
            client:users (
              id,
              full_name
            )
          ),
          employee:users (
            id,
            full_name
          )
        `)
        .eq('status', 'pending')
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching pending jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function completeJob() {
    if (!selectedJob || !receiptFile) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // Compress the image before uploading (never throws; falls back to original)
      const compressedFile = await compressReceiptImage(receiptFile);

      // Update job status first
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          completed_date: new Date().toISOString()
        })
        .eq('id', selectedJob.id);

      if (updateError) throw updateError;

      // Then try to upload the compressed receipt
      try {
        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `${selectedJob.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, compressedFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(fileName);

          // Update job with receipt URL
          await supabase
            .from('jobs')
            .update({ receipt_url: publicUrl })
            .eq('id', selectedJob.id);
        }
      } catch (uploadError) {
        console.error('Error uploading receipt:', uploadError);
        // Don't throw here - job is still completed even if receipt upload fails
      }
      
      setSelectedJob(null);
      setReceiptFile(null);
      
      // Fetch jobs again to update the list
      fetchPendingJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בסיום העבודה');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter jobs by search term and date
  const filteredJobs = jobs.filter(job => {
    const clientName = job.branch?.client?.full_name ?? '';
    const branchName = job.branch?.name ?? '';
    const branchAddress = job.branch?.address ?? '';
    const employeeName = job.employee?.full_name ?? '';

    const searchMatch =
      clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branchAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employeeName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!selectedDate) return searchMatch;

    const jobDate = parseISO(job.scheduled_date);
    const searchDate = parseISO(selectedDate);

    return searchMatch && isWithinInterval(jobDate, {
      start: startOfDay(searchDate),
      end: endOfDay(searchDate)
    });
  });

  // Group jobs by date
  const groupedJobs = filteredJobs.reduce((groups: { [key: string]: Job[] }, job) => {
    const date = format(new Date(job.scheduled_date), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(job);
    return groups;
  }, {});

  // Sort dates in ascending order
  const sortedDates = Object.keys(groupedJobs).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ביצוע עבודות</h1>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="חיפוש לפי לקוח, סניף, או עובד..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            {/* Date Filter */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                dir="ltr"
              />
              <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            מציג {filteredJobs.length} מתוך {jobs.length} עבודות ממתינות
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="space-y-4">
                <div className="h-24 bg-gray-100 rounded-lg"></div>
                <div className="h-24 bg-gray-100 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredJobs.length > 0 ? (
        <div className="space-y-8">
          {sortedDates.map((date) => (
            <div key={date}>
              <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-700">
                <Calendar className="h-5 w-5 ml-2" />
                {format(new Date(date), 'EEEE, d בMMMM', { locale: he })}
              </h2>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {groupedJobs[date].map((job) => (
                  <div key={job.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center mb-2">
                            <Building2 className="h-5 w-5 text-blue-600 ml-2" />
                            <h3 className="font-medium text-gray-900">
                              {job.branch?.client?.full_name ?? 'לקוח לא ידוע'}
                            </h3>
                          </div>
                          <div className="flex items-start text-gray-600">
                            <MapPin className="h-4 w-4 ml-2 mt-1 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{job.branch?.name ?? 'סניף ללא שם'}</p>
                              <p className="text-sm">{job.branch?.address ?? ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center mt-2 text-gray-600">
                            <User className="h-4 w-4 ml-2" />
                            <p className="text-sm">{job.employee?.full_name ?? 'ללא עובד'}</p>
                          </div>
                        </div>
                        <p className="text-lg font-medium text-gray-900">
                          {format(
                            new Date(new Date(job.scheduled_date).getTime() + new Date().getTimezoneOffset() * 60000),
                            'HH:mm'
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                      >
                        ביצוע עבודה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {selectedDate ? 'אין עבודות ממתינות לתאריך זה' : 'אין עבודות ממתינות'}
          </p>
        </div>
      )}

      {/* Complete Job Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">ביצוע עבודה</h2>
              <button
                onClick={() => {
                  setSelectedJob(null);
                  setReceiptFile(null);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-900">{selectedJob.branch?.client?.full_name ?? 'לקוח לא ידוע'}</p>
                <p className="text-sm text-gray-600">{selectedJob.branch?.name ?? 'סניף ללא שם'}</p>
                <p className="text-sm text-gray-500">{selectedJob.branch?.address ?? ''}</p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="receipt-upload"
                />
                <label
                  htmlFor="receipt-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Image className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    {receiptFile ? receiptFile.name : 'העלה תמונת קבלה'}
                  </span>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-4 space-x-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJob(null);
                    setReceiptFile(null);
                    setError(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  disabled={isSubmitting}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={completeJob}
                  disabled={!receiptFile || isSubmitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'מסיים...' : 'סיים עבודה'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}