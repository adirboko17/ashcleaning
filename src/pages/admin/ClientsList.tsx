import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Building2, Edit, ChevronLeft, X, Phone, Calendar, Plus, Trash2, Download } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface Branch {
  id: string;
  name: string;
  address: string;
  next_job_date?: string;
}

interface Client {
  id: string;
  phone_number: string;
  full_name: string;
  branches: Branch[];
}

interface EditClientForm {
  full_name: string;
  phone_number: string;
  password: string;
}

interface BranchInput {
  name: string;
  address: string;
}

interface AddClientForm {
  business_name: string;
  phone_number: string;
  password: string;
  branches: BranchInput[];
}

function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState<EditClientForm>({
    full_name: '',
    phone_number: '',
    password: ''
  });
  const [addForm, setAddForm] = useState<AddClientForm>({
    business_name: '',
    phone_number: '',
    password: '',
    branches: [{ name: '', address: '' }]
  });

  useEffect(() => {
    fetchClients();

    // Subscribe to changes in users table for clients
    const subscription = supabase
      .channel('clients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: 'role=eq.client'
        },
        () => {
          fetchClients();
        }
      )
      .subscribe();

    const branchesSubscription = supabase
      .channel('branches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branches'
        },
        () => {
          fetchClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(branchesSubscription);
    };
  }, []);

  async function fetchClients() {
    try {
      const now = new Date().toISOString();
      
      const { data: clientsData, error: clientsError } = await supabase
        .from('users')
        .select(`
          id,
          phone_number,
          full_name,
          branches (
            id,
            name,
            address,
            jobs (
              scheduled_date,
              status
            )
          )
        `)
        .eq('role', 'client')
        .order('full_name');

      if (clientsError) throw clientsError;

      // Process and sort branches by next job date
      const processedClients = clientsData?.map(client => ({
        ...client,
        branches: client.branches
          .map(branch => ({
            ...branch,
            next_job_date: branch.jobs
              ?.filter(job => job.status === 'pending' && job.scheduled_date >= now)
              .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0]
              ?.scheduled_date
          }))
          .filter(branch => branch.next_job_date)
          .sort((a, b) => {
            if (!a.next_job_date) return 1;
            if (!b.next_job_date) return -1;
            return new Date(a.next_job_date).getTime() - new Date(b.next_job_date).getTime();
          })
          .slice(0, 3)
      })) || [];

      setClients(processedClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const updates: any = {
        full_name: editForm.full_name,
        phone_number: editForm.phone_number
      };

      if (editForm.password) {
        updates.password = editForm.password;
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', selectedClient.id);

      if (error) throw error;

      setShowEditModal(false);
      fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בעדכון הלקוח');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate password length
      if (addForm.password.length < 6) {
        throw new Error('סיסמה חייבת להכיל לפחות 6 תווים');
      }

      // Validate branches
      if (addForm.branches.some(branch => !branch.name || !branch.address)) {
        throw new Error('יש למלא את כל פרטי הסניפים');
      }

      // Insert new client
      const { data: clientData, error: clientError } = await supabase
        .from('users')
        .insert([{
          full_name: addForm.business_name,
          phone_number: addForm.phone_number,
          password: addForm.password,
          role: 'client'
        }])
        .select()
        .single();

      if (clientError) throw clientError;

      // Insert branches
      const { error: branchesError } = await supabase
        .from('branches')
        .insert(
          addForm.branches.map(branch => ({
            name: branch.name,
            address: branch.address,
            client_id: clientData.id
          }))
        );

      if (branchesError) throw branchesError;

      setShowAddModal(false);
      setAddForm({
        business_name: '',
        phone_number: '',
        password: '',
        branches: [{ name: '', address: '' }]
      });
      fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בהוספת הלקוח');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', clientToDelete.id);

      if (error) throw error;

      setShowDeleteModal(false);
      setClientToDelete(null);
      fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה במחיקת הלקוח');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addBranch = () => {
    setAddForm(prev => ({
      ...prev,
      branches: [...prev.branches, { name: '', address: '' }]
    }));
  };

  const removeBranch = (index: number) => {
    setAddForm(prev => ({
      ...prev,
      branches: prev.branches.filter((_, i) => i !== index)
    }));
  };

  const updateBranch = (index: number, field: keyof BranchInput, value: string) => {
    setAddForm(prev => ({
      ...prev,
      branches: prev.branches.map((branch, i) => 
        i === index ? { ...branch, [field]: value } : branch
      )
    }));
  };

  const filteredClients = clients.filter(client =>
    client.full_name.includes(searchTerm) ||
    client.phone_number.includes(searchTerm) ||
    client.branches.some(branch => 
      branch.name.includes(searchTerm) || 
      branch.address.includes(searchTerm)
    )
  );

  return (
    <div>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">ניהול לקוחות</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center w-full lg:w-auto"
        >
          <Plus className="h-5 w-5 ml-2" />
          הוסף לקוח חדש
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון, או סניף..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          מציג {filteredClients.length} מתוך {clients.length} לקוחות
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-100"></div>
            {[1, 2, 3].map((n) => (
              <div key={n} className="border-t p-4">
                <div className="h-5 bg-gray-200 rounded w-1/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    שם לקוח
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    טלפון
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    סניפים עם עבודות קרובות
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{client.full_name}</div>
                      <div className="sm:hidden text-sm text-gray-600 mt-1 flex items-center" dir="ltr">
                        <Phone className="h-4 w-4 ml-2" />
                        {client.phone_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="flex items-center text-sm text-gray-600" dir="ltr">
                        <Phone className="h-4 w-4 ml-2" />
                        {client.phone_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="space-y-2">
                        {client.branches.length > 0 ? (
                          client.branches.map((branch) => (
                            <div
                              key={branch.id}
                              className="flex items-center space-x-2 space-x-reverse text-sm"
                            >
                              <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{branch.name}</p>
                                <p className="text-gray-500 text-xs">{branch.address}</p>
                              </div>
                              {branch.next_job_date && (
                                <div className="text-right shrink-0">
                                  <div className="flex items-center text-blue-600 text-xs">
                                    <Calendar className="h-3 w-3 ml-1" />
                                    {format(new Date(branch.next_job_date), 'EEEE, d בMMMM', { locale: he })}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {format(new Date(branch.next_job_date), 'HH:mm')}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">אין עבודות מתוכננות</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-left">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setEditForm({
                              full_name: client.full_name,
                              phone_number: client.phone_number,
                              password: ''
                            });
                            setShowEditModal(true);
                          }}
                          className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="ערוך לקוח"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setClientToDelete(client);
                            setShowDeleteModal(true);
                          }}
                          className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                          title="מחק לקוח"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link
                          to={`/admin/clients/${client.id}`}
                          className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="צפה בפרטי הלקוח"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">הוספת לקוח חדש</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddForm({
                    business_name: '',
                    phone_number: '',
                    password: '',
                    branches: [{ name: '', address: '' }]
                  });
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddClient} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    שם העסק
                  </label>
                  <input
                    type="text"
                    value={addForm.business_name}
                    onChange={(e) => setAddForm(prev => ({ ...prev, business_name: e.target.value }))}
                    className="input"
                    placeholder="הכנס שם העסק"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    מספר טלפון
                  </label>
                  <input
                    type="tel"
                    value={addForm.phone_number}
                    onChange={(e) => setAddForm(prev => ({ ...prev, phone_number: e.target.value }))}
                    className="input"
                    placeholder="הכנס מספר טלפון"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סיסמה
                </label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                  className="input"
                  placeholder="הכנס סיסמה (לפחות 6 תווים)"
                  dir="ltr"
                  required
                  minLength={6}
                />
                <p className="mt-1 text-sm text-gray-500">
                  הסיסמה חייבת להכיל לפחות 6 תווים
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    סניפים
                  </label>
                  <button
                    type="button"
                    onClick={addBranch}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    הוסף סניף
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-4 border rounded-lg p-4">
                  {addForm.branches.map((branch, index) => (
                    <div key={index} className="relative bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            שם הסניף
                          </label>
                          <input
                            type="text"
                            value={branch.name}
                            onChange={(e) => updateBranch(index, 'name', e.target.value)}
                            className="input"
                            placeholder="הכנס שם סניף"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            כתובת
                          </label>
                          <input
                            type="text"
                            value={branch.address}
                            onChange={(e) => updateBranch(index, 'address', e.target.value)}
                            className="input"
                            placeholder="הכנס כתובת"
                            required
                          />
                        </div>
                      </div>
                      {addForm.branches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBranch(index)}
                          className="absolute top-2 left-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
                    setShowAddModal(false);
                    setAddForm({
                      business_name: '',
                      phone_number: '',
                      password: '',
                      branches: [{ name: '', address: '' }]
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
                  {isSubmitting ? 'מוסיף...' : 'הוסף לקוח'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">עריכת לקוח</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם מלא
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="input"
                  placeholder="הכנס שם מלא"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מספר טלפון
                </label>
                <input
                  type="tel"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone_number: e.target.value }))}
                  className="input"
                  placeholder="הכנס מספר טלפון"
                  dir="ltr"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סיסמה חדשה (אופציונלי)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  className="input"
                  placeholder="השאר ריק כדי לא לשנות"
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
                  onClick={() => setShowEditModal(false)}
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

      {/* Delete Client Modal */}
      {showDeleteModal && clientToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">מחיקת לקוח</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setClientToDelete(null);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700">
                האם אתה בטוח שברצונך למחוק את הלקוח {clientToDelete.full_name}?
              </p>
              <p className="text-sm text-red-600 mt-2">
                פעולה זו תמחק את כל הסניפים והעבודות המשויכים ללקוח זה ולא ניתן יהיה לשחזר אותם.
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
                  setShowDeleteModal(false);
                  setClientToDelete(null);
                  setError(null);
                }}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'מוחק...' : 'מחק לקוח'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientsList;