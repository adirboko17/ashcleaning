import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Building2, Clock, Plus, X, MapPin, User } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
}

interface Client {
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

interface RouteStop {
  client_id: string;
  branch_id: string;
  employee_id: string;
  time: string;
  client: {
    id: string;
    full_name: string;
  };
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

interface Template {
  id?: string;
  name: string;
  stops: RouteStop[];
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [stopsSearchTerm, setStopsSearchTerm] = useState('');

  useEffect(() => {
    loadTemplates();
    loadEmployees();
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadClientBranches(selectedClientId);
    } else {
      setBranches([]);
    }
  }, [selectedClientId]);

  async function loadTemplates() {
    try {
      setIsLoading(true);
      setError(null);

      // Load saved templates
      const { data: savedTemplates, error } = await supabase
        .from('work_route_templates')
        .select('*')
        .order('name');

      if (error) throw error;

      // Initialize templates array with 21 empty templates
      const initialTemplates: Template[] = Array.from({ length: 21 }, (_, i) => ({
        name: `תבנית ${i + 1}`,
        stops: []
      }));

      // Merge saved templates with initial templates
      if (savedTemplates) {
        savedTemplates.forEach(template => {
          const index = parseInt(template.name.split(' ')[1]) - 1;
          if (index >= 0 && index < initialTemplates.length) {
            initialTemplates[index] = {
              id: template.id,
              name: template.name,
              stops: template.stops || []
            };
          }
        });
      }

      setTemplates(initialTemplates);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('אירעה שגיאה בטעינת התבניות');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'employee')
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  }

  async function loadClients() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'client')
        .order('full_name');

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }

  async function loadClientBranches(clientId: string) {
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
        .eq('client_id', clientId)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  }

  const handleAddStop = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (selectedTemplateIndex === null) {
      setError('יש לבחור תבנית');
      return;
    }

    if (!selectedEmployeeId) {
      setError('יש לבחור עובד');
      return;
    }

    if (!selectedClientId || !selectedBranchId) {
      setError('יש לבחור עסק וסניף');
      return;
    }

    const selectedBranchData = branches.find(b => b.id === selectedBranchId);
    const selectedClientData = clients.find(c => c.id === selectedClientId);
    const selectedEmployeeData = employees.find(e => e.id === selectedEmployeeId);
    
    if (!selectedBranchData || !selectedClientData || !selectedEmployeeData) {
      setError('לא נמצאו פרטי סניף, עסק או עובד');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const newStop: RouteStop = {
        client_id: selectedClientId,
        branch_id: selectedBranchId,
        employee_id: selectedEmployeeId,
        time: selectedTime,
        client: {
          id: selectedClientData.id,
          full_name: selectedClientData.full_name
        },
        branch: {
          id: selectedBranchData.id,
          name: selectedBranchData.name,
          address: selectedBranchData.address
        },
        employee: {
          id: selectedEmployeeData.id,
          full_name: selectedEmployeeData.full_name
        }
      };

      // Check for duplicates
      const isDuplicate = templates[selectedTemplateIndex].stops.some(
        stop => stop.branch_id === newStop.branch_id && 
               stop.time === newStop.time &&
               stop.employee_id === newStop.employee_id
      );

      if (isDuplicate) {
        setError('תחנה זו כבר קיימת בתבנית באותה שעה עם אותו עובד');
        return;
      }

      // Create new array of stops with the new stop
      const updatedStops = [...templates[selectedTemplateIndex].stops, newStop]
        .sort((a, b) => a.time.localeCompare(b.time));

      const templateToUpdate = {
        name: `תבנית ${selectedTemplateIndex + 1}`,
        stops: updatedStops
      };

      let result;
      if (templates[selectedTemplateIndex].id) {
        // Update existing template
        result = await supabase
          .from('work_route_templates')
          .update(templateToUpdate)
          .eq('id', templates[selectedTemplateIndex].id)
          .select()
          .single();
      } else {
        // Insert new template
        result = await supabase
          .from('work_route_templates')
          .insert(templateToUpdate)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Update local state
      const updatedTemplates = [...templates];
      updatedTemplates[selectedTemplateIndex] = {
        ...templateToUpdate,
        id: result.data.id,
        stops: updatedStops
      };
      setTemplates(updatedTemplates);

      // Clear form
      setBranchSearchTerm('');
      setClientSearchTerm('');
      setEmployeeSearchTerm('');
      setSelectedBranchId(null);
      setSelectedClientId(null);
      setSelectedEmployeeId(null);
      setSelectedTime('09:00');
    } catch (err) {
      console.error('Error adding stop:', err);
      setError('אירעה שגיאה בהוספת התחנה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStop = async (templateIndex: number, stopIndex: number) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const updatedStops = templates[templateIndex].stops.filter((_, i) => i !== stopIndex);
      const templateToUpdate = {
        name: `תבנית ${templateIndex + 1}`,
        stops: updatedStops
      };

      let result;
      if (templates[templateIndex].id) {
        // Update existing template
        result = await supabase
          .from('work_route_templates')
          .update(templateToUpdate)
          .eq('id', templates[templateIndex].id)
          .select()
          .single();

        if (result.error) throw result.error;

        // Update local state
        const updatedTemplates = [...templates];
        updatedTemplates[templateIndex] = {
          ...templateToUpdate,
          id: templates[templateIndex].id,
          stops: updatedStops
        };
        setTemplates(updatedTemplates);
      } else if (updatedStops.length > 0) {
        // Insert new template if it has stops
        result = await supabase
          .from('work_route_templates')
          .insert(templateToUpdate)
          .select()
          .single();

        if (result.error) throw result.error;

        // Update local state
        const updatedTemplates = [...templates];
        updatedTemplates[templateIndex] = {
          ...templateToUpdate,
          id: result.data.id,
          stops: updatedStops
        };
        setTemplates(updatedTemplates);
      } else {
        // Just update local state if template doesn't exist and has no stops
        const updatedTemplates = [...templates];
        updatedTemplates[templateIndex] = {
          name: `תבנית ${templateIndex + 1}`,
          stops: []
        };
        setTemplates(updatedTemplates);
      }
    } catch (err) {
      console.error('Error removing stop:', err);
      setError('אירעה שגיאה במחיקת התחנה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.full_name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(branchSearchTerm.toLowerCase())
  );

  // Filter templates based on search term
  const filteredTemplates = templates.map((template, index) => {
    if (!templateSearchTerm) return { template, index, visible: true };
    
    // Check if any stop in the template matches the search term
    const hasMatchingStop = template.stops.some(stop => 
      stop.employee.full_name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
      stop.client.full_name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
      stop.branch.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
      stop.branch.address.toLowerCase().includes(templateSearchTerm.toLowerCase())
    );
    
    return { 
      template, 
      index, 
      visible: hasMatchingStop || template.name.toLowerCase().includes(templateSearchTerm.toLowerCase())
    };
  });

  // Filter stops within the selected template
  const filteredStops = selectedTemplateIndex !== null && stopsSearchTerm
    ? templates[selectedTemplateIndex].stops.filter(stop => 
        stop.employee.full_name.toLowerCase().includes(stopsSearchTerm.toLowerCase()) ||
        stop.client.full_name.toLowerCase().includes(stopsSearchTerm.toLowerCase()) ||
        stop.branch.name.toLowerCase().includes(stopsSearchTerm.toLowerCase()) ||
        stop.branch.address.toLowerCase().includes(stopsSearchTerm.toLowerCase())
      )
    : selectedTemplateIndex !== null
      ? templates[selectedTemplateIndex].stops
      : [];

  const visibleTemplates = filteredTemplates.filter(item => item.visible);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ניהול תבניות</h1>

     

      {/* Template Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">בחירת תבנית</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 sm:gap-4">
          {filteredTemplates.map(({ template, index, visible }) => (
            <button
              key={`template-${index}`}
              onClick={() => {
                setSelectedTemplateIndex(index);
                setSelectedEmployeeId(null);
                setEmployeeSearchTerm('');
                setStopsSearchTerm(''); // Clear stops search when changing template
              }}
              className={`p-3 sm:p-4 border rounded-lg text-center transition-colors ${
                !visible ? 'hidden' : 
                selectedTemplateIndex === index
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-lg">{index + 1}</div>
              <div className="text-xs sm:text-sm mt-1 text-gray-600">
                {template.stops.length > 0 ? `${template.stops.length} תחנות` : 'ריק'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add Stop Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">הוספת תחנה לתבנית</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              בחר עובד
            </label>
            <div className="relative">
              <input
                type="text"
                value={employeeSearchTerm}
                onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                placeholder="חפש עובד..."
                className="input pr-10"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
              {filteredEmployees.map((employee) => (
                <button
                  key={`employee-${employee.id}`}
                  onClick={() => {
                    setSelectedEmployeeId(employee.id);
                    setEmployeeSearchTerm(employee.full_name);
                  }}
                  className={`w-full text-right p-3 hover:bg-gray-50 ${
                    selectedEmployeeId === employee.id ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  {employee.full_name}
                </button>
              ))}
            </div>
          </div>

          {/* Business Selection */}
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
                  setSelectedClientId(null);
                  setSelectedBranchId(null);
                }}
                className="input pr-10"
                placeholder="חפש לפי שם בית עסק..."
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
              {filteredClients.map((client) => (
                <button
                  key={`client-${client.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedClientId(client.id);
                    setClientSearchTerm(client.full_name);
                    setSelectedBranchId(null);
                    setBranchSearchTerm('');
                  }}
                  className={`w-full text-right p-3 hover:bg-gray-50 ${
                    selectedClientId === client.id ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <div className="font-medium">{client.full_name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              חיפוש סניף
            </label>
            <div className="relative">
              <input
                type="text"
                value={branchSearchTerm}
                onChange={(e) => setBranchSearchTerm(e.target.value)}
                className="input pr-10"
                placeholder="חפש לפי שם או כתובת סניף..."
                disabled={!selectedClientId}
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
              {selectedClientId ? (
                filteredBranches.map((branch) => (
                  <button
                    key={`branch-${branch.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedBranchId(branch.id);
                      setBranchSearchTerm(`${branch.name} - ${branch.address}`);
                    }}
                    className={`w-full text-right p-3 hover:bg-gray-50 ${
                      selectedBranchId === branch.id ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    <div className="font-medium">{branch.name}</div>
                    <div className="text-sm text-gray-600">{branch.address}</div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500">
                  יש לבחור בית עסק תחילה
                </div>
              )}
            </div>
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שעה
            </label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="input"
              dir="ltr"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleAddStop}
            disabled={selectedTemplateIndex === null || !selectedClientId || !selectedBranchId || !selectedEmployeeId || isSubmitting}
            className="btn btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-5 w-5 ml-2" />
            הוסף תחנה לתבנית
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}
      </div>

      {/* Selected Template Stops */}
      {selectedTemplateIndex !== null && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-semibold">
                תחנות בתבנית {selectedTemplateIndex + 1}
              </h2>
              
              {/* Search within selected template */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={stopsSearchTerm}
                  onChange={(e) => setStopsSearchTerm(e.target.value)}
                  placeholder="חפש בתוך התבנית..."
                  className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
            
            {stopsSearchTerm && (
              <p className="mt-2 text-sm text-gray-500">
                מציג {filteredStops.length} מתוך {templates[selectedTemplateIndex].stops.length} תחנות
              </p>
            )}
          </div>

          <div className="p-4">
            {templates[selectedTemplateIndex].stops.length > 0 ? (
              filteredStops.length > 0 ? (
                <div className="space-y-4">
                  {filteredStops.map((stop, stopIndex) => {
                    // Find the original index in the unfiltered array
                    const originalIndex = templates[selectedTemplateIndex].stops.findIndex(
                      s => s.branch_id === stop.branch_id && 
                           s.employee_id === stop.employee_id && 
                           s.time === stop.time
                    );
                    
                    return (
                      <div
                        key={`stop-${originalIndex}`}
                        className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
                      >
                        <div>
                          <div className="flex items-center mb-1">
                            <Building2 className="h-4 w-4 text-blue-600 ml-2" />
                            <span className="font-medium text-blue-600">
                              {stop.client.full_name}
                            </span>
                          </div>
                          <div className="flex items-start text-gray-600">
                            <MapPin className="h-4 w-4 ml-2 mt-1 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{stop.branch.name}</p>
                              <p className="text-sm">{stop.branch.address}</p>
                            </div>
                          </div>
                          <div className="flex items-center text-gray-600 mt-1">
                            <User className="h-4 w-4 ml-2" />
                            <span className="text-sm">{stop.employee.full_name}</span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            <Clock className="h-4 w-4 inline ml-1" />
                            {stop.time}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveStop(selectedTemplateIndex, originalIndex)}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  לא נמצאו תחנות התואמות את החיפוש
                </div>
              )
            ) : (
              <div className="text-center py-8 text-gray-500">
                אין תחנות בתבנית זו
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}