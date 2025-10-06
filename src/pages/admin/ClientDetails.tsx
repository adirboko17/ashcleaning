import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Building2, ArrowRight, Plus, X, Image, Calendar, User, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react';
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
          className="inline-flex items-center text-blue-600 hover:text-blue-700"
        >
          <ArrowRight className="h-5 w-5 ml-1" />
          חזרה לרשימת הלקוחות
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">{client.full_name}</h1>
            <p className="text-gray-600" dir="ltr">{client.phone_number}</p>
            <p className="text-sm text-gray-500 mt-1">
              סה״כ {client.branches.length} סניפים
            </p>
          </div>
          <button
            onClick={() => setShowAddBranchModal(true)}
            className="btn btn-primary flex items-center w-full lg:w-auto"
          >
            <Plus className="h-5 w-5 ml-2" />
            הוסף סניף
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branches List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <div className="relative">
                <input
                  type="text"
                  placeholder="חיפוש בסניפים..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                מציג {filteredBranches.length} מתוך {client.branches.length} סניפים
              </p>
            </div>

            <div className="max-h-[calc(100vh-24rem)] overflow-y-auto">
              <div className="divide-y">
                {filteredBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className={`p-4 transition-colors ${
                      selectedBranch?.id === branch.id
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <button
                        onClick={() => handleBranchClick(branch)}
                        className="flex-1 text-right"
                      >
                        <div className="flex items-start space-x-3 space-x-reverse">
                          <Building2 className={`h-5 w-5 shrink-0 mt-1 ${
                            selectedBranch?.id === branch.id ? 'text-blue-500' : 'text-gray-400'
                          }`} />
                          <div>
                            <p className={`font-medium ${
                              selectedBranch?.id === branch.id ? 'text-blue-700' : 'text-gray-900'
                            }`}>{branch.name}</p>
                            <p className={
                              selectedBranch?.id === branch.id ? 'text-blue-600' : 'text-gray-600'
                            }>{branch.address}</p>
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <button
                          onClick={() => {
                            setSelectedBranch(branch);
                            setEditBranchForm({
                              name: branch.name,
                              address: branch.address
                            });
                            setShowEditBranchModal(true);
                          }}
                          className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded"
                          title="ערוך סניף"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBranch(branch);
                            setShowDeleteBranchModal(true);
                          }}
                          className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-100 rounded"
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
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-xl font-bold mb-4">עבודות בסניף {selectedBranch.name}</h2>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={jobDateSearch}
                      onChange={(e) => setJobDateSearch(e.target.value)}
                      className="w-full px-3 py-2 pr-10 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                      dir="ltr"
                    />
                    <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                    {!jobDateSearch && (
                      <span className="absolute right-4 top-2.5 text-gray-400 pointer-events-none">
                      </span>
                    )}
                  </div>
                  {jobDateSearch && (
                    <button
                      onClick={() => setJobDateSearch('')}
                      className="p-2 text-gray-600 hover:text-gray-900 shrink-0"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                
                <p className="mt-2 text-sm text-gray-500">
                  מציג {filteredJobs.length} מתוך {branchJobs.length} עבודות
                </p>
              </div>
              
              <div className="max-h-[calc(100vh-24rem)] overflow-y-auto p-4">
                {isLoadingJobs ? (
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="bg-gray-50 p-6 rounded-lg animate-pulse">
                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-full"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredJobs.length > 0 ? (
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    {filteredJobs.map((job) => (
                      <div key={job.id} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-4">
                          {/* Date and Time */}
                          <div className="flex items-center text-gray-600 mb-3">
                            <Calendar className="h-5 w-5 ml-2" />
                            <div>
                              <p className="font-medium">
                                {format(new Date(job.scheduled_date), 'EEEE, d בMMMM', { locale: he })}
                              </p>
                              <p className="text-sm">
                                {format(new Date(job.scheduled_date), 'HH:mm')}
                              </p>
                            </div>
                          </div>

                          {/* Employee */}
                          <div className="flex items-center text-gray-600 mb-3">
                            <User className="h-5 w-5 ml-2" />
                            <span>{job.employee.full_name}</span>
                          </div>

                          {/* Status and Actions */}
                          <div className="flex items-center justify-between mt-4">
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
                                    className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="ערוך עבודה"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedJob(job);
                                      setShowDeleteJobModal(true);
                                    }}
                                    className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="מחק עבודה"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {job.status === 'completed' && job.receipt_url && (
                                <button
                                  onClick={() => setSelectedImage(job.receipt_url)}
                                  className="text-blue-600 hover:text-blue-700 flex items-center"
                                >
                                  <Image className="h-4 w-4 ml-1" />
                                  צפה בתמונה
                                </button>
                              )}
                            </div>
                          </div>

                          {job.completed_date && (
                            <p className="mt-2 text-sm text-gray-500">
                              הושלם ב-{format(new Date(job.completed_date), 'HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">אין עבודות לסניף זה</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">בחר סניף כדי לצפות בעבודות</p>
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
  className="max-h-[80vh] w-auto max-w-full object-contain mx-auto rounded-lg"
  onClick={(e) => e.stopPropagation()}
/>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDetails;
