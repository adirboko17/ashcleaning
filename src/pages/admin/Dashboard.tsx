import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Users, Building2, Calendar, LogOut, Plus, X, LayoutDashboard, Search, ChevronLeft, Clock, CheckCircle, User, UserPlus, FileText, ClipboardCheck, Route as RouteIcon, FileSpreadsheet } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import ClientsList from './ClientsList';
import ClientDetails from './ClientDetails';
import EmployeesList from './EmployeesList';
import JobsList from './JobsList';
import Reports from './Reports';
import ExecuteJobs from './ExecuteJobs';
import WorkRoutes from './WorkRoutes';
import Templates from './Templates';
import { format, addDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import MobileNav from '../../components/MobileNav';
import Logo from '../../components/Logo';
import Contact from './Contact';

interface DashboardStats {
  totalClients: number;
  totalEmployees: number;
  totalBranches: number;
  pendingJobs: number;
  completedJobs: number;
}

function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  const Navigation = () => (
    <nav className="px-3 py-4 space-y-1">
      <Link
        to="/admin"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <LayoutDashboard className="h-5 w-5 ml-3 text-gray-500" />
        דאשבורד ראשי
      </Link>
      
      <Link
        to="/admin/clients"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <Building2 className="h-5 w-5 ml-3 text-gray-500" />
        לקוחות וסניפים
      </Link>
      
      <Link
        to="/admin/employees"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <Users className="h-5 w-5 ml-3 text-gray-500" />
        עובדים
      </Link>
      
      <Link
        to="/admin/jobs"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <Calendar className="h-5 w-5 ml-3 text-gray-500" />
        עבודות
      </Link>

      <Link
        to="/admin/templates"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <FileSpreadsheet className="h-5 w-5 ml-3 text-gray-500" />
        תבניות
      </Link>

      <Link
        to="/admin/routes"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <RouteIcon className="h-5 w-5 ml-3 text-gray-500" />
        קווי עבודה
      </Link>

      <Link
        to="/admin/execute"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <ClipboardCheck className="h-5 w-5 ml-3 text-gray-500" />
        ביצוע עבודות
      </Link>

      <Link
        to="/admin/reports"
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200 font-medium"
      >
        <FileText className="h-5 w-5 ml-3 text-gray-500" />
        דוחות
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
          <Route path="/" element={<AdminOverview />} />
          <Route path="/clients" element={<ClientsList />} />
          <Route path="/clients/:id" element={<ClientDetails />} />
          <Route path="/employees" element={<EmployeesList />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/routes" element={<WorkRoutes />} />
          <Route path="/execute" element={<ExecuteJobs />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
    </div>
  );
}

function AdminOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalEmployees: 0,
    totalBranches: 0,
    pendingJobs: 0,
    completedJobs: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [
          clientsResponse,
          employeesResponse,
          branchesResponse,
          pendingJobsResponse,
          completedJobsResponse,
          recentJobsResponse
        ] = await Promise.all([
          // Get total clients
          supabase
            .from('users')
            .select('id', { count: 'exact' })
            .eq('role', 'client'),
          
          // Get total employees
          supabase
            .from('users')
            .select('id', { count: 'exact' })
            .eq('role', 'employee'),
          
          // Get total branches
          supabase
            .from('branches')
            .select('id', { count: 'exact' }),
          
          // Get pending jobs count
          supabase
            .from('jobs')
            .select('id', { count: 'exact' })
            .eq('status', 'pending'),
          
          // Get completed jobs count
          supabase
            .from('jobs')
            .select('id', { count: 'exact' })
            .eq('status', 'completed'),
          
          // Get recent completed jobs instead of all jobs
          supabase
            .from('jobs')
            .select(`
              id,
              status,
              scheduled_date,
              completed_date,
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
            .eq('status', 'completed')
            .order('completed_date', { ascending: false })
            .limit(5)
        ]);

        setStats({
          totalClients: clientsResponse.count || 0,
          totalEmployees: employeesResponse.count || 0,
          totalBranches: branchesResponse.count || 0,
          pendingJobs: pendingJobsResponse.count || 0,
          completedJobs: completedJobsResponse.count || 0
        });

        if (recentJobsResponse.data) {
          setRecentJobs(recentJobsResponse.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">דאשבורד ראשי</h1>

      {isLoading ? (
        <div className="space-y-6">
          {/* Stats Loading */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="bg-white p-6 rounded-lg shadow animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>

          {/* Recent Jobs Loading */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            </div>
            <div className="divide-y">
              {[1, 2, 3].map((n) => (
                <div key={n} className="p-4">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">סה״כ לקוחות</p>
              <p className="text-2xl font-bold">{stats.totalClients}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">סה״כ עובדים</p>
              <p className="text-2xl font-bold">{stats.totalEmployees}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">סה״כ סניפים</p>
              <p className="text-2xl font-bold">{stats.totalBranches}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">עבודות ממתינות</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingJobs}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">עבודות שהושלמו</p>
              <p className="text-2xl font-bold text-green-600">{stats.completedJobs}</p>
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">עבודות אחרונות שהושלמו</h2>
            </div>
            
            <div className="divide-y">
              {recentJobs.length > 0 ? (
                recentJobs.map((job) => (
                  <div key={job.id} className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center mb-1">
                          <Building2 className="h-4 w-4 text-blue-600 ml-2" />
                          <p className="font-medium text-blue-600">
                            {job.branch?.client?.full_name || 'לקוח לא ידוע'}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600">
                          {job.branch?.name || 'סניף לא ידוע'} - {job.branch?.address || 'כתובת לא ידועה'}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">
                            {format(new Date(job.scheduled_date), 'EEEE, d בMMMM', { locale: he })}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(job.scheduled_date), 'HH:mm')}
                          </p>
                        </div>

                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-4 w-4 ml-1" />
                          הושלם
                        </span>
                      </div>
                    </div>
                    {job.completed_date && (
                      <p className="mt-2 text-sm text-gray-500">
                        הושלם ב-{format(new Date(job.completed_date), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  אין עבודות שהושלמו לאחרונה
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;