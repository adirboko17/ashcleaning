import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useParams } from 'react-router-dom';
import { Building2, Calendar, ClipboardList, LogOut, Search, CheckCircle, Clock, Image, X, ChevronRight, MapPin, ChevronLeft, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import MobileNav from '../../components/MobileNav';
import Logo from '../../components/Logo';
import Contact from './Contact';

interface Branch {
  id: string;
  name: string;
  address: string;
  next_job_date?: string;
}

interface Job {
  id: string;
  status: 'pending' | 'completed';
  scheduled_date: string;
  completed_date?: string;
  receipt_url?: string;
  branch: {
    id: string;
    name: string;
    address: string;
  };
  employee: {
    id: string;
    full_name: string;
  };
}

function ClientDashboard() {
  const { user, logout } = useAuthStore();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const Navigation = () => (
    <nav>
      <Link to="/client/branches" className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100">
        <Building2 className="h-5 w-5 ml-3" />
        הסניפים שלי
      </Link>
      <Link to="/client/schedule" className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100">
        <Calendar className="h-5 w-5 ml-3" />
        לוח עבודות
      </Link>
      <Link to="/client/history" className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100">
        <ClipboardList className="h-5 w-5 ml-3" />
        היסטוריית עבודות
      </Link>
      <Link to="/client/contact" className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100">
        <Mail className="h-5 w-5 ml-3" />
        צור קשר
      </Link>
      <button onClick={logout} className="w-full flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100">
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
      <MobileNav isOpen={isMobileNavOpen} onToggle={() => setIsMobileNavOpen(!isMobileNavOpen)}>
        <Navigation />
      </MobileNav>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8">
        <Routes>
          <Route path="/" element={<BranchesList />} />
          <Route path="/branches" element={<BranchesList />} />
          <Route path="/branches/:id" element={<BranchDetails />} />
          <Route path="/schedule" element={<JobSchedule />} />
          <Route path="/history" element={<JobHistory />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
    </div>
  );
}

function BranchesList() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchBranches() {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select(`
            id,
            name,
            address,
            jobs (
              scheduled_date,
              status
            )
          `)
          .eq('client_id', user?.id)
          .order('name');

        if (error) throw error;

        const branchesWithNextJob =
          data?.map((branch: any) => ({
            ...branch,
            next_job_date: branch.jobs
              ?.filter((j: any) => j.status === 'pending')
              .sort((a: any, b: any) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0]
              ?.scheduled_date,
          })) || [];

        setBranches(branchesWithNextJob);
      } catch (e) {
        console.error('Error fetching branches:', e);
      } finally {
        setIsLoading(false);
      }
    }
    if (user) fetchBranches();
  }, [user]);

  const filtered = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">הסניפים שלי</h1>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="חיפוש לפי שם או כתובת..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-2 text-sm text-gray-500">מציג {filtered.length} מתוך {branches.length} סניפים</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((branch) => (
            <Link
              key={branch.id}
              to={`/client/branches/${branch.id}`}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4" dir="rtl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Building2 className="h-5 w-5 text-blue-600 ml-2" />
                    <h3 className="font-medium text-gray-900">{branch.name}</h3>
                  </div>
                  <ChevronLeft className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex items-start text-gray-600">
                  <MapPin className="h-4 w-4 ml-2 mt-1 shrink-0" />
                  <p className="leading-tight">{branch.address}</p>
                </div>
                {branch.next_job_date && (
                  <div className="mt-4 flex items-center text-sm text-blue-600">
                    <Calendar className="h-4 w-4 ml-2" />
                    <span>
                      עבודה הבאה: {format(new Date(branch.next_job_date), 'EEEE, d בMMMM', { locale: he })}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">לא נמצאו סניפים</p>
        </div>
      )}
    </div>
  );
}

function BranchDetails() {
  const { id } = useParams<{ id: string }>();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    async function fetchBranchDetails() {
      try {
        const [branchResponse, jobsResponse] = await Promise.all([
          supabase.from('branches').select('*').eq('id', id).single(),
          supabase
            .from('jobs')
            .select(`
              id, status, scheduled_date, completed_date, receipt_url,
              branch:branches ( id, name, address ),
              employee:users ( id, full_name )
            `)
            .eq('branch_id', id)
            .order('scheduled_date', { ascending: false }),
        ]);
        if (branchResponse.error) throw branchResponse.error;
        if (jobsResponse.error) throw jobsResponse.error;
        setBranch(branchResponse.data);
        setJobs(jobsResponse.data || []);
      } catch (e) {
        console.error('Error fetching branch details:', e);
      } finally {
        setIsLoading(false);
      }
    }
    if (id) fetchBranchDetails();
  }, [id]);

  const filteredJobs = jobs.filter((job) => {
    if (!selectedDate) return true;
    const jobDate = parseISO(job.scheduled_date);
    const searchDate = parseISO(selectedDate);
    return isWithinInterval(jobDate, { start: startOfDay(searchDate), end: endOfDay(searchDate) });
  });

  return (
    <div>
      <div className="mb-6">
        <Link to="/client/branches" className="inline-flex items-center text-blue-600 hover:text-blue-700">
          <ChevronRight className="h-5 w-5 ml-1" />
          חזרה לרשימת הסניפים
        </Link>
      </div>

      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white p-6 rounded-lg shadow">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      ) : branch ? (
        <>
          <div className="bg-white p-6 rounded-lg shadow mb-6" dir="rtl">
            <h1 className="text-2xl font-bold mb-2">{branch.name}</h1>
            <p className="text-gray-600">{branch.address}</p>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold mb-4">היסטוריית עבודות</h2>

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

              <p className="mt-2 text-sm text-gray-500">
                מציג {filteredJobs.length} מתוך {jobs.length} עבודות
              </p>
            </div>

            <div className="divide-y">
              {filteredJobs.map((job) => (
                <div key={job.id} className="p-4 hover:bg-gray-50">
                  {/* GRID: [date | middle | status] on sm+, stacked on mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-center gap-4">
                    {/* RIGHT: date (fixed width) */}
                    <div className="flex items-center text-gray-600 sm:justify-start sm:min-w-[220px]">
                      <Calendar className="h-5 w-5 ml-2" />
                      <div>
                        <p className="font-medium">{format(new Date(job.scheduled_date), 'EEEE, d בMMMM', { locale: he })}</p>
                        <p className="text-sm">{format(new Date(job.scheduled_date), 'HH:mm')}</p>
                      </div>
                    </div>

                    {/* MIDDLE: name + address (text-right, fills remaining) */}
                    <div className="text-right">
                      <p className="font-medium text-gray-900 leading-tight">{job.branch.name}</p>
                      <p className="text-sm text-gray-600 leading-tight">{job.branch.address}</p>
                    </div>

                    {/* LEFT: status (fixed width) */}
                    <div className="flex items-center justify-start text-gray-600 sm:justify-end sm:min-w-[140px]">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {job.status === 'completed' ? <CheckCircle className="h-4 w-4 ml-1" /> : <Clock className="h-4 w-4 ml-1" />}
                        {job.status === 'completed' ? 'הושלם' : 'ממתין'}
                      </span>
                    </div>

                    {/* completed extras */}
                    {job.status === 'completed' && (
                      <div className="sm:col-span-3 flex items-center gap-4 mt-2">
                        <p className="text-sm text-gray-500">הושלם ב-{format(new Date(job.completed_date!), 'HH:mm')}</p>
                        {job.receipt_url && (
                          <button onClick={() => setSelectedImage(job.receipt_url)} className="text-blue-600 hover:text-blue-700 flex items-center">
                            <Image className="h-4 w-4 ml-1" />
                            צפה בתמונה
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Image Modal */}
          {selectedImage && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={() => setSelectedImage(null)}>
              <div className="relative max-w-4xl w-full flex items-center justify-center">
                <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg z-10">
                  <X className="h-6 w-6 text-gray-600" />
                </button>
                <img 
                  src={selectedImage} 
                  alt="קבלה" 
                  className="max-h-[90vh] w-auto max-w-full object-contain rounded-lg shadow-2xl" 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">סניף לא נמצא</h1>
          <Link to="/client/branches" className="text-blue-600 hover:underline">
            חזרה לרשימת הסניפים
          </Link>
        </div>
      )}
    </div>
  );
}

function JobSchedule() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchScheduledJobs() {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            id,status,scheduled_date,
            branch:branches!inner ( id, name, address, client_id ),
            employee:users ( id, full_name )
          `)
          .eq('status', 'pending')
          .eq('branch.client_id', user?.id)
          .gte('scheduled_date', new Date().toISOString())
          .order('scheduled_date', { ascending: true });
        if (error) throw error;
        setJobs(data || []);
      } catch (e) {
        console.error('Error fetching scheduled jobs:', e);
      } finally {
        setIsLoading(false);
      }
    }
    if (user) fetchScheduledJobs();
  }, [user]);

  const filtered = jobs.filter((job) => {
    if (!selectedDate) return true;
    const jobDate = parseISO(job.scheduled_date);
    const searchDate = parseISO(selectedDate);
    return isWithinInterval(jobDate, { start: startOfDay(searchDate), end: endOfDay(searchDate) });
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">לוח עבודות</h1>

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
          </div>
          <p className="mt-2 text-sm text-gray-500">מציג {filtered.length} מתוך {jobs.length} עבודות מתוכננות</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow">
              <div className="p-4">
                {/* GRID layout keeps middle column fixed start */}
                <div className="grid grid-cols-1 sm:grid-cols-[400px_1fr_200px] items-center gap-4">
                  {/* RIGHT: date (fixed width) */}
                  <div className="flex items-center text-gray-600 sm:min-w-[220px]">
                    <Calendar className="h-5 w-5 ml-2" />
                    <div>
                      <p className="font-medium">{format(new Date(job.scheduled_date), 'EEEE, d MMMM', { locale: he })}</p>
                      <p className="text-sm">{format(new Date(job.scheduled_date), 'HH:mm')}</p>
                    </div>
                  </div>

                  {/* MIDDLE: name + address */}
                  <div className="text-right">
                    <p className="font-medium text-gray-900 leading-tight">{job.branch.name}</p>
                    <p className="text-sm text-gray-600 leading-tight">{job.branch.address}</p>
                  </div>

                  {/* LEFT: status (fixed width) */}
                  <div className="flex items-center text-gray-600 justify-end sm:min-w-[140px]">
                    <Clock className="h-4 w-4 ml-1" />
                    <span className="text-sm">ממתין לביצוע</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">אין עבודות מתוכננות</p>
        </div>
      )}
    </div>
  );
}

function JobHistory() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchCompletedJobs() {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            id,status,scheduled_date,completed_date,receipt_url,
            branch:branches!inner ( id, name, address, client_id ),
            employee:users ( id, full_name )
          `)
          .eq('status', 'completed')
          .eq('branch.client_id', user?.id)
          .order('scheduled_date', { ascending: false });
        if (error) throw error;
        setJobs(data || []);
      } catch (e) {
        console.error('Error fetching completed jobs:', e);
      } finally {
        setIsLoading(false);
      }
    }
    if (user) fetchCompletedJobs();
  }, [user]);

  const filtered = jobs.filter((job) => {
    if (!selectedDate) return true;
    const jobDate = parseISO(job.scheduled_date || '');
    const searchDate = parseISO(selectedDate);
    return isWithinInterval(jobDate, { start: startOfDay(searchDate), end: endOfDay(searchDate) });
  });

  // group by date
  const grouped = filtered.reduce((acc: { [k: string]: Job[] }, job) => {
    const k = format(new Date(job.scheduled_date), 'yyyy-MM-dd');
    (acc[k] ||= []).push(job);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">היסטוריית עבודות</h1>

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
          </div>
          <p className="mt-2 text-sm text-gray-500">מציג {filtered.length} מתוך {jobs.length} עבודות שהושלמו</p>
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
      ) : filtered.length > 0 ? (
        <div className="space-y-8">
          {sortedDates.map((date) => (
            <div key={date}>
              <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-700" dir="rtl">
                <Calendar className="h-5 w-5 ml-2" />
                {format(new Date(date), 'EEEE, d בMMMM', { locale: he })}
              </h2>

              <div className="space-y-4">
                {grouped[date].map((job) => (
                  <div key={job.id} className="bg-white rounded-lg shadow">
                    <div className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-center gap-4">
                        {/* RIGHT: date */}
                        <div className="flex items-center text-gray-600 sm:min-w-[220px]">
                          <Calendar className="h-5 w-5 ml-2" />
                          <div>
                            <p className="font-medium">{format(new Date(job.scheduled_date), 'EEEE, d MMMM', { locale: he })}</p>
                            <p className="text-sm">{format(new Date(job.scheduled_date), 'HH:mm')}</p>
                          </div>
                        </div>

                        {/* MIDDLE */}
                        <div className="text-right">
                          <p className="font-medium text-gray-900 leading-tight">{job.branch.name}</p>
                          <p className="text-sm text-gray-600 leading-tight">{job.branch.address}</p>
                        </div>

                        {/* LEFT */}
                        <div className="flex items-center gap-4 justify-end sm:min-w-[140px]">
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 ml-1" />
                            <span className="text-sm">הושלם</span>
                          </div>
                          {job.completed_date && (
                            <p className="text-sm text-green-600">הושלם ב-{format(new Date(job.completed_date), 'HH:mm')}</p>
                          )}
                          {job.receipt_url && (
                            <button onClick={() => setSelectedImage(job.receipt_url)} className="flex items-center text-blue-600 hover:text-blue-700">
                              <Image className="h-4 w-4 ml-1" />
                              <span className="text-sm">צפה בקבלה</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">אין היסטוריית עבודות</p>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full flex items-center justify-center">
            <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg z-10">
              <X className="h-6 w-6 text-gray-600" />
            </button>
            <img 
              src={selectedImage} 
              alt="קבלה" 
              className="max-h-[90vh] w-auto max-w-full object-contain rounded-lg shadow-2xl" 
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDashboard;
