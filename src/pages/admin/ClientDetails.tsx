import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Building2, ArrowRight, Plus, X, Image, Calendar, User, CheckCircle, Clock, Edit, Trash2, Phone } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface Job {
  id: string;
  status: 'pending' | 'completed';
  scheduled_date: string;
  completed_date?: string;
  receipt_url?: string;
  employee: {
    id: string;
    full_name: string;
  };
}

interface Branch {
  id: string;
  name: string;
  address: string;
  jobs?: Job[];
}

interface Client {
  id: string;
  full_name: string;
  phone_number: string;
  branches: Branch[];
}

interface AddBranchForm {
  name: string;
  address: string;
}

interface EditBranchForm {
  name: string;
  address: string;
}

interface EditJobForm {
  employee_id: string;
  scheduled_date: string;
}

function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [showDeleteBranchModal, setShowDeleteBranchModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branchJobs, setBranchJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [branchForm, setBranchForm] = useState<AddBranchForm>({
    name: '',
    address: ''
  });
  const [editBranchForm, setEditBranchForm] = useState<EditBranchForm>({
    name: '',
    address: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobDateSearch, setJobDateSearch] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showEditJobModal, setShowEditJobModal] = useState(false);
  const [showDeleteJobModal, setShowDeleteJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editJobForm, setEditJobForm] = useState<EditJobForm>({
    employee_id: '',
    scheduled_date: ''
  });
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string; }>>([]);

  useEffect(() => {
    if (id) {
      fetchClient(id);

      const branchesSubscription = supabase
        .channel('client-branches-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'branches',
            filter: `client_id=eq.${id}`
          },
          () => {
            fetchClient(id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(branchesSubscription);
      };
    }
  }, [id]);

  useEffect(() => {
    if (selectedBranch) {
      fetchBranchJobs(selectedBranch.id);

      const jobsSubscription = supabase
        .channel('branch-jobs-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: `branch_id=eq.${selectedBranch.id}`
          },
          () => {
            fetchBranchJobs(selectedBranch.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(jobsSubscription);
      };
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (showEditJobModal) {
      fetchEmployees();
    }
  }, [showEditJobModal]);

  async function fetchClient(clientId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          phone_number,
          branches (
            id,
            name,
            address
          )
        `)
        .eq('id', clientId)
        .eq('role', 'client')
        .single();

      if (error) throw error;
      setClient(data);
    } catch (error) {
      console.error('Error fetching client:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchBranchJobs(branchId: string) {
    setIsLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          status,
          scheduled_date,
          completed_date,
          receipt_url,
          employee:users (
            id,
            full_name
          )
        `)
        .eq('branch_id', branchId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setBranchJobs(data || []);
    } catch (error) {
      console.error('Error fetching branch jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  }

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'employee')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setError(null);
    setIsSubmitting(true);

    try {
      if (!branchForm.name || !branchForm.address) {
        throw new Error('נא למלא את כל השדות');
      }

      const { error } = await supabase
        .from('branches')
        .insert([{
          name: branchForm.name,
          address: branchForm.address,
          client_id: client.id
        }]);

      if (error) throw error;

      setShowAddBranchModal(false);
      setBranchForm({ name: '', address: '' });
      fetchClient(client.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בהוספת הסניף');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('branches')
        .update({
          name: editBranchForm.name,
          address: editBranchForm.address
        })
        .eq('id', selectedBranch.id);

      if (error) throw error;

      setShowEditBranchModal(false);
      setSelectedBranch(null);
      if (client) {
        fetchClient(client.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בעדכון הסניף');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!selectedBranch) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', selectedBranch.id);

      if (error) throw error;

      setShowDeleteBranchModal(false);
      setSelectedBranch(null);
      if (client) {
        fetchClient(client.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה במחיקת הסניף');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          employee_id: editJobForm.employee_id,
          scheduled_date: editJobForm.scheduled_date
        })
        .eq('id', selectedJob.id);

      if (error) throw error;

      setShowEditJobModal(false);
      setSelectedJob(null);
      setEditJobForm({
        employee_id: '',
        scheduled_date: ''
      });
      if (selectedBranch) {
        fetchBranchJobs(selectedBranch.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בעדכון העבודה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!selectedJob) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', selectedJob.id);

      if (error) throw error;

      setShowDeleteJobModal(false);
      setSelectedJob(null);
      if (selectedBranch) {
        fetchBranchJobs(selectedBranch.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה במחיקת העבודה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBranchClick = (branch: Branch) => {
    setSelectedBranch(branch);
    setJobDateSearch('');
    fetchBranchJobs(branch.id);
  };

  const filteredBranches = client?.branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredJobs = branchJobs.filter(job => {
    if (!jobDateSearch) return true;
    
    const jobDate = parseISO(job.scheduled_date);
    const searchDate = parseISO(jobDateSearch);
    
    return isWithinInterval(jobDate, {
      start: startOfDay(searchDate),
      end: endOfDay(searchDate)
    });
  });

  if (isLoading) {
    return (
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
    );
  }

  if (!client) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">לקוח לא נמצא</h1>
        <Link to="/admin/clients" className="text-blue-600 hover:underline">
          חזרה לרשימת הלקוחות
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/admin/clients"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          <ArrowRight className="h-5 w-5 ml-1" />
          חזרה לרשימת הלקוחות
        </Link>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-xl shadow-lg mb-8 border border-blue-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-3 text-gray-900">{client.full_name}</h1>
            <div className="flex items-center text-gray-700 mb-2" dir="ltr">
              <Phone className="h-5 w-5 ml-2 text-blue-600" />
              <span className="text-lg font-medium">{client.phone_number}</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-blue-600 text-white shadow-sm">
                <Building2 className="h-4 w-4 ml-1" />
                {client.branches.length} סניפים
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowAddBranchModal(true)}
            className="btn btn-primary flex items-center w-full lg:w-auto shadow-lg hover:shadow-xl transition-shadow"
          >
            <Plus className="h-5 w-5 ml-2" />
            הוסף סניף
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branches List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="p-5 border-b bg-gradient-to-r from-gray-50 to-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-3">סניפים</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="חיפוש בסניפים..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 pr-11 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              </div>
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">{filteredBranches.length}</span> מתוך <span className="font-semibold">{client.branches.length}</span> סניפים
              </p>
            </div>

            <div className="max-h-[calc(100vh-24rem)] overflow-y-auto">
              <div className="divide-y divide-gray-100">
                {filteredBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className={`p-4 transition-all ${
                      selectedBranch?.id === branch.id
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-r-4 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => handleBranchClick(branch)}
                        className="flex-1 text-right"
                      >
                        <div className="flex items-start space-x-3 space-x-reverse">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            selectedBranch?.id === branch.id 
                              ? 'bg-blue-500 shadow-md' 
                              : 'bg-gray-100'
                          }`}>
                            <Building2 className={`h-5 w-5 ${
                              selectedBranch?.id === branch.id ? 'text-white' : 'text-gray-500'
                            }`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`font-semibold text-sm ${
                              selectedBranch?.id === branch.id ? 'text-blue-900' : 'text-gray-900'
                            }`}>{branch.name}</p>
                            <p className={`text-xs mt-1 ${
                              selectedBranch?.id === branch.id ? 'text-blue-700' : 'text-gray-600'
                            }`}>{branch.address}</p>
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center space-x-1 space-x-reverse">
                        <button
                          onClick={() => {
                            setSelectedBranch(branch);
                            setEditBranchForm({
                              name: branch.name,
                              address: branch.address
                            });
                            setShowEditBranchModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-all"
                          title="ערוך סניף"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBranch(branch);
                            setShowDeleteBranchModal(true);
                          }}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all"
                          title="מחק סניף"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="lg:col-span-2">
          {selectedBranch ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100">
              <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-gray-100">
                <h2 className="text-xl font-bold mb-4 text-gray-900">עבודות בסניף {selectedBranch.name}</h2>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={jobDateSearch}
                      onChange={(e) => setJobDateSearch(e.target.value)}
                      className="w-full px-4 py-2.5 pr-11 pl-11 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition-all"
                      dir="ltr"
                    />
                    <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
                    {!jobDateSearch && (
                      <span className="absolute right-4 top-3 text-gray-400 pointer-events-none text-sm">
                      </span>
                    )}
                  </div>
                  {jobDateSearch && (
                    <button
                      onClick={() => setJobDateSearch('')}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0 transition-all"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                
                <p className="mt-3 text-xs text-gray-600">
                  מציג <span className="font-semibold">{filteredJobs.length}</span> מתוך <span className="font-semibold">{branchJobs.length}</span> עבודות
                </p>
              </div>
              
              <div className="max-h-[calc(100vh-24rem)] overflow-y-auto p-6">
                {isLoadingJobs ? (
                  <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl animate-pulse border border-gray-200">
                        <div className="h-6 bg-gray-200 rounded-lg w-3/4 mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded-lg w-full"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredJobs.length > 0 ? (
                  <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
                    {filteredJobs.map((job) => (
                      <div key={job.id} className={`rounded-xl shadow-md hover:shadow-xl transition-all border-2 ${
                        job.status === 'completed' 
                          ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
                          : 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200'
                      }`}>
                        <div className="p-5">
                          {/* Date and Time */}
                          <div className="flex items-start bg-white/70 p-3 rounded-lg mb-3 shadow-sm">
                            <Calendar className="h-5 w-5 ml-3 text-blue-600 mt-0.5" />
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {format(new Date(job.scheduled_date), 'EEEE, d בMMMM', { locale: he })}
                              </p>
                              <p className="text-blue-600 font-bold text-lg">
                                {format(new Date(job.scheduled_date), 'HH:mm')}
                              </p>
                            </div>
                          </div>

                          {/* Employee */}
                          <div className="flex items-center bg-white/70 p-3 rounded-lg mb-3 shadow-sm">
                            <User className="h-5 w-5 ml-2 text-indigo-600" />
                            <span className="font-semibold text-gray-900">{job.employee.full_name}</span>
                          </div>

                          {/* Status and Actions */}
                          <div className="flex items-center justify-between mt-4">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                              job.status === 'completed' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-yellow-500 text-white'
                            }`}>
                              {job.status === 'completed' ? (
                                <CheckCircle className="h-4 w-4 ml-1" />
                              ) : (
                                <Clock className="h-4 w-4 ml-1" />
                              )}
                              {job.status === 'completed' ? 'הושלם' : 'ממתין'}
                            </span>

                            <div className="flex items-center space-x-1.5 space-x-reverse">
                              {job.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedJob(job);
                                      setEditJobForm({
                                        employee_id: job.employee.id,
                                        scheduled_date: job.scheduled_date.slice(0, 16)
                                      });
                                      setShowEditJobModal(true);
                                    }}
                                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-all shadow-sm"
                                    title="ערוך עבודה"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedJob(job);
                                      setShowDeleteJobModal(true);
                                    }}
                                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all shadow-sm"
                                    title="מחק עבודה"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {job.status === 'completed' && job.receipt_url && (
                                <button
                                  onClick={() => setSelectedImage(job.receipt_url)}
                                  className="text-blue-600 hover:text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg flex items-center font-medium text-sm transition-all shadow-sm"
                                >
                                  <Image className="h-4 w-4 ml-1" />
                                  צפה בתמונה
                                </button>
                              )}
                            </div>
                          </div>

                          {job.completed_date && (
                            <p className="mt-3 text-xs text-gray-600 bg-white/50 px-3 py-1.5 rounded-md inline-block">
                              הושלם ב-{format(new Date(job.completed_date), 'HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl">
                    <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-semibold text-lg">אין עבודות לסניף זה</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl shadow-lg p-16 text-center border-2 border-dashed border-gray-300">
              <div className="bg-white p-6 rounded-full inline-block shadow-md mb-4">
                <Building2 className="h-16 w-16 text-blue-500" />
              </div>
              <p className="text-gray-700 font-semibold text-xl mb-2">בחר סניף כדי לצפות בעבודות</p>
              <p className="text-gray-500 text-sm">לחץ על אחד הסניפים ברשימה כדי להציג את העבודות שלו</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Branch Modal */}
      {showAddBranchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">הוספת סניף חדש</h2>
              <button
                onClick={() => {
                  setShowAddBranchModal(false);
                  setBranchForm({ name: '', address: '' });
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddBranch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם הסניף
                </label>
                <input
                  type="text"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="הכנס שם סניף"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  כתובת
                </label>
                <input
                  type="text"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm(prev => ({ ...prev, address: e.target.value }))}
                  className="input"
                  placeholder="הכנס כתובת"
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
                  onClick={() => {
                    setShowAddBranchModal(false);
                    setBranchForm({ name: '', address: '' });
                    setError(null);
                  }}
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
                  {isSubmitting ? 'מוסיף...' : 'הוסף סניף'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {showEditBranchModal && selectedBranch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">עריכת סניף</h2>
              <button
                onClick={() => {
                  setShowEditBranchModal(false);
                  setSelectedBranch(null);
                  setEditBranchForm({ name: '', address: '' });
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditBranch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם הסניף
                </label>
                <input
                  type="text"
                  value={editBranchForm.name}
                  onChange={(e) => setEditBranchForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="הכנס שם סניף"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  כתובת
                </label>
                <input
                  type="text"
                  value={editBranchForm.address}
                  onChange={(e) => setEditBranchForm(prev => ({ ...prev, address: e.target.value }))}
                  className="input"
                  placeholder="הכנס כתובת"
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
                  onClick={() => {
                    setShowEditBranchModal(false);
                    setSelectedBranch(null);
                    setEditBranchForm({ name: '', address: '' });
                    setError(null);
                  }}
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

      {/* Delete Branch Modal */}
      {showDeleteBranchModal && selectedBranch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">מחיקת סניף</h2>
              <button
                onClick={() => {
                  setShowDeleteBranchModal(false);
                  setSelectedBranch(null);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700">
                האם אתה בטוח שברצונך למחוק את הסניף {selectedBranch.name}?
              </p>
              <p className="text-sm text-red-600 mt-2">
                פעולה זו תמחק את כל העבודות המשויכות לסניף זה ולא ניתן יהיה לשחזר אותן.
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
                onClick={() => {
                  setShowDeleteBranchModal(false);
                  setSelectedBranch(null);
                  setError(null);
                }}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleDeleteBranch}
                className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'מוחק...' : 'מחק סניף'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditJobModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">עריכת עבודה</h2>
              <button
                onClick={() => {
                  setShowEditJobModal(false);
                  setSelectedJob(null);
                  setEditJobForm({
                    employee_id: '',
                    scheduled_date: ''
                  });
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  עובד
                </label>
                <select
                  value={editJobForm.employee_id}
                  onChange={(e) => setEditJobForm(prev => ({ ...prev, employee_id: e.target.value }))}
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
                  value={editJobForm.scheduled_date}
                  onChange={(e) => setEditJobForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
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
                  onClick={() => {
                    setShowEditJobModal(false);
                    setSelectedJob(null);
                    setEditJobForm({
                      employee_id: '',
                      scheduled_date: ''
                    });
                    setError(null);
                  }}
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

      {/* Delete Job Modal */}
      {showDeleteJobModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">מחיקת עבודה</h2>
              <button
                onClick={() => {
                  setShowDeleteJobModal(false);
                  setSelectedJob(null);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700">
                האם אתה בטוח שברצונך למחוק את העבודה המתוכננת ל-
                {format(new Date(selectedJob.scheduled_date), 'EEEE, d בMMMM', { locale: he })}
                {' '}
                בשעה
                {' '}
                {format(new Date(selectedJob.scheduled_date), 'HH:mm')}
                ?
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
                onClick={() => {
                  setShowDeleteJobModal(false);
                  setSelectedJob(null);
                  setError(null);
                }}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleDeleteJob}
                className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'מוחק...' : 'מחק עבודה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl w-full flex items-center justify-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg z-10"
            >
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

export default ClientDetails;
