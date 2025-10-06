import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Calendar, CheckCircle, LogOut, Building2, Upload, X, Image, MapPin, Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, isBefore, endOfToday, startOfToday } from 'date-fns';
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
}

interface GroupedJobs {
  [key: string]: Job[];
}

function EmployeeDashboard() {
  const { user, logout } = useAuthStore();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  const Navigation = () => (
    <nav>
      <Link
        to="/employee/upcoming"
        className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100"
      >
        <Calendar className="h-5 w-5 ml-3" />
        עבודות מתוכננות
      </Link>
      
      <Link
        to="/employee/completed"
        className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100"
      >
        <CheckCircle className="h-5 w-5 ml-3" />
        עבודות שהושלמו
      </Link>
      
      <button
        onClick={logout}
        className="w-full flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100"
      >
        <LogOut className="h-5 w-5 ml-3" />
        התנתק
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 bg-white shadow-lg">
        <div className="p-4">
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
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    async function fetchUpcomingJobs() {
      try {
        // First, delete old jobs
        await supabase.rpc('delete_old_jobs');
        
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            id,
            scheduled_date,
            status,
            completed_date,
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
          .lte('scheduled_date', endOfToday().toISOString())
          .order('scheduled_date', { ascending: true });

        if (error) throw error;
        setJobs(data || []);
      } catch (error) {
        console.error('Error fetching upcoming jobs:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUpcomingJobs();
  }, [user?.id]);

  async function compressImage(file: File): Promise<File> {
    const options = {
      maxSizeMB: 0.03, // 30KB = 0.03MB
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
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
      const { data: updatedJobs, error: fetchError } = await supabase
        .from('jobs')
        .select(`
          id,
          scheduled_date,
          status,
          completed_date,
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
        .lte('scheduled_date', endOfToday().toISOString())
        .order('scheduled_date', { ascending: false });

      if (fetchError) throw fetchError;
      setJobs(updatedJobs || []);
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

  // Sort dates in descending order (most recent first)
  const sortedDates = Object.keys(groupedJobs).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">עבודות מתוכננות</h1>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4">
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              dir="ltr"
              max={format(new Date(), 'yyyy-MM-dd')}
            />
            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            {!selectedDate && (
              <span className="absolute right-4 top-2.5 text-gray-400 pointer-events-none">
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            מציג {filteredJobs.length} מתוך {jobs.length} עבודות מתוכננות
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
                              {job.branch.client.full_name}
                            </h3>
                          </div>
                          <div className="flex items-start text-gray-600">
                            <MapPin className="h-4 w-4 ml-2 mt-1 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{job.branch.name}</p>
                              <p className="text-sm">{job.branch.address}</p>
                            </div>
                          </div>
                        </div>
                    
                      </div>
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                      >
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
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {selectedDate ? 'אין עבודות מתוכננות לתאריך זה' : 'אין עבודות מתוכננות'}
          </p>
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
        setJobs(data || []);
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
      <h1 className="text-2xl font-bold mb-6">עבודות שהושלמו</h1>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4">
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              dir="ltr"
            />
            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            {!selectedDate && (
              <span className="absolute right-4 top-2.5 text-gray-400 pointer-events-none">
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            מציג {filteredJobs.length} מתוך {jobs.length} עבודות שהושלמו
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
          {Object.entries(groupedJobs).map(([date, dateJobs]) => (
            <div key={date}>
              <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-700">
                <Calendar className="h-5 w-5 ml-2" />
                {format(new Date(date), 'EEEE, d בMMMM', { locale: he })}
              </h2>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {dateJobs.map((job) => (
                  <div key={job.id} className="bg-white rounded-lg shadow-sm">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center mb-2">
                            <Building2 className="h-5 w-5 text-blue-600 ml-2" />
                            <h3 className="font-medium text-gray-900">
                              {job.branch.client.full_name}
                            </h3>
                          </div>
                          <div className="flex items-start text-gray-600">
                            <MapPin className="h-4 w-4 ml-2 mt-1 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{job.branch.name}</p>
                              <p className="text-sm">{job.branch.address}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-left">

                          <p className="text-sm text-green-600">
                            הושלם ב-{format(new Date(job.completed_date!), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      {job.receipt_url && (
                        <button
                          onClick={() => setSelectedImage(job.receipt_url!)}
                          className="w-full mt-2 flex items-center justify-center space-x-2 space-x-reverse bg-blue-50 text-blue-600 px-4 py-2 rounded-md hover:bg-blue-100 transition-colors"
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
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {selectedDate ? 'אין עבודות שהושלמו בתאריך זה' : 'אין עבודות שהושלמו'}
          </p>
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