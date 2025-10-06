import React, { useState, useEffect } from 'react';
import { Plus, Calendar, X, Search, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import JobFilters from './components/JobFilters';
import JobCard from './components/JobCard';
import JobModals from './components/JobModals';
import { localToUTC, utcToDatetimeLocal } from '../../utils/dateUtils';

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

interface Branch {
  id: string;
  name: string;
  address: string;
  client: {
    id: string;
    full_name: string;
  };
}

interface AddJobForm {
  branch_id: string;
  employee_id: string;
  scheduled_date: string;
}

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editForm, setEditForm] = useState({
    employee_id: '',
    scheduled_date: ''
  });
  const [addForm, setAddForm] = useState<AddJobForm>({
    branch_id: '',
    employee_id: '',
    scheduled_date: ''
  });
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedClientBranches, setSelectedClientBranches] = useState<Branch[]>([]);
  const [branchSearchTerm, setBranchSearchTerm] = useState('');

  useEffect(() => {
    fetchJobs();
    fetchEmployees();
    fetchBranches();
  }, []);

  async function fetchJobs() {
    try {
      let allJobs: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
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
            ),
            employee:users (
              id,
              full_name
            )
          `)
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('scheduled_date', { ascending: true });

        if (error) throw error;
        
        if (!data || data.length === 0) break;
        
        allJobs = [...allJobs, ...data];
        page++;
      }

      // Remove duplicate jobs by id to avoid React duplicate key issues
      const uniqueJobs = [...new Map(allJobs.map((j) => [j.id, j])).values()]
        .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
      setJobs(uniqueJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoading(false);
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

  async function fetchBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select(`
          id,
          name,
          address,
          client:users (
            id,
            full_name
          )
        `)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  }

  const handleEditJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          employee_id: editForm.employee_id,
          scheduled_date: localToUTC(editForm.scheduled_date)
        })
        .eq('id', selectedJob.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedJob(null);
      setEditForm({
        employee_id: '',
        scheduled_date: ''
      });
      fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בעדכון העבודה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('jobs')
        .insert([{
          branch_id: addForm.branch_id,
          employee_id: addForm.employee_id,
          scheduled_date: localToUTC(addForm.scheduled_date),
          status: 'pending'
        }]);

      if (error) throw error;

      setShowAddModal(false);
      setAddForm({
        branch_id: '',
        employee_id: '',
        scheduled_date: ''
      });
      setClientSearchTerm('');
      setBranchSearchTerm('');
      setSelectedClientBranches([]);
      fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בהוספת העבודה');
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

      setShowDeleteModal(false);
      setSelectedJob(null);
      fetchJobs();
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

  const filteredJobs = jobs.filter(job => {
    const searchMatch =
      job.branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.branch.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.branch.client?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.employee?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const statusMatch =
      statusFilter === 'all' || job.status === statusFilter;

    let dateMatch = true;
    if (selectedDate) {
      const jobDate = parseISO(job.scheduled_date);
      const searchDate = parseISO(selectedDate);
      dateMatch = isWithinInterval(jobDate, {
        start: startOfDay(searchDate),
        end: endOfDay(searchDate)
      });
    }

    return searchMatch && statusMatch && dateMatch;
  });

  const filteredClients = branches.reduce((acc: Branch[], branch) => {
    const clientExists = acc.some(b => b.client.id === branch.client.id);
    if (!clientExists && 
        branch.client.full_name.toLowerCase().includes(clientSearchTerm.toLowerCase())) {
      acc.push(branch);
    }
    return acc;
  }, []);

  const filteredBranches = selectedClientBranches.filter(branch =>
    branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(branchSearchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">ניהול עבודות</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center w-full lg:w-auto"
        >
          <Plus className="h-5 w-5 ml-2" />
          הוסף עבודה חדשה
        </button>
      </div>

      <JobFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        totalJobs={jobs.length}
        filteredCount={filteredJobs.length}
      />

      <div className="bg-white rounded-lg shadow mt-6">
        <div className="divide-y">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="animate-pulse">
                  <div className="h-20 bg-gray-100 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : filteredJobs.length > 0 ? (
            filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onEdit={(job) => {
                  setSelectedJob(job);
                  setEditForm({
                    employee_id: job.employee.id,
                    scheduled_date: utcToDatetimeLocal(job.scheduled_date)
                  });
                  setShowEditModal(true);
                }}
                onDelete={(job) => {
                  setSelectedJob(job);
                  setShowDeleteModal(true);
                }}
                onViewImage={(url) => setSelectedImage(url)}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">לא נמצאו עבודות</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">הוספת עבודה חדשה</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddForm({
                    branch_id: '',
                    employee_id: '',
                    scheduled_date: ''
                  });
                  setClientSearchTerm('');
                  setBranchSearchTerm('');
                  setSelectedClientBranches([]);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  חיפוש בית עסק
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearchTerm}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value);
                      setSelectedClientBranches([]);
                      setAddForm(prev => ({ ...prev, branch_id: '' }));
                    }}
                    className="input pr-10"
                    placeholder="חפש לפי שם בית עסק..."
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
                {clientSearchTerm && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {filteredClients.map((branch) => (
                      <button
                        key={branch.client.id}
                        type="button"
                        onClick={() => {
                          setClientSearchTerm(branch.client.full_name);
                          setSelectedClientBranches(
                            branches.filter(b => b.client.id === branch.client.id)
                          );
                        }}
                        className="w-full text-right p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 ml-2 text-gray-400" />
                          <span>{branch.client.full_name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedClientBranches.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    בחירת סניף
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={branchSearchTerm}
                      onChange={(e) => setBranchSearchTerm(e.target.value)}
                      className="input pr-10"
                      placeholder="חפש לפי שם או כתובת סניף..."
                    />
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {filteredBranches.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => {
                          setBranchSearchTerm(`${branch.name} - ${branch.address}`);
                          setAddForm(prev => ({ ...prev, branch_id: branch.id }));
                        }}
                        className={`w-full text-right p-3 hover:bg-gray-50 ${
                          addForm.branch_id === branch.id ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <div className="font-medium">{branch.name}</div>
                        <div className="text-sm text-gray-600">{branch.address}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {addForm.branch_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    בחירת עובד
                  </label>
                  <select
                    value={addForm.employee_id}
                    onChange={(e) => setAddForm(prev => ({ ...prev, employee_id: e.target.value }))}
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
              )}

              {addForm.employee_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    תאריך ושעה
                  </label>
                  <input
                    type="datetime-local"
                    value={addForm.scheduled_date}
                    onChange={(e) => setAddForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="input"
                    required
                    dir="ltr"
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-4 space-x-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setAddForm({
                      branch_id: '',
                      employee_id: '',
                      scheduled_date: ''
                    });
                    setClientSearchTerm('');
                    setBranchSearchTerm('');
                    setSelectedClientBranches([]);
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
                  disabled={!addForm.branch_id || !addForm.employee_id || !addForm.scheduled_date || isSubmitting}
                >
                  {isSubmitting ? 'מוסיף...' : 'הוסף עבודה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <JobModals
        selectedJob={selectedJob}
        showEditModal={showEditModal}
        showDeleteModal={showDeleteModal}
        editForm={editForm}
        employees={employees}
        isSubmitting={isSubmitting}
        error={error}
        onEditSubmit={handleEditJob}
        onDeleteConfirm={handleDeleteJob}
        onEditClose={() => {
          setShowEditModal(false);
          setSelectedJob(null);
          setEditForm({
            employee_id: '',
            scheduled_date: ''
          });
          setError(null);
        }}
        onDeleteClose={() => {
          setShowDeleteModal(false);
          setSelectedJob(null);
          setError(null);
        }}
        onEditFormChange={(field, value) => 
          setEditForm(prev => ({ ...prev, [field]: value }))
        }
      />

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-[600px] w-full">
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