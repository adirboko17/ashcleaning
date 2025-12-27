import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Calendar, CheckCircle, LogOut, Building2, Upload, X, Image, MapPin, ArrowUpDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, endOfToday, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import MobileNav from '../../components/MobileNav';
import Logo from '../../components/Logo';
import imageCompression from 'browser-image-compression';

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
  note?: string;
}

interface GroupedJobs {
  [key: string]: Job[];
}

function EmployeeDashboard() {
  const { user, logout } = useAuthStore();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // If an employee was set to inactive by admin, block access.
  useEffect(() => {
    let isCancelled = false;

    async function ensureActiveEmployee() {
      if (!user?.id) return;
      if (user.role !== 'employee') return;

      const { data, error } = await supabase
        .from('users')
        .select('is_active, role')
        .eq('id', user.id)
        .maybeSingle();

      if (isCancelled) return;
      if (error) return;

      if (data?.role === 'employee' && (data.is_active ?? true) === false) {
        await logout();
      }
    }

    ensureActiveEmployee();
    return () => {
      isCancelled = true;
    };
  }, [user?.id, user?.role, logout]);

  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  const Navigation = () => (
    <nav className="px-3 py-4 space-y-1">
      <Link
        to="/employee/upcoming"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <Calendar className="h-5 w-5 ml-3 text-gray-500" />
        עבודות מתוכננות
      </Link>
      
      <Link
        to="/employee/completed"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <CheckCircle className="h-5 w-5 ml-3 text-gray-500" />
        עבודות שהושלמו
      </Link>
      
      <div className="pt-4 mt-4 border-t border-gray-200">
        <button
          onClick={logout}
          className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all duration-200 font-medium"
        >
          <LogOut className="h-5 w-5 ml-3 text-gray-500" />
          התנתק
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 bg-white shadow-lg border-l border-gray-200">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <Logo className="h-12 w-auto" />
        </div>
        <Navigation />
      </div>

      {/* Mobile Navigation */}
      <MobileNav isOpen={isMobileNavOpen} onToggle={toggleMobileNav}>
        <Navigation />
      </MobileNav>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8">
        <Routes>
          <Route path="/" element={<UpcomingJobs />} />
          <Route path="/upcoming" element={<UpcomingJobs />} />
          <Route path="/completed" element={<CompletedJobs />} />
        </Routes>
      </div>
    </div>
  );
}

function UpcomingJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // asc = קרוב→רחוק
  const user = useAuthStore((state) => state.user);

  const normalizeJob = (row: any): Job => {
    const branch = Array.isArray(row.branch) ? row.branch[0] : row.branch;
    const client = branch && Array.isArray(branch.client) ? branch.client[0] : branch?.client;

    return {
      ...row,
      branch: {
        ...branch,
        client
      }
    } as Job;
  };

  useEffect(() => {
    async function fetchUpcomingJobs() {
      try {
        // First, delete old jobs
        await supabase.rpc('delete_old_jobs');
        
        // If it's 22:00 or later, show tomorrow's jobs too
        const now = new Date();
        const currentHour = now.getHours();
        const endDate = currentHour >= 22 
          ? endOfDay(addDays(now, 1))
          : endOfToday();
        
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            id,
            scheduled_date,
            status,
            completed_date,
            note,
            branch:branches (
              id,
              name,
              address,
              client:users (
                id,
                full_name
              )
            )
          `)
          .eq('employee_id', user?.id)
          .eq('status', 'pending')
          .lte('scheduled_date', endDate.toISOString())
          .order('scheduled_date', { ascending: sortOrder === 'asc' });

        if (error) throw error;
        setJobs((data || []).map(normalizeJob));
      } catch (error) {
        console.error('Error fetching upcoming jobs:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUpcomingJobs();
  }, [user?.id, sortOrder]);

  async function compressImage(file: File): Promise<File> {
    const baseOptions = {
      maxSizeMB: 0.03, // 30KB = 0.03MB
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      return await imageCompression(file, baseOptions);
    } catch (error) {
      // Some mobile browsers (notably iOS Safari) can fail with WebWorker-related errors
      // e.g. "false is not a constructor (evaluating 'new ...')".
      console.warn('Image compression failed with WebWorker, retrying without WebWorker:', error);
      try {
        return await imageCompression(file, { ...baseOptions, useWebWorker: false });
      } catch (error2) {
        console.warn('Image compression failed without WebWorker, using original file:', error2);
        return file; // fallback to original file so upload can still proceed
      }
    }
  }

  async function completeJob() {
    if (!selectedJob || !receiptFile) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // Compress the image before uploading
      const compressedFile = await compressImage(receiptFile);

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
      // If it's 22:00 or later, show tomorrow's jobs too
      const now = new Date();
      const currentHour = now.getHours();
      const endDate = currentHour >= 22 
        ? endOfDay(addDays(now, 1))
        : endOfToday();
      
      const { data: updatedJobs, error: fetchError } = await supabase
        .from('jobs')
        .select(`
          id,
          scheduled_date,
          status,
          completed_date,
          note,
          branch:branches (
            id,
            name,
            address,
            client:users (
              id,
              full_name
            )
          )
        `)
        .eq('employee_id', user?.id)
        .eq('status', 'pending')
        .lte('scheduled_date', endDate.toISOString())
        .order('scheduled_date', { ascending: sortOrder === 'asc' });

      if (fetchError) throw fetchError;
      setJobs((updatedJobs || []).map(normalizeJob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בסיום העבודה');
      console.error('Error completing job:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter jobs by date
  const filteredJobs = jobs.filter(job => {
    if (!selectedDate) return true;
    
    const jobDate = parseISO(job.scheduled_date);
    const searchDate = parseISO(selectedDate);
    
    return isWithinInterval(jobDate, {
      start: startOfDay(searchDate),
      end: endOfDay(searchDate)
    });
  });

  // Group jobs by date
  const groupedJobs = filteredJobs.reduce((groups: GroupedJobs, job) => {
    const date = format(new Date(job.scheduled_date), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(job);
    return groups;
  }, {});

  // Sort dates based on sortOrder
  const sortedDates = Object.keys(groupedJobs).sort((a, b) => {
    const diff = new Date(a).getTime() - new Date(b).getTime();
    return sortOrder === 'asc' ? diff : -diff;
  });

  // Ensure jobs inside each date are also sorted by time (same direction)
  sortedDates.forEach((date) => {
    groupedJobs[date].sort(
      (a, b) => {
        const diff = new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
        return sortOrder === 'asc' ? diff : -diff;
      }
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">עבודות מתוכננות</h1>
            <p className="text-yellow-100">העבודות שלך להיום ולימים קודמים</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-5 py-3 rounded-xl">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{filteredJobs.length}</p>
              <p className="text-xs text-yellow-100">עבודות</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
        <div className="p-6 bg-gradient-to-b from-gray-50 to-white">
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-5 py-3 pr-11 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all appearance-none"
              dir="ltr"
              max={format(new Date(), 'yyyy-MM-dd')}
            />
            <Calendar className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="bg-yellow-50 px-4 py-2 rounded-lg">
              <span className="text-sm font-semibold text-yellow-700">
                {filteredJobs.length} מתוך {jobs.length}
              </span>
              <span className="text-xs text-yellow-600 mr-1">עבודות</span>
            </div>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all"
              title="שנה סדר מיון"
            >
              <ArrowUpDown className="h-4 w-4" />
              מיון: {sortOrder === 'asc' ? 'קרוב → רחוק' : 'רחוק → קרוב'}
            </button>
          </div>
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
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl p-4 mb-4 shadow-sm">
                <h2 className="text-xl font-bold flex items-center text-gray-800">
                  <div className="bg-yellow-500 p-2 rounded-lg ml-3">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  {format(new Date(date), 'EEEE, d בMMMM', { locale: he })}
                </h2>
              </div>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {groupedJobs[date].map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border-r-4 border-yellow-500 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center mb-3">
                            <div className="bg-blue-50 p-2 rounded-lg ml-2">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-900">
                              {job.branch.client.full_name}
                            </h3>
                          </div>
                          <div className="flex items-start text-gray-600 mb-3 bg-gray-50 p-3 rounded-lg">
                            <MapPin className="h-4 w-4 ml-2 mt-1 shrink-0 text-gray-500" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{job.branch.name}</p>
                              <p className="text-sm text-gray-600">{job.branch.address}</p>
                            </div>
                          </div>
                          
                          {/* Note Display */}
                          {!!job.note?.trim() && (
                            <div className="bg-blue-50 border-r-2 border-blue-400 p-3 rounded-lg mb-3">
                              <p className="text-sm text-blue-900">
                                <span className="font-semibold">הערה:</span> {job.note}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white px-4 py-3 rounded-xl shadow-md mr-3">
                          <p className="text-2xl font-bold text-center">
                            {format(
                              new Date(new Date(job.scheduled_date).getTime() + new Date().getTimezoneOffset() * 60000),
                              'HH:mm'
                            )}
                          </p>
                          <p className="text-xs text-yellow-100 text-center">שעה</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="w-full px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="h-5 w-5" />
                        סיים עבודה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg p-16 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-yellow-100 rounded-full mb-6">
            <Calendar className="h-12 w-12 text-yellow-600" />
          </div>
          <p className="text-gray-700 font-bold text-xl mb-2">
            {selectedDate ? 'אין עבודות מתוכננות לתאריך זה' : 'אין עבודות מתוכננות'}
          </p>
          <p className="text-gray-500">כל העבודות שלך הושלמו! 🎉</p>
        </div>
      )}

      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">סיום עבודה</h2>
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
                <p className="font-medium text-gray-900">{selectedJob.branch.client.full_name}</p>
                <p className="text-sm text-gray-600">{selectedJob.branch.name}</p>
                <p className="text-sm text-gray-500">{selectedJob.branch.address}</p>
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
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
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

function CompletedJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const user = useAuthStore((state) => state.user);

  const normalizeJob = (row: any): Job => {
    const branch = Array.isArray(row.branch) ? row.branch[0] : row.branch;
    const client = branch && Array.isArray(branch.client) ? branch.client[0] : branch?.client;

    return {
      ...row,
      branch: {
        ...branch,
        client
      }
    } as Job;
  };

  useEffect(() => {
    async function fetchCompletedJobs() {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            id,
            scheduled_date,
            status,
            completed_date,
            receipt_url,
            note,
            branch:branches (
              id,
              name,
              address,
              client:users (
                id,
                full_name
              )
            )
          `)
          .eq('employee_id', user?.id)
          .eq('status', 'completed')
          .order('completed_date', { ascending: false });

        if (error) throw error;
        setJobs((data || []).map(normalizeJob));
      } catch (error) {
        console.error('Error fetching completed jobs:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCompletedJobs();
  }, [user?.id]);

  // Filter jobs by date
  const filteredJobs = jobs.filter(job => {
    if (!selectedDate) return true;
    
    const jobDate = parseISO(job.completed_date || '');
    const searchDate = parseISO(selectedDate);
    
    return isWithinInterval(jobDate, {
      start: startOfDay(searchDate),
      end: endOfDay(searchDate)
    });
  });

  // Group jobs by completion date
  const groupedJobs = filteredJobs.reduce((groups: GroupedJobs, job) => {
    const date = format(new Date(job.completed_date!), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(job);
    return groups;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">עבודות שהושלמו</h1>
            <p className="text-green-100">היסטוריית העבודות שסיימת</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-5 py-3 rounded-xl">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{filteredJobs.length}</p>
              <p className="text-xs text-green-100">הושלמו</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
        <div className="p-6 bg-gradient-to-b from-gray-50 to-white">
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-5 py-3 pr-11 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all appearance-none"
              dir="ltr"
            />
            <Calendar className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="bg-green-50 px-4 py-2 rounded-lg">
              <span className="text-sm font-semibold text-green-700">
                {filteredJobs.length} מתוך {jobs.length}
              </span>
              <span className="text-xs text-green-600 mr-1">עבודות</span>
            </div>
          </div>
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
          {Object.entries(groupedJobs).map(([date, dateJobs]) => (
            <div key={date}>
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl p-4 mb-4 shadow-sm">
                <h2 className="text-xl font-bold flex items-center text-gray-800">
                  <div className="bg-green-600 p-2 rounded-lg ml-3">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  {format(new Date(date), 'EEEE, d בMMMM', { locale: he })}
                </h2>
              </div>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {dateJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border-r-4 border-green-500 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center mb-3">
                            <div className="bg-blue-50 p-2 rounded-lg ml-2">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-900">
                              {job.branch.client.full_name}
                            </h3>
                          </div>
                          <div className="flex items-start text-gray-600 mb-3 bg-gray-50 p-3 rounded-lg">
                            <MapPin className="h-4 w-4 ml-2 mt-1 shrink-0 text-gray-500" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{job.branch.name}</p>
                              <p className="text-sm text-gray-600">{job.branch.address}</p>
                            </div>
                          </div>
                          
                          {/* Note Display */}
                          {!!job.note?.trim() && (
                            <div className="bg-blue-50 border-r-2 border-blue-400 p-3 rounded-lg mb-3">
                              <p className="text-sm text-blue-900">
                                <span className="font-semibold">הערה:</span> {job.note}
                              </p>
                            </div>
                          )}

                          {/* Completion Time */}
                          <div className="bg-green-50 px-3 py-2 rounded-lg inline-flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">
                              הושלם ב-{format(new Date(job.completed_date!), 'HH:mm')}
                            </span>
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white px-4 py-3 rounded-xl shadow-md mr-3">
                          <p className="text-2xl font-bold text-center">
                            {format(
                              new Date(new Date(job.scheduled_date).getTime() + new Date().getTimezoneOffset() * 60000),
                              'HH:mm'
                            )}
                          </p>
                          <p className="text-xs text-green-100 text-center">שעה</p>
                        </div>
                      </div>
                      {job.receipt_url && (
                        <button
                          onClick={() => setSelectedImage(job.receipt_url!)}
                          className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
                        >
                          <Image className="h-5 w-5" />
                          <span>צפה בקבלה</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg p-16 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
            <Calendar className="h-12 w-12 text-green-600" />
          </div>
          <p className="text-gray-700 font-bold text-xl mb-2">
            {selectedDate ? 'אין עבודות שהושלמו בתאריך זה' : 'אין עבודות שהושלמו'}
          </p>
          <p className="text-gray-500">עבודות שתסיים יופיעו כאן</p>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg"
            >
              <X className="h-6 w-6 text-gray-600" />
            </button>
            <img
              src={selectedImage}
              alt="קבלה"
              className="w-full h-auto rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeDashboard;