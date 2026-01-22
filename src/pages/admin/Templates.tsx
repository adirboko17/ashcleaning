import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Building2, Clock, Plus, X, MapPin, User, Pencil, ArrowRightLeft } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  is_active?: boolean;
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
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [stopsSearchTerm, setStopsSearchTerm] = useState('');
  const [pendingStops, setPendingStops] = useState<RouteStop[]>([]);

  // Selected-template actions
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedStopKeys, setSelectedStopKeys] = useState<string[]>([]);
  const [moveTargetTemplateIndex, setMoveTargetTemplateIndex] = useState<number | null>(null);

  // Bulk edit employee
  const [isBulkEditEmployeeOpen, setIsBulkEditEmployeeOpen] = useState(false);
  const [bulkEditEmployeeSearchTerm, setBulkEditEmployeeSearchTerm] = useState('');
  const [bulkEditEmployeeId, setBulkEditEmployeeId] = useState<string | null>(null);
  const [bulkEditError, setBulkEditError] = useState<string | null>(null);

  // Edit stop modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStopKey, setEditingStopKey] = useState<string | null>(null);
  const [editEmployeeSearchTerm, setEditEmployeeSearchTerm] = useState('');
  const [editClientSearchTerm, setEditClientSearchTerm] = useState('');
  const [editBranchSearchTerm, setEditBranchSearchTerm] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editBranchId, setEditBranchId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('09:00');
  const [editBranches, setEditBranches] = useState<Branch[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

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

  const selectedEmployeeData = selectedEmployeeId
    ? employees.find(e => e.id === selectedEmployeeId) || null
    : null;

  const selectedClientData = selectedClientId
    ? clients.find(c => c.id === selectedClientId) || null
    : null;

  const keyOf = (s: RouteStop) => `${s.branch_id}__${s.time}__${s.employee_id}`;

  const selectedStopKeySet = new Set(selectedStopKeys);

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
        .select('id, full_name, is_active')
        .eq('role', 'employee')
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  }

  const activeEmployees = employees.filter((e) => (e.is_active ?? true) === true);

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

  async function fetchClientBranches(clientId: string): Promise<Branch[]> {
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
    return (data || []) as Branch[];
  }

  async function loadClientBranches(clientId: string) {
    try {
      const data = await fetchClientBranches(clientId);
      setBranches(data);
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  }

  async function upsertTemplateStops(templateIndex: number, stops: RouteStop[], templateIdOverride?: string) {
    const existingId = templateIdOverride ?? templates[templateIndex]?.id;

    // Don't create empty templates in DB
    if (!existingId && stops.length === 0) {
      setTemplates(prev => {
        const next = [...prev];
        next[templateIndex] = { name: `תבנית ${templateIndex + 1}`, stops: [] };
        return next;
      });
      return;
    }

    const templateToUpdate = {
      name: `תבנית ${templateIndex + 1}`,
      stops
    };

    let result;
    if (existingId) {
      result = await supabase
        .from('work_route_templates')
        .update(templateToUpdate)
        .eq('id', existingId)
        .select()
        .single();
    } else {
      result = await supabase
        .from('work_route_templates')
        .insert(templateToUpdate)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    setTemplates(prev => {
      const next = [...prev];
      next[templateIndex] = {
        ...templateToUpdate,
        id: result.data.id,
        stops
      };
      return next;
    });
  }

  const toggleSelectedBranchId = (branchId: string) => {
    setSelectedBranchIds(prev => {
      if (prev.includes(branchId)) return prev.filter(id => id !== branchId);
      return [...prev, branchId];
    });
  };

  const addCurrentSelectionToPending = (opts?: { silent?: boolean; clearSelection?: boolean }) => {
    const silent = Boolean(opts?.silent);
    const clearSelection = opts?.clearSelection ?? true;

    if (selectedTemplateIndex === null || !selectedEmployeeId || !selectedClientId || selectedBranchIds.length === 0) {
      return 0;
    }

    const client = clients.find(c => c.id === selectedClientId);
    const employee = employees.find(emp => emp.id === selectedEmployeeId);

    if (!client || !employee) {
      if (!silent) setError('לא נמצאו פרטי עסק או עובד');
      return 0;
    }

    const branchDataById = new Map(branches.map(b => [b.id, b]));
    const missingBranch = selectedBranchIds.find(id => !branchDataById.get(id));
    if (missingBranch) {
      if (!silent) setError('לא נמצאו פרטי אחד הסניפים שנבחרו');
      return 0;
    }

    const newStops: RouteStop[] = selectedBranchIds.map(branchId => {
      const branch = branchDataById.get(branchId)!;
      return {
        client_id: selectedClientId,
        branch_id: branchId,
        employee_id: selectedEmployeeId,
        time: selectedTime,
        client: {
          id: client.id,
          full_name: client.full_name
        },
        branch: {
          id: branch.id,
          name: branch.name,
          address: branch.address
        },
        employee: {
          id: employee.id,
          full_name: employee.full_name
        }
      };
    });

    // Deduplicate against pending + existing template stops (same branch+time+employee)
    const existingStops = templates[selectedTemplateIndex].stops;
    const existingKeys = new Set(existingStops.map(keyOf));
    const pendingKeys = new Set(pendingStops.map(keyOf));
    const uniqueNewStops = newStops.filter(s => !existingKeys.has(keyOf(s)) && !pendingKeys.has(keyOf(s)));

    if (uniqueNewStops.length === 0) {
      if (!silent) {
        setError('כל הסניפים שסומנו כבר קיימים בתבנית (או כבר נמצאים ברשימת ההוספה) באותה שעה עם אותו עובד');
      }
      return 0;
    }

    if (!silent) setError(null);

    setPendingStops(prev => [...prev, ...uniqueNewStops].sort((a, b) => a.time.localeCompare(b.time)));

    // Increment time by 5 minutes for the next addition
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setMinutes(date.getMinutes() + 5);
    const nextTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    setSelectedTime(nextTime);

    if (clearSelection) {
      setSelectedBranchIds([]);
      setBranchSearchTerm('');
    }

    return uniqueNewStops.length;
  };

  const handleAddPendingStops = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (selectedTemplateIndex === null) {
      setError('יש לבחור תבנית');
      return;
    }

    if (!selectedEmployeeId) {
      setError('יש לבחור עובד');
      return;
    }

    if (!selectedClientId) {
      setError('יש לבחור בית עסק');
      return;
    }

    if (selectedBranchIds.length === 0) {
      setError('יש לבחור לפחות סניף אחד');
      return;
    }

    const added = addCurrentSelectionToPending({ silent: false, clearSelection: true });
    if (added > 0) {
      // Clear business selection but keep employee for convenience
      setClientSearchTerm('');
      setSelectedClientId(null);
    }
  };

  const handleRemovePendingStop = (pendingIndex: number) => {
    setPendingStops(prev => prev.filter((_, i) => i !== pendingIndex));
  };

  const handleSavePendingStopsToTemplate = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (selectedTemplateIndex === null) {
      setError('יש לבחור תבנית');
      return;
    }

    if (pendingStops.length === 0) {
      setError('אין תחנות להוספה');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const existingStops = templates[selectedTemplateIndex].stops;
      const existingKeys = new Set(existingStops.map(keyOf));
      const uniqueToAdd = pendingStops.filter(s => !existingKeys.has(keyOf(s)));

      if (uniqueToAdd.length === 0) {
        setError('כל התחנות ברשימת ההוספה כבר קיימות בתבנית');
        return;
      }

      const updatedStops = [...existingStops, ...uniqueToAdd].sort((a, b) => a.time.localeCompare(b.time));
      await upsertTemplateStops(selectedTemplateIndex, updatedStops);

      setPendingStops([]);
    } catch (err) {
      console.error('Error saving pending stops:', err);
      setError('אירעה שגיאה בשמירת התחנות לתבנית');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStop = async (templateIndex: number, stop: RouteStop) => {
    const originalStopsSnapshot = templates[templateIndex]?.stops ?? [];
    const existingIdSnapshot = templates[templateIndex]?.id;

    try {
      setIsSubmitting(true);
      setError(null);

      const stopKey = keyOf(stop);
      const stopIndex = originalStopsSnapshot.findIndex(s => keyOf(s) === stopKey);

      if (stopIndex === -1) {
        setError('לא נמצאה התחנה למחיקה');
        return;
      }

      const updatedStops = originalStopsSnapshot.filter((_, i) => i !== stopIndex);

      // Optimistic UI update
      setTemplates(prev => {
        const next = [...prev];
        next[templateIndex] = {
          ...next[templateIndex],
          name: `תבנית ${templateIndex + 1}`,
          stops: updatedStops
        };
        return next;
      });

      // Persist
      if (existingIdSnapshot || updatedStops.length > 0) {
        await upsertTemplateStops(templateIndex, updatedStops, existingIdSnapshot);
      }
    } catch (err) {
      console.error('Error removing stop:', err);
      setError('אירעה שגיאה במחיקת התחנה');

      // Revert optimistic update on failure
      setTemplates(prev => {
        const next = [...prev];
        next[templateIndex] = {
          ...next[templateIndex],
          name: `תבנית ${templateIndex + 1}`,
          stops: originalStopsSnapshot
        };
        return next;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStopSelected = (stop: RouteStop) => {
    const k = keyOf(stop);
    setSelectedStopKeys(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]));
  };

  const clearSelection = () => {
    setSelectedStopKeys([]);
    setMoveTargetTemplateIndex(null);
  };

  const openEditStop = async (stop: RouteStop) => {
    setEditError(null);
    setEditingStopKey(keyOf(stop));
    setIsEditOpen(true);

    setEditEmployeeId(stop.employee_id);
    setEditClientId(stop.client_id);
    setEditBranchId(stop.branch_id);
    setEditTime(stop.time);

    setEditEmployeeSearchTerm(stop.employee.full_name);
    setEditClientSearchTerm(stop.client.full_name);
    setEditBranchSearchTerm(`${stop.branch.name} - ${stop.branch.address}`);

    try {
      const data = await fetchClientBranches(stop.client_id);
      setEditBranches(data);
    } catch (err) {
      console.error('Error loading edit branches:', err);
      setEditBranches([]);
    }
  };

  const closeEditStop = () => {
    setIsEditOpen(false);
    setEditingStopKey(null);
    setEditError(null);
    setEditEmployeeSearchTerm('');
    setEditClientSearchTerm('');
    setEditBranchSearchTerm('');
    setEditEmployeeId(null);
    setEditClientId(null);
    setEditBranchId(null);
    setEditTime('09:00');
    setEditBranches([]);
  };

  const handleSaveEditedStop = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (selectedTemplateIndex === null) return;
    if (!editingStopKey) return;

    if (!editEmployeeId) {
      setEditError('יש לבחור עובד');
      return;
    }

    if (!editClientId || !editBranchId) {
      setEditError('יש לבחור בית עסק וסניף');
      return;
    }

    const employee = employees.find(emp => emp.id === editEmployeeId);
    const client = clients.find(c => c.id === editClientId);
    const branch = editBranches.find(b => b.id === editBranchId);

    if (!employee || !client || !branch) {
      setEditError('לא נמצאו פרטי עובד/לקוח/סניף');
      return;
    }

    const updatedStop: RouteStop = {
      employee_id: employee.id,
      client_id: client.id,
      branch_id: branch.id,
      time: editTime,
      employee: { id: employee.id, full_name: employee.full_name },
      client: { id: client.id, full_name: client.full_name },
      branch: { id: branch.id, name: branch.name, address: branch.address }
    };

    const updatedKey = keyOf(updatedStop);

    const currentStops = templates[selectedTemplateIndex].stops;
    const duplicate = currentStops.some(s => keyOf(s) === updatedKey && keyOf(s) !== editingStopKey);
    if (duplicate) {
      setEditError('תחנה זו כבר קיימת בתבנית באותה שעה עם אותו עובד');
      return;
    }

    const idx = currentStops.findIndex(s => keyOf(s) === editingStopKey);
    if (idx === -1) {
      setEditError('לא נמצאה התחנה לעריכה');
      return;
    }

    try {
      setIsSubmitting(true);
      setEditError(null);

      const nextStops = [...currentStops];
      nextStops[idx] = updatedStop;
      nextStops.sort((a, b) => a.time.localeCompare(b.time));

      await upsertTemplateStops(selectedTemplateIndex, nextStops);

      closeEditStop();
    } catch (err) {
      console.error('Error saving edited stop:', err);
      setEditError('אירעה שגיאה בשמירת השינויים');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveSelectedStops = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (selectedTemplateIndex === null) {
      setError('יש לבחור תבנית מקור');
      return;
    }

    if (selectedStopKeys.length === 0) {
      setError('לא נבחרו תחנות להעברה');
      return;
    }

    if (moveTargetTemplateIndex === null) {
      setError('יש לבחור תבנית יעד');
      return;
    }

    if (moveTargetTemplateIndex === selectedTemplateIndex) {
      setError('תבנית היעד חייבת להיות שונה מתבנית המקור');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const selectedKeysSet = new Set(selectedStopKeys);

      const sourceStops = templates[selectedTemplateIndex].stops ?? [];
      const toMove = sourceStops.filter(stop => selectedKeysSet.has(keyOf(stop)));

      if (toMove.length === 0) {
        setError('לא נמצאו תחנות תואמות להעברה (יתכן שהרשימה עודכנה)');
        return;
      }

      const remainingSourceStops = sourceStops
        .filter(stop => !selectedKeysSet.has(keyOf(stop)))
        .sort((a, b) => a.time.localeCompare(b.time));

      const targetStops = templates[moveTargetTemplateIndex].stops ?? [];
      const targetKeys = new Set(targetStops.map(keyOf));
      const duplicates = toMove.filter(stop => targetKeys.has(keyOf(stop)));

      if (duplicates.length > 0) {
        setError(`לא ניתן להעביר: ${duplicates.length} תחנות כבר קיימות בתבנית היעד באותה שעה עם אותו עובד`);
        return;
      }

      const nextTargetStops = [...targetStops, ...toMove].sort((a, b) => a.time.localeCompare(b.time));

      // Update target first (creates it if missing), then update source.
      await upsertTemplateStops(moveTargetTemplateIndex, nextTargetStops);

      if (templates[selectedTemplateIndex].id || remainingSourceStops.length > 0) {
        await upsertTemplateStops(selectedTemplateIndex, remainingSourceStops);
      } else {
        // No DB row and now empty — keep local template clean.
        setTemplates(prev => {
          const next = [...prev];
          next[selectedTemplateIndex] = { name: `תבנית ${selectedTemplateIndex + 1}`, stops: [] };
          return next;
        });
      }

      clearSelection();
      setIsSelectMode(false);
      setMoveTargetTemplateIndex(null);
    } catch (err) {
      console.error('Error moving stops:', err);
      setError('אירעה שגיאה בהעברת התחנות');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpdateEmployee = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (selectedTemplateIndex === null) return;
    if (selectedStopKeys.length === 0) return;
    if (!bulkEditEmployeeId) {
      setBulkEditError('יש לבחור עובד');
      return;
    }

    const employee = employees.find(emp => emp.id === bulkEditEmployeeId);
    if (!employee) {
      setBulkEditError('לא נמצאו פרטי עובד');
      return;
    }

    try {
      setIsSubmitting(true);
      setBulkEditError(null);

      const currentStops = [...templates[selectedTemplateIndex].stops];
      const selectedKeysSet = new Set(selectedStopKeys);

      // We need to be careful about duplicates if the same branch exists with the same time but different employee
      // However, usually within a template, branch+time should be unique enough, but the current keyOf uses employee_id too.
      // Let's update the stops and check for duplicates.
      
      const nextStops = currentStops.map(stop => {
        if (selectedKeysSet.has(keyOf(stop))) {
          return {
            ...stop,
            employee_id: employee.id,
            employee: { id: employee.id, full_name: employee.full_name }
          };
        }
        return stop;
      });

      // Check for duplicates after update
      const keys = nextStops.map(keyOf);
      const uniqueKeys = new Set(keys);
      if (uniqueKeys.size < nextStops.length) {
        setBulkEditError('העדכון יוצר כפילויות (אותה תחנה באותה שעה עם אותו עובד)');
        return;
      }

      await upsertTemplateStops(selectedTemplateIndex, nextStops);

      setIsBulkEditEmployeeOpen(false);
      setBulkEditEmployeeId(null);
      setBulkEditEmployeeSearchTerm('');
      clearSelection();
      setIsSelectMode(false);
    } catch (err) {
      console.error('Error bulk updating employee:', err);
      setBulkEditError('אירעה שגיאה בעדכון העובד');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = activeEmployees.filter(emp =>
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">ניהול תבניות</h1>
        <p className="mt-2 text-sm text-gray-600">צור והגדר תבניות עבודה לעובדים</p>
      </div>

      {/* Template Selection */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">בחירת תבנית</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {filteredTemplates.map(({ template, index, visible }) => (
              <button
                key={`template-${index}`}
                onClick={() => {
                  setSelectedTemplateIndex(index);
                  setSelectedEmployeeId(null);
                  setEmployeeSearchTerm('');
                  setSelectedClientId(null);
                  setClientSearchTerm('');
                  setSelectedBranchIds([]);
                  setBranchSearchTerm('');
                  setPendingStops([]);
                  setStopsSearchTerm('');
                }}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  !visible ? 'hidden' : 
                  selectedTemplateIndex === index
                    ? 'bg-slate-50 border-slate-900 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`font-semibold text-lg ${
                  selectedTemplateIndex === index ? 'text-slate-900' : 'text-gray-700'
                }`}>
                  {index + 1}
                </div>
                <div className="text-xs mt-1.5 text-gray-500">
                  {template.stops.length > 0 ? `${template.stops.length} תחנות` : 'ריק'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Stop Form */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">הוספת תחנות לתבנית</h2>
          <p className="mt-1 text-sm text-gray-500">בחר עובד וסמן כמה סניפים להוסיף ביחד</p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Employee Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">
                  בחר עובד
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    placeholder="חפש עובד..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                  />
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => (
                    <button
                      key={`employee-${employee.id}`}
                      onClick={() => {
                        if (selectedEmployeeId && selectedEmployeeId !== employee.id) {
                          setPendingStops([]);
                          setSelectedClientId(null);
                          setClientSearchTerm('');
                          setSelectedBranchIds([]);
                          setBranchSearchTerm('');
                        }
                        setSelectedEmployeeId(employee.id);
                        setEmployeeSearchTerm(employee.full_name);
                      }}
                      className={`w-full text-right px-4 py-3 transition-colors ${
                        selectedEmployeeId === employee.id 
                          ? 'bg-slate-50 text-slate-900 font-medium' 
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {employee.full_name}
                    </button>
                  ))}
                </div>
                {selectedEmployeeData && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <User className="h-4 w-4 text-slate-600" />
                    <span className="text-gray-600">עובד נבחר:</span>
                    <span className="font-medium text-slate-900">{selectedEmployeeData.full_name}</span>
                  </div>
                )}
              </div>

              {/* Business Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">
                  בחירת בית עסק
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearchTerm}
                    onChange={(e) => {
                      if (selectedBranchIds.length > 0) {
                        addCurrentSelectionToPending({ silent: true, clearSelection: true });
                      }
                      setClientSearchTerm(e.target.value);
                      setSelectedClientId(null);
                      setSelectedBranchIds([]);
                    }}
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="חפש לפי שם בית עסק..."
                    disabled={!selectedEmployeeId}
                  />
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {selectedEmployeeId ? (
                    filteredClients.map((client) => (
                      <button
                        key={`client-${client.id}`}
                        type="button"
                        onClick={() => {
                          if (selectedBranchIds.length > 0) {
                            addCurrentSelectionToPending({ silent: true, clearSelection: true });
                          }
                          setSelectedClientId(client.id);
                          setClientSearchTerm(client.full_name);
                          setSelectedBranchIds([]);
                          setBranchSearchTerm('');
                        }}
                        className={`w-full text-right px-4 py-3 transition-colors ${
                          selectedClientId === client.id 
                            ? 'bg-slate-50 text-slate-900 font-medium' 
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{client.full_name}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-gray-500">
                      יש לבחור עובד תחילה
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                  כשעוברים לבית עסק אחר, הסניפים שסומנו יתווספו אוטומטית לרשימה
                </div>
              </div>

              {/* Branch Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">
                  סימון סניפים
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={branchSearchTerm}
                    onChange={(e) => setBranchSearchTerm(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="חפש לפי שם או כתובת סניף..."
                    disabled={!selectedClientId}
                  />
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                </div>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {selectedClientId ? (
                    <div>
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 sticky top-0">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className="text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
                            onClick={() => setSelectedBranchIds(filteredBranches.map(b => b.id))}
                          >
                            סמן הכל
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
                            onClick={() => setSelectedBranchIds([])}
                          >
                            נקה
                          </button>
                        </div>
                        <span className="text-xs text-gray-600">
                          <span className="font-semibold text-slate-900">{selectedBranchIds.length}</span> מסומנים
                        </span>
                      </div>
                      {filteredBranches.map((branch) => (
                        <label
                          key={`branch-${branch.id}`}
                          className="flex items-start gap-3 w-full text-right px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-500"
                            checked={selectedBranchIds.includes(branch.id)}
                            onChange={() => toggleSelectedBranchId(branch.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{branch.name}</div>
                            <div className="text-sm text-gray-500 flex items-start gap-1.5 mt-0.5">
                              <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                              <span className="break-words">{branch.address}</span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-sm text-gray-500">
                      יש לבחור בית עסק תחילה
                    </div>
                  )}
                </div>
              </div>

              {/* Time Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">
                  שעת הגעה
                  <span className="text-xs font-normal text-gray-500 mr-2">(תחול על כל הסניפים)</span>
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Pending Stops Panel */}
            <div className="lg:col-span-1">
              <div className="border-2 border-slate-200 rounded-xl overflow-hidden lg:sticky lg:top-24 bg-white">
                <div className="px-4 py-3 bg-slate-50 border-b-2 border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">רשימת הוספה</h3>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white rounded-full text-xs font-semibold">
                      <span>{pendingStops.length}</span>
                      <span>תחנות</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-b border-gray-200 bg-white space-y-2">
                  <button
                    onClick={handleSavePendingStopsToTemplate}
                    disabled={selectedTemplateIndex === null || pendingStops.length === 0 || isSubmitting}
                    className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    שמור הכל לתבנית
                  </button>
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setPendingStops([])}
                    disabled={isSubmitting || pendingStops.length === 0}
                  >
                    נקה הכל
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {pendingStops.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {pendingStops.map((stop, i) => (
                        <div key={`pending-stop-${i}`} className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{stop.branch.name}</div>
                            <div className="text-xs text-gray-500 truncate mt-0.5">{stop.branch.address}</div>
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-600 mt-2">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {stop.client.full_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {stop.employee.full_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {stop.time}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemovePendingStop(i)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                            disabled={isSubmitting}
                            title="הסר מהרשימה"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="text-gray-400 mb-2">
                        <Plus className="h-8 w-8 mx-auto" />
                      </div>
                      <p className="text-sm text-gray-500">אין תחנות ברשימה</p>
                      <p className="text-xs text-gray-400 mt-1">סמן סניפים והוסף אותם כאן</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {selectedClientData && selectedBranchIds.length > 0 ? (
                  <>
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>
                      מסומנים כעת: <span className="font-semibold text-gray-900">{selectedBranchIds.length}</span> סניפים ב־
                      <span className="font-medium">{selectedClientData.full_name}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
                    <span>סמן סניפים והוסף לרשימה, או עבור ללקוח אחר</span>
                  </>
                )}
              </div>

              <button
                onClick={handleAddPendingStops}
                disabled={selectedTemplateIndex === null || !selectedClientId || selectedBranchIds.length === 0 || !selectedEmployeeId || isSubmitting}
                className="px-5 py-2.5 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-5 w-5" />
                הוסף לרשימת ההוספה
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <X className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Template Stops */}
      {selectedTemplateIndex !== null && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  תחנות בתבנית {selectedTemplateIndex + 1}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {templates[selectedTemplateIndex].stops.length} תחנות סה״כ
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={stopsSearchTerm}
                    onChange={(e) => setStopsSearchTerm(e.target.value)}
                    placeholder="חפש בתוך התבנית..."
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSelectMode(v => {
                      const next = !v;
                      if (!next) clearSelection();
                      return next;
                    });
                  }}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isSelectMode
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {isSelectMode ? 'סיום בחירה' : 'בחר תחנות'}
                </button>
              </div>
            </div>
            
            {stopsSearchTerm && (
              <div className="mt-3 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 inline-block">
                מציג {filteredStops.length} מתוך {templates[selectedTemplateIndex].stops.length} תחנות
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <X className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {isSelectMode && (
              <div className="mt-4 flex flex-col lg:flex-row lg:items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-700">
                  נבחרו: <span className="font-semibold text-slate-900">{selectedStopKeys.length}</span>
                </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end flex-1">
                    <button
                      type="button"
                      onClick={() => setIsBulkEditEmployeeOpen(true)}
                      disabled={selectedStopKeys.length === 0 || isSubmitting}
                      className="px-3 py-2 text-sm bg-white text-slate-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      ערוך עובד
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                      const keys = filteredStops.map(s => keyOf(s));
                      setSelectedStopKeys(prev => {
                        const set = new Set(prev);
                        keys.forEach(k => set.add(k));
                        return Array.from(set);
                      });
                    }}
                    className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    בחר הכל (מוצג)
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    נקה בחירה
                  </button>

                  <div className="flex gap-2 sm:items-center">
                    <select
                      value={moveTargetTemplateIndex ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMoveTargetTemplateIndex(v === '' ? null : Number(v));
                      }}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">בחר תבנית יעד…</option>
                      {templates.map((t, idx) => (
                        <option key={`move-target-${idx}`} value={idx} disabled={idx === selectedTemplateIndex}>
                          תבנית {idx + 1}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleMoveSelectedStops}
                      disabled={selectedStopKeys.length === 0 || moveTargetTemplateIndex === null || isSubmitting}
                      className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      העבר
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            {templates[selectedTemplateIndex].stops.length > 0 ? (
              filteredStops.length > 0 ? (
                <div className="grid gap-3">
                  {filteredStops.map((stop, stopIndex) => {
                    const stopK = keyOf(stop);
                    const originalIndex = templates[selectedTemplateIndex].stops.findIndex(s => keyOf(s) === stopK);
                    
                    return (
                      <div
                        key={`stop-${originalIndex}`}
                        className="group flex items-start justify-between gap-4 bg-gray-50 hover:bg-gray-100 p-4 rounded-lg border border-gray-200 transition-colors"
                      >
                        {isSelectMode && (
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={selectedStopKeySet.has(stopK)}
                              onChange={() => toggleStopSelected(stop)}
                              className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-500"
                            />
                          </div>
                        )}
                        <div className="flex-1 grid gap-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-600 shrink-0" />
                            <span className="font-semibold text-slate-900">
                              {stop.client.full_name}
                            </span>
                          </div>
                          
                          <div className="flex items-start gap-2 text-gray-700">
                            <MapPin className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{stop.branch.name}</p>
                              <p className="text-sm text-gray-600">{stop.branch.address}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1.5">
                              <User className="h-4 w-4 text-gray-500" />
                              {stop.employee.full_name}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-gray-500" />
                              {stop.time}
                            </span>
                          </div>
                        </div>
                        
                        {!isSelectMode && (
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openEditStop(stop)}
                              className="p-2 text-gray-400 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                              title="ערוך תחנה"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStop(selectedTemplateIndex, stop)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="הסר תחנה"
                              disabled={isSubmitting}
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">לא נמצאו תחנות התואמות את החיפוש</p>
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">אין תחנות בתבנית זו</p>
                <p className="text-sm text-gray-400 mt-1">הוסף תחנות חדשות באמצעות הטופס למעלה</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Edit Employee Modal */}
      {isBulkEditEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setIsBulkEditEmployeeOpen(false);
              setBulkEditEmployeeId(null);
              setBulkEditEmployeeSearchTerm('');
              setBulkEditError(null);
            }}
            aria-label="סגור"
          />

          <div className="relative w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">שינוי עובד למספר תחנות</h3>
                <p className="text-sm text-gray-500 mt-0.5">נבחרו {selectedStopKeys.length} תחנות</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkEditEmployeeOpen(false);
                  setBulkEditEmployeeId(null);
                  setBulkEditEmployeeSearchTerm('');
                  setBulkEditError(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                title="סגור"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">בחר עובד חדש</label>
                <div className="relative">
                  <input
                    type="text"
                    value={bulkEditEmployeeSearchTerm}
                    onChange={(e) => {
                      setBulkEditEmployeeSearchTerm(e.target.value);
                      setBulkEditEmployeeId(null);
                    }}
                    placeholder="חפש עובד..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                  />
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {activeEmployees
                    .filter(emp => emp.full_name.toLowerCase().includes(bulkEditEmployeeSearchTerm.toLowerCase()))
                    .map(emp => (
                      <button
                        key={`bulk-edit-emp-${emp.id}`}
                        type="button"
                        onClick={() => {
                          setBulkEditEmployeeId(emp.id);
                          setBulkEditEmployeeSearchTerm(emp.full_name);
                        }}
                        className={`w-full text-right px-4 py-3 transition-colors ${
                          bulkEditEmployeeId === emp.id
                            ? 'bg-slate-50 text-slate-900 font-medium'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {emp.full_name}
                      </button>
                    ))}
                </div>
              </div>

              {bulkEditError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {bulkEditError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-white flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsBulkEditEmployeeOpen(false);
                  setBulkEditEmployeeId(null);
                  setBulkEditEmployeeSearchTerm('');
                  setBulkEditError(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleBulkUpdateEmployee}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                disabled={isSubmitting || !bulkEditEmployeeId}
              >
                עדכן עובד לכל התחנות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stop Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={closeEditStop}
            aria-label="סגור"
          />

          <div className="relative w-full max-w-3xl bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">עריכת תחנה</h3>
                <p className="text-sm text-gray-500 mt-0.5">שנה עובד, לקוח, סניף ושעה</p>
              </div>
              <button
                type="button"
                onClick={closeEditStop}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                title="סגור"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Edit Employee */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">עובד</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editEmployeeSearchTerm}
                    onChange={(e) => {
                      setEditEmployeeSearchTerm(e.target.value);
                      setEditEmployeeId(null);
                    }}
                    placeholder="חפש עובד..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                  />
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {activeEmployees
                    .filter(emp => emp.full_name.toLowerCase().includes(editEmployeeSearchTerm.toLowerCase()))
                    .map(emp => (
                      <button
                        key={`edit-emp-${emp.id}`}
                        type="button"
                        onClick={() => {
                          setEditEmployeeId(emp.id);
                          setEditEmployeeSearchTerm(emp.full_name);
                        }}
                        className={`w-full text-right px-4 py-3 transition-colors ${
                          editEmployeeId === emp.id
                            ? 'bg-slate-50 text-slate-900 font-medium'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {emp.full_name}
                      </button>
                    ))}
                </div>
              </div>

              {/* Edit Client */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">בית עסק</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editClientSearchTerm}
                    onChange={(e) => {
                      setEditClientSearchTerm(e.target.value);
                      setEditClientId(null);
                      setEditBranchId(null);
                      setEditBranches([]);
                    }}
                    placeholder="חפש בית עסק..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                  />
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {clients
                    .filter(c => c.full_name.toLowerCase().includes(editClientSearchTerm.toLowerCase()))
                    .map(c => (
                      <button
                        key={`edit-client-${c.id}`}
                        type="button"
                        onClick={async () => {
                          setEditClientId(c.id);
                          setEditClientSearchTerm(c.full_name);
                          setEditBranchId(null);
                          setEditBranchSearchTerm('');
                          try {
                            const data = await fetchClientBranches(c.id);
                            setEditBranches(data);
                          } catch (err) {
                            console.error('Error loading edit branches:', err);
                            setEditBranches([]);
                          }
                        }}
                        className={`w-full text-right px-4 py-3 transition-colors ${
                          editClientId === c.id
                            ? 'bg-slate-50 text-slate-900 font-medium'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{c.full_name}</span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Edit Branch */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">סניף</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editBranchSearchTerm}
                    onChange={(e) => {
                      setEditBranchSearchTerm(e.target.value);
                      setEditBranchId(null);
                    }}
                    placeholder={editClientId ? 'חפש סניף...' : 'בחר בית עסק תחילה'}
                    disabled={!editClientId}
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow disabled:bg-gray-50 disabled:text-gray-500"
                  />
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {editClientId ? (
                    editBranches
                      .filter(b =>
                        b.name.toLowerCase().includes(editBranchSearchTerm.toLowerCase()) ||
                        b.address.toLowerCase().includes(editBranchSearchTerm.toLowerCase())
                      )
                      .map(b => (
                        <button
                          key={`edit-branch-${b.id}`}
                          type="button"
                          onClick={() => {
                            setEditBranchId(b.id);
                            setEditBranchSearchTerm(`${b.name} - ${b.address}`);
                          }}
                          className={`w-full text-right px-4 py-3 transition-colors ${
                            editBranchId === b.id
                              ? 'bg-slate-50 text-slate-900 font-medium'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="font-medium">{b.name}</div>
                          <div className="text-sm text-gray-500">{b.address}</div>
                        </button>
                      ))
                  ) : (
                    <div className="p-6 text-center text-sm text-gray-500">בחר בית עסק תחילה</div>
                  )}
                </div>
              </div>

              {/* Edit Time */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">שעה</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              {editError ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {editError}
                </div>
              ) : (
                <div />
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeEditStop}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedStop}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  disabled={isSubmitting}
                >
                  שמור שינויים
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}