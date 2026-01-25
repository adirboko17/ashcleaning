import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Calendar, Building2, User, CheckCircle, Clock, Plus, X, Image, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { compressReceiptImage } from '../../utils/receiptImage';

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
  note?: string | null;
  employee: {
    id: string;
    full_name: string;
  };
}

interface EditJobForm {
  employee_id: string;
  scheduled_date: string;
  note: string;
}

interface BulkEditForm {
  employee_id: string;
  scheduled_date: string;
}

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

interface AddJobForm {
  branch_id: string;
  employee_id: string;
  scheduled_date: string;
  note: string;
}

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'scheduled' | 'completed'>('scheduled');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const pageSize = 100;
  const [page, setPage] = useState(1);
  const [totalJobsCount, setTotalJobsCount] = useState(0);
  const sortOrder: 'asc' | 'desc' = 'asc'; // asc = קרוב→רחוק
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState<BulkEditForm>({
    employee_id: '',
    scheduled_date: ''
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRevertToPendingModal, setShowRevertToPendingModal] = useState(false);
  const [jobToRevert, setJobToRevert] = useState<Job | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptJob, setReceiptJob] = useState<Job | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [isReceiptSubmitting, setIsReceiptSubmitting] = useState(false);
  const [isReceiptModalDragging, setIsReceiptModalDragging] = useState(false);
  const receiptModalCardRef = React.useRef<HTMLDivElement | null>(null);
  const receiptModalPositionRef = React.useRef({ x: 0, y: 0 });
  const receiptModalRafRef = React.useRef<number | null>(null);
  const receiptModalDragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [isEditModalDragging, setIsEditModalDragging] = useState(false);
  const editModalCardRef = React.useRef<HTMLDivElement | null>(null);
  const editModalPositionRef = React.useRef({ x: 0, y: 0 });
  const editModalRafRef = React.useRef<number | null>(null);
  const editModalDragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [isAddModalDragging, setIsAddModalDragging] = useState(false);
  const addModalCardRef = React.useRef<HTMLDivElement | null>(null);
  const addModalPositionRef = React.useRef({ x: 0, y: 0 });
  const addModalRafRef = React.useRef<number | null>(null);
  const addModalDragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [isBulkEditModalDragging, setIsBulkEditModalDragging] = useState(false);
  const bulkEditModalCardRef = React.useRef<HTMLDivElement | null>(null);
  const bulkEditModalPositionRef = React.useRef({ x: 0, y: 0 });
  const bulkEditModalRafRef = React.useRef<number | null>(null);
  const bulkEditModalDragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [addForm, setAddForm] = useState<AddJobForm>({
    branch_id: '',
    employee_id: '',
    scheduled_date: '',
    note: ''
  });
  const [editForm, setEditForm] = useState<EditJobForm>({
    employee_id: '',
    scheduled_date: '',
    note: ''
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const normalizeBranch = (row: any): Branch => {
    const client = row && Array.isArray(row.client) ? row.client[0] : row?.client;
    return {
      ...row,
      client
    } as Branch;
  };

  const normalizeJob = (row: any): Job => {
    const branchRaw = Array.isArray(row.branch) ? row.branch[0] : row.branch;
    const employeeRaw = Array.isArray(row.employee) ? row.employee[0] : row.employee;
    const clientRaw = branchRaw && Array.isArray(branchRaw.client) ? branchRaw.client[0] : branchRaw?.client;

    return {
      ...row,
      branch: {
        ...branchRaw,
        client: clientRaw
      },
      employee: employeeRaw
    } as Job;
  };
  const buildLocalDayBounds = (value: string) => {
    if (!value) return null;
    const sanitized = value.trim();
    let year: number | null = null;
    let month: number | null = null;
    let day: number | null = null;

    if (sanitized.includes('/')) {
      const [maybeDay, maybeMonth, maybeYear] = sanitized.split('/');
      day = Number(maybeDay);
      month = Number(maybeMonth);
      year = Number(maybeYear);
    } else if (sanitized.includes('-')) {
      const [maybeYear, maybeMonth, maybeDay] = sanitized.split('-');
      year = Number(maybeYear);
      month = Number(maybeMonth);
      day = Number(maybeDay);
    }

    if (
      year == null ||
      month == null ||
      day == null ||
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day)
    ) {
      return null;
    }

    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const nextDayStart = new Date(start);
    nextDayStart.setDate(nextDayStart.getDate() + 1);

    return { start, nextDayStart };
  };
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const SEARCH_MAX_RESULTS = 2000;

  const DEBUG_RUN_ID = 'run1';
  const debugLog = (hypothesisId: string, location: string, message: string, data: Record<string, unknown>) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6893b515-8ba9-4632-8333-f86f69c3c160', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: DEBUG_RUN_ID,
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  };

  const normalizeForSearch = (value: unknown): string => {
    // Make free-text search resilient to RTL/LTR marks, non-breaking spaces, and extra whitespace.
    // This fixes cases where the UI shows "מוחמד" / "דרימי" but filtering returns 0 results.
    const s = String(value ?? '')
      .normalize('NFKC')
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '') // bidi control marks
      .replace(/\u00A0/g, ' '); // NBSP

    return s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  };

  const isSearchMode = normalizeForSearch(searchTerm) !== '';

  useEffect(() => {
    fetchJobs();
  }, [page, selectedDate, dateFilterMode, statusFilter, sortOrder, isSearchMode]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedDate, dateFilterMode, statusFilter, isSearchMode]);

  // Clear selection when switching pages/filters/sort or toggling bulk mode
  useEffect(() => {
    setSelectedJobIds([]);
  }, [isBulkEditMode, page, selectedDate, dateFilterMode, statusFilter, sortOrder, searchTerm]);

  useEffect(() => {
    // Reset the add modal position each time it opens
    if (showAddModal) {
      setIsAddModalDragging(false);
      addModalDragRef.current = null;
      addModalPositionRef.current = { x: 0, y: 0 };
      if (addModalRafRef.current) {
        cancelAnimationFrame(addModalRafRef.current);
        addModalRafRef.current = null;
      }
      // Apply initial transform directly (avoids rerender on drag)
      requestAnimationFrame(() => {
        if (addModalCardRef.current) {
          addModalCardRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
      });
    }
  }, [showAddModal]);

  useEffect(() => {
    // Reset the bulk edit modal position each time it opens
    if (showBulkEditModal) {
      setIsBulkEditModalDragging(false);
      bulkEditModalDragRef.current = null;
      bulkEditModalPositionRef.current = { x: 0, y: 0 };
      if (bulkEditModalRafRef.current) {
        cancelAnimationFrame(bulkEditModalRafRef.current);
        bulkEditModalRafRef.current = null;
      }
      requestAnimationFrame(() => {
        if (bulkEditModalCardRef.current) {
          bulkEditModalCardRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
      });
    }
  }, [showBulkEditModal]);

  useEffect(() => {
    // Reset the receipt modal position each time it opens
    if (showReceiptModal) {
      setIsReceiptModalDragging(false);
      receiptModalDragRef.current = null;
      receiptModalPositionRef.current = { x: 0, y: 0 };
      if (receiptModalRafRef.current) {
        cancelAnimationFrame(receiptModalRafRef.current);
        receiptModalRafRef.current = null;
      }
      requestAnimationFrame(() => {
        if (receiptModalCardRef.current) {
          receiptModalCardRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
      });
    }
  }, [showReceiptModal]);

  useEffect(() => {
    // Reset the edit modal position each time it opens
    if (showEditModal) {
      setIsEditModalDragging(false);
      editModalDragRef.current = null;
      editModalPositionRef.current = { x: 0, y: 0 };
      if (editModalRafRef.current) {
        cancelAnimationFrame(editModalRafRef.current);
        editModalRafRef.current = null;
      }
      requestAnimationFrame(() => {
        if (editModalCardRef.current) {
          editModalCardRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
      });
    }
  }, [showEditModal]);

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(receiptFile);
    setReceiptPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [receiptFile]);

  const applyAddModalTransform = () => {
    if (!addModalCardRef.current) return;
    const { x, y } = addModalPositionRef.current;
    addModalCardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const onAddModalHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start dragging when interacting with controls inside the header (e.g. close button)
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-no-drag="true"]')) return;
    if (e.button !== 0) return; // left click only

    e.currentTarget.setPointerCapture(e.pointerId);
    addModalDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: addModalPositionRef.current.x,
      originY: addModalPositionRef.current.y,
    };
    setIsAddModalDragging(true);
  };

  const onAddModalHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = addModalDragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    addModalPositionRef.current = { x: drag.originX + dx, y: drag.originY + dy };

    // Throttle DOM writes to animation frames for smoothness
    if (addModalRafRef.current == null) {
      addModalRafRef.current = requestAnimationFrame(() => {
        addModalRafRef.current = null;
        applyAddModalTransform();
      });
    }
  };

  const onAddModalHeaderPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = addModalDragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    addModalDragRef.current = null;
    setIsAddModalDragging(false);
  };

  const applyBulkEditModalTransform = () => {
    if (!bulkEditModalCardRef.current) return;
    const { x, y } = bulkEditModalPositionRef.current;
    bulkEditModalCardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const onBulkEditModalHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-no-drag="true"]')) return;
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    bulkEditModalDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: bulkEditModalPositionRef.current.x,
      originY: bulkEditModalPositionRef.current.y,
    };
    setIsBulkEditModalDragging(true);
  };

  const onBulkEditModalHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = bulkEditModalDragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    bulkEditModalPositionRef.current = { x: drag.originX + dx, y: drag.originY + dy };

    if (bulkEditModalRafRef.current == null) {
      bulkEditModalRafRef.current = requestAnimationFrame(() => {
        bulkEditModalRafRef.current = null;
        applyBulkEditModalTransform();
      });
    }
  };

  const onBulkEditModalHeaderPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = bulkEditModalDragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    bulkEditModalDragRef.current = null;
    setIsBulkEditModalDragging(false);
  };

  const applyReceiptModalTransform = () => {
    if (!receiptModalCardRef.current) return;
    const { x, y } = receiptModalPositionRef.current;
    receiptModalCardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const onReceiptModalHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-no-drag="true"]')) return;
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    receiptModalDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: receiptModalPositionRef.current.x,
      originY: receiptModalPositionRef.current.y,
    };
    setIsReceiptModalDragging(true);
  };

  const onReceiptModalHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = receiptModalDragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    receiptModalPositionRef.current = { x: drag.originX + dx, y: drag.originY + dy };

    if (receiptModalRafRef.current == null) {
      receiptModalRafRef.current = requestAnimationFrame(() => {
        receiptModalRafRef.current = null;
        applyReceiptModalTransform();
      });
    }
  };

  const onReceiptModalHeaderPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = receiptModalDragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    receiptModalDragRef.current = null;
    setIsReceiptModalDragging(false);
  };

  const applyEditModalTransform = () => {
    if (!editModalCardRef.current) return;
    const { x, y } = editModalPositionRef.current;
    editModalCardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const onEditModalHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-no-drag="true"]')) return;
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    editModalDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: editModalPositionRef.current.x,
      originY: editModalPositionRef.current.y,
    };
    setIsEditModalDragging(true);
  };

  const onEditModalHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = editModalDragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    editModalPositionRef.current = { x: drag.originX + dx, y: drag.originY + dy };

    if (editModalRafRef.current == null) {
      editModalRafRef.current = requestAnimationFrame(() => {
        editModalRafRef.current = null;
        applyEditModalTransform();
      });
    }
  };

  const onEditModalHeaderPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = editModalDragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    editModalDragRef.current = null;
    setIsEditModalDragging(false);
  };

  useEffect(() => {
    if (showAddModal || showEditModal || showBulkEditModal) {
      fetchOptionsData();
    }
  }, [showAddModal, showEditModal, showBulkEditModal]);

  useEffect(() => {
    if (selectedClientId) {
      fetchClientBranches(selectedClientId);
    } else {
      setBranches([]);
    }
  }, [selectedClientId]);

  async function fetchJobs() {
    try {
      setIsLoading(true);

      const from = isSearchMode ? 0 : (page - 1) * pageSize;
      const to = isSearchMode ? SEARCH_MAX_RESULTS - 1 : from + pageSize - 1;

      const dateField: 'scheduled_date' | 'completed_date' =
        dateFilterMode === 'completed' ? 'completed_date' : 'scheduled_date';

      debugLog('A', 'JobsList.tsx:fetchJobs:entry', 'fetchJobs called', {
        page,
        pageSize,
        from,
        to,
        selectedDate,
        dateFilterMode,
        statusFilter,
        dateField,
        searchTermPreview: String(searchTerm ?? '').slice(0, 20),
        isSearchMode,
        searchMaxResults: SEARCH_MAX_RESULTS,
      });

      let query = supabase
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
          ),
          employee:users (
            id,
            full_name
          )
        `, { count: 'exact' })
        .order(dateField, { ascending: sortOrder === 'asc' })
        .range(from, to);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (selectedDate) {
        const bounds = buildLocalDayBounds(selectedDate);
        let start: Date | null = null;
        let nextDayStart: Date | null = null;

        if (bounds) {
          start = bounds.start;
          nextDayStart = bounds.nextDayStart;
        } else {
          const fallbackDate = new Date(selectedDate);
          if (!Number.isNaN(fallbackDate.getTime())) {
            start = new Date(fallbackDate);
            start.setHours(0, 0, 0, 0);
            nextDayStart = new Date(start);
            nextDayStart.setDate(nextDayStart.getDate() + 1);
          }
        }

        if (start && nextDayStart) {
          debugLog('C', 'JobsList.tsx:fetchJobs:dateBounds', 'computed date bounds', {
            selectedDate,
            startLocal: start.toString(),
            nextDayStartLocal: nextDayStart.toString(),
            startISO: start.toISOString(),
            nextDayStartISO: nextDayStart.toISOString(),
          });
          query = query
            .gte(dateField, start.toISOString())
            .lt(dateField, nextDayStart.toISOString());
        } else {
          debugLog('A', 'JobsList.tsx:fetchJobs:dateBounds', 'failed to compute date bounds', {
            selectedDate,
            boundsWasNull: !bounds,
          });
        }
      }

      const { data, error, count } = await query;

      if (error) throw error;
      debugLog('B', 'JobsList.tsx:fetchJobs:result', 'supabase query result', {
        count,
        receivedRows: (data || []).length,
        firstRowDateField: (data && (data as any[])[0] && (data as any[])[0][dateField]) || null,
        firstRowScheduled: (data && (data as any[])[0] && (data as any[])[0].scheduled_date) || null,
        firstRowCompleted: (data && (data as any[])[0] && (data as any[])[0].completed_date) || null,
      });
      setTotalJobsCount(count ?? 0);
      setJobs((data || []).map(normalizeJob));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      debugLog('B', 'JobsList.tsx:fetchJobs:error', 'fetchJobs threw error', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchOptionsData() {
    setIsLoadingOptions(true);
    try {
      const [employeesResponse, clientsResponse] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, is_active')
          .eq('role', 'employee')
          .order('full_name'),
        supabase
          .from('users')
          .select('id, full_name')
          .eq('role', 'client')
          .order('full_name')
      ]);

      if (employeesResponse.error) throw employeesResponse.error;
      if (clientsResponse.error) throw clientsResponse.error;

      setEmployees(employeesResponse.data || []);
      setClients(clientsResponse.data || []);
    } catch (error) {
      console.error('Error fetching options:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  }

  const activeEmployees = employees.filter((e) => (e.is_active ?? true) === true);
  const selectedEmployeeRecord =
    editForm.employee_id ? employees.find((e) => e.id === editForm.employee_id) : undefined;
  const isSelectedEmployeeInactive =
    !!selectedEmployeeRecord && (selectedEmployeeRecord.is_active ?? true) === false;

  async function fetchClientBranches(clientId: string) {
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
      setBranches((data || []).map(normalizeBranch));
    } catch (error) {
      console.error('Error fetching client branches:', error);
    }
  }

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
          scheduled_date: addForm.scheduled_date,
          status: 'pending',
          note: addForm.note.trim() ? addForm.note.trim() : null
        }]);

      if (error) throw error;

      setShowAddModal(false);
      setAddForm({
        branch_id: '',
        employee_id: '',
        scheduled_date: '',
        note: ''
      });
      setSelectedClientId(null);
      setClientSearchTerm('');
      setBranchSearchTerm('');
      fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בהוספת העבודה');
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
    // המר את התאריך המקומי ל-UTC לפני השמירה
    const localDate = new Date(editForm.scheduled_date);
    const utcDate = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);

    const { error } = await supabase
      .from('jobs')
      .update({
        employee_id: editForm.employee_id,
        scheduled_date: utcDate.toISOString(), // שמור כ-UTC
        note: editForm.note.trim() ? editForm.note.trim() : null
      })
      .eq('id', selectedJob.id);

    if (error) throw error;

    setShowEditModal(false);
    setSelectedJob(null);
    setEditForm({
      employee_id: '',
      scheduled_date: '',
      note: ''
    });
    fetchJobs();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'אירעה שגיאה בעדכון העבודה');
  } finally {
    setIsSubmitting(false);
  }
};

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const toggleSelectAllOnPage = (jobIds: string[]) => {
    setSelectedJobIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = jobIds.every((id) => prevSet.has(id));
      if (allSelected) {
        jobIds.forEach((id) => prevSet.delete(id));
      } else {
        jobIds.forEach((id) => prevSet.add(id));
      }
      return Array.from(prevSet);
    });
  };

  const openBulkEdit = () => {
    setError(null);
    const selectedJobs = jobs.filter((j) => selectedJobIds.includes(j.id));

    const employeeIds = new Set(
      selectedJobs
        .map((j) => j.employee?.id)
        .filter((id): id is string => Boolean(id))
    );

    const scheduledDates = new Set(
      selectedJobs
        .map((j) => (j.scheduled_date ? j.scheduled_date.slice(0, 10) : '')) // YYYY-MM-DD
        .filter(Boolean)
    );

    setBulkEditForm({
      employee_id: employeeIds.size === 1 ? Array.from(employeeIds)[0] : '',
      scheduled_date: scheduledDates.size === 1 ? Array.from(scheduledDates)[0] : '',
    });
    setShowBulkEditModal(true);
  };

  const bulkEditScheduledDatePreview = React.useMemo(() => {
    const v = bulkEditForm.scheduled_date;
    if (!v) return null;
    const [year, month, day] = v.split('-').map(Number);
    if (!year || !month || !day) return v;
    const date = new Date(year, month - 1, day);
    return `${format(date, 'dd/MM/yyyy')} • ${format(date, 'EEEE, d בMMMM yyyy', { locale: he })}`;
  }, [bulkEditForm.scheduled_date]);

  const handleBulkEditJobs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobIds.length) return;

    if (!bulkEditForm.employee_id || !bulkEditForm.scheduled_date) {
      setError('נא לבחור עובד ותאריך');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const selectedDateString = bulkEditForm.scheduled_date; // YYYY-MM-DD
      const [year, month, day] = selectedDateString.split('-').map(Number);

      const updates = selectedJobIds.map(async (id) => {
        const job = jobs.find((j) => j.id === id);
        if (!job) return;

        // Preserve wall-clock time by setting only the date parts on a local Date object
        const originalDate = new Date(job.scheduled_date);
        const newDate = new Date(originalDate.getTime());
        newDate.setFullYear(year, month - 1, day);

        return supabase
          .from('jobs')
          .update({
            employee_id: bulkEditForm.employee_id,
            scheduled_date: newDate.toISOString(),
          })
          .eq('id', id);
      });

      const results = await Promise.all(updates);
      const error = results.find((r) => r?.error)?.error;

      if (error) throw error;

      setShowBulkEditModal(false);
      setBulkEditForm({ employee_id: '', scheduled_date: '' });
      setSelectedJobIds([]);
      setIsBulkEditMode(false);
      fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בעריכת העבודות');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeleteJob = async () => {
    if (!selectedJob) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Best-effort cleanup: remove receipt file from storage (if exists) to avoid orphans
      if (selectedJob.receipt_url) {
        const fileName = tryGetReceiptFileNameFromPublicUrl(selectedJob.receipt_url);
        if (fileName) {
          await supabase.storage.from('receipts').remove([fileName]);
        }
      }

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

  function tryGetReceiptFileNameFromPublicUrl(url: string): string | null {
    // Expected: .../storage/v1/object/public/receipts/<fileName>
    const marker = '/storage/v1/object/public/receipts/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const fileName = url.slice(idx + marker.length);
    if (!fileName || fileName.includes('/') || fileName.includes('\\')) return null;
    return fileName;
  }

  const handleRevertCompletedJobToPending = async () => {
    if (!jobToRevert) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Delete receipt image file (if any)
      if (jobToRevert.receipt_url) {
        const fileName = tryGetReceiptFileNameFromPublicUrl(jobToRevert.receipt_url);
        if (fileName) {
          await supabase.storage.from('receipts').remove([fileName]);
        }
      }

      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'pending',
          completed_date: null,
          receipt_url: null,
        })
        .eq('id', jobToRevert.id);

      if (updateError) throw updateError;

      setShowRevertToPendingModal(false);
      setJobToRevert(null);
      fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בהחזרת העבודה לסטטוס ממתין');
    } finally {
      setIsSubmitting(false);
    }
  };

  async function handleUpdateReceiptImage() {
    if (!receiptJob || !receiptFile) return;

    setReceiptError(null);
    setIsReceiptSubmitting(true);

    try {
      if (!receiptFile.type.startsWith('image/')) {
        throw new Error('נא לבחור קובץ תמונה תקין');
      }

      const compressedFile = await compressReceiptImage(receiptFile);
      const fileExt = (compressedFile.name.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${receiptJob.id}-${Date.now()}.${fileExt}`;

      const oldReceiptUrl = receiptJob.receipt_url || null;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ receipt_url: publicUrl })
        .eq('id', receiptJob.id);

      if (updateError) throw updateError;

      // Best-effort cleanup of old file (ignore failures)
      if (oldReceiptUrl) {
        const oldFileName = tryGetReceiptFileNameFromPublicUrl(oldReceiptUrl);
        if (oldFileName) {
          supabase.storage.from('receipts').remove([oldFileName]).catch(() => {
            // ignore
          });
        }
      }

      setShowReceiptModal(false);
      setReceiptJob(null);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);

      fetchJobs();
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'אירעה שגיאה בעדכון התמונה');
    } finally {
      setIsReceiptSubmitting(false);
    }
  }

  // Server-side pagination + server-side status/date filtering.
  // Client-side filtering for free-text search.
  // When search is active, we fetch up to SEARCH_MAX_RESULTS rows in one shot (single page),
  // so matches won't be spread across many pages.
  const filteredJobs = jobs.filter(job => {
    const term = normalizeForSearch(searchTerm);
    if (!term) return true;
    return (
      normalizeForSearch(job.branch?.name).includes(term) ||
      normalizeForSearch(job.branch?.address).includes(term) ||
      normalizeForSearch(job.branch?.client?.full_name).includes(term) ||
      normalizeForSearch(job.employee?.full_name).includes(term) ||
      normalizeForSearch(job.note).includes(term)
    );
  });

  const totalPages = isSearchMode ? 1 : Math.max(1, Math.ceil(totalJobsCount / pageSize));
  const selectedSet = new Set(selectedJobIds);
  // Bulk edit should be able to target both pending and completed jobs
  // (e.g. to fix employee/date on completed jobs as requested).
  const selectableJobIdsOnPage = filteredJobs.map((j) => j.id);
  const allSelectedOnPage =
    selectableJobIdsOnPage.length > 0 &&
    selectableJobIdsOnPage.every((id) => selectedSet.has(id));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(branchSearchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">ניהול עבודות</h1>
            <p className="text-blue-100">צפייה וניהול כל העבודות במערכת</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center w-full lg:w-auto"
          >
            <Plus className="h-5 w-5 ml-2" />
            הוסף עבודה חדשה
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Filters Section */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-gray-50 to-white border-b">
          <div className="space-y-3 sm:space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="חיפוש לפי לקוח, סניף, עובד או הערה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 sm:px-5 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-800 placeholder-gray-400 text-sm sm:text-base"
              />
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Date Filter */}
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-5 py-3 pr-11 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none"
                    dir="ltr"
                  />
                  <Calendar className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>

                {/* Date Filter Mode Toggle */}
                <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDateFilterMode('scheduled')}
                    className={`w-full px-3 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                      dateFilterMode === 'scheduled'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="סנן לפי תאריך תזמון"
                  >
                    תאריך תזמון
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilterMode('completed');
                      // Pending jobs don't have completed_date; switch away from pending to avoid “empty” confusion.
                      setStatusFilter((prev) => (prev === 'pending' ? 'completed' : prev));
                    }}
                    className={`w-full px-3 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                      dateFilterMode === 'completed'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="סנן לפי תאריך ביצוע"
                  >
                    תאריך ביצוע
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl sm:flex sm:gap-2 sm:p-1.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`w-full px-2 sm:px-5 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                    statusFilter === 'all'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  הכל
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`w-full px-2 sm:px-5 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                    statusFilter === 'pending'
                      ? 'bg-white text-yellow-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ממתינות
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`w-full px-2 sm:px-5 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                    statusFilter === 'completed'
                      ? 'bg-white text-green-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  הושלמו
                </button>
              </div>
            </div>
          </div>

          {/* Stats and Pagination */}
          <div className="mt-5 pt-5 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="bg-blue-50 px-4 py-2 rounded-lg">
                <span className="text-sm font-semibold text-blue-700">
                  {isSearchMode ? (
                    <>
                      נמצאו {filteredJobs.length} תוצאות חיפוש
                    </>
                  ) : (
                    <>
                      {filteredJobs.length} מתוך {totalJobsCount}
                    </>
                  )}
                </span>
                <span className="text-xs text-blue-600 mr-1">עבודות</span>
              </div>
              {!isSearchMode && (
                <div className="text-sm text-gray-600">
                  עמוד <span className="font-semibold text-gray-900">{page}</span> מתוך{' '}
                  <span className="font-semibold text-gray-900">{totalPages}</span>
                </div>
              )}
              {isSearchMode && jobs.length >= SEARCH_MAX_RESULTS && (
                <div className="text-xs text-gray-600">
                  מוצגות עד <span className="font-semibold">{SEARCH_MAX_RESULTS}</span> עבודות לחיפוש. כדי לצמצם עוד – הוסף פילטרים.
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSelectedJobIds([]);
                  setIsBulkEditMode((prev) => !prev);
                }}
                className={`w-full sm:w-auto justify-center px-4 py-2 font-medium rounded-lg transition-all inline-flex items-center gap-2 border-2 ${
                  isBulkEditMode
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                disabled={isLoading}
                title="עריכה מרובה"
              >
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {isBulkEditMode ? 'מצב עריכה מרובה פעיל' : 'עריכה מרובה'}
                </span>
                <span className="sm:hidden">
                  {isBulkEditMode ? 'עריכה פעילה' : 'עריכה'}
                </span>
              </button>
              {!isSearchMode && (
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="w-full px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    disabled={page <= 1 || isLoading}
                  >
                    הקודם
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    disabled={page >= totalPages || isLoading}
                  >
                    הבא
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50">
          {isBulkEditMode && !isLoading && (
            <div className="mb-3 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-gray-700">
                נבחרו <span className="font-semibold">{selectedJobIds.length}</span> עבודות בעמוד זה
                <span className="text-xs text-gray-500 mr-2">(אפשר לבחור גם ממתינות וגם הושלמו)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAllOnPage(selectableJobIdsOnPage)}
                  className="px-3 py-2 bg-white border-2 border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                  disabled={!selectableJobIdsOnPage.length}
                >
                  {allSelectedOnPage ? 'בטל בחירת הכל בעמוד' : 'בחר הכל בעמוד'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedJobIds([])}
                  className="px-3 py-2 bg-white border-2 border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                  disabled={!selectedJobIds.length}
                >
                  נקה בחירה
                </button>
                <button
                  type="button"
                  onClick={openBulkEdit}
                  className="px-3 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedJobIds.length}
                >
                  ערוך נבחרות
                </button>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="animate-pulse bg-white rounded-xl shadow-sm p-6">
                  <div className="flex gap-4">
                    <div className="h-16 w-16 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className={`relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border-r-4 overflow-visible ${
                    job.status === 'completed'
                      ? 'border-green-500'
                      : 'border-yellow-500'
                  }`}
                >
                  {isBulkEditMode && (
                    <div className="absolute top-3 right-3 z-10">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(job.id)}
                        onChange={() => toggleJobSelection(job.id)}
                        title="בחר עבודה"
                        className="h-5 w-5 accent-blue-600"
                      />
                    </div>
                  )}
                  {/* Status badge (top-left) */}
                  <div
                    className={`absolute top-3 left-3 z-10 inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm ${
                      job.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {job.status === 'completed' ? (
                      <>
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>הושלם</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>ממתין</span>
                      </>
                    )}
                  </div>
                  <div className="p-3 sm:p-5">
                    <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                      {/* Date and Time - Icon Box */}
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 p-2 sm:p-3 rounded-lg ${
                          job.status === 'completed'
                            ? 'bg-green-50'
                            : 'bg-yellow-50'
                        }`}>
                          <Calendar className={`h-5 w-5 sm:h-6 sm:w-6 ${
                            job.status === 'completed'
                              ? 'text-green-600'
                              : 'text-yellow-600'
                          }`} />
                        </div>
                        <div className="min-w-[140px]">
                          <p className="font-semibold text-gray-900 text-sm">
                            {format(new Date(job.scheduled_date), 'EEEE', { locale: he })}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {format(new Date(job.scheduled_date), 'd בMMMM', { locale: he })}
                          </p>
                          <p className="text-blue-600 font-medium text-base sm:text-lg mt-0.5">
                            {format(new Date(new Date(job.scheduled_date).getTime() + new Date().getTimezoneOffset() * 60000), 'HH:mm')}
                          </p>
                        </div>
                      </div>

                      {/* Vertical Divider */}
                      <div className="hidden lg:block w-px bg-gray-200 self-stretch"></div>

                      {/* Main Content */}
                      <div className="flex-1 space-y-3">
                        {/* Client and Branch */}
                        <div>
                          <Link
                            to={job.branch?.client?.id ? `/admin/clients/${job.branch.client.id}` : '#'}
                            className="text-base sm:text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors inline-flex items-center gap-2"
                          >
                            <Building2 className="h-5 w-5" />
                            {job.branch?.client?.full_name || 'לקוח לא ידוע'}
                          </Link>
                          <p className="text-xs sm:text-sm text-gray-600 mt-1 mr-7 truncate">
                            {job.branch?.name || 'סניף לא ידוע'} · {job.branch?.address || 'כתובת לא ידועה'}
                          </p>
                        </div>

                        {/* Employee */}
                        <div className="flex items-center gap-2 text-gray-700">
                          <div className="flex items-center gap-2 bg-gray-50 px-2.5 py-1 rounded-lg">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-xs sm:text-sm font-medium">{job.employee?.full_name || 'עובד לא משויך'}</span>
                          </div>
                        </div>

                        {/* Note */}
                        {!!job.note?.trim() && (
                          <div className="bg-blue-50 border-r-2 border-blue-400 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs sm:text-sm text-blue-900 truncate sm:whitespace-normal sm:overflow-visible">
                              <span className="font-semibold">הערה:</span> {job.note}
                            </p>
                          </div>
                        )}

                        {/* Completed Date */}
                        {job.completed_date && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            הושלם ב-{format(new Date(job.completed_date), 'HH:mm')}
                          </p>
                        )}
                      </div>

                      {/* Status and Actions */}
                      <div className="w-full flex flex-wrap items-center justify-between gap-2 lg:flex-col lg:items-end lg:justify-start lg:gap-3">
                        {!isBulkEditMode && (
                          <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 justify-start sm:justify-end">
                            {job.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedJob(job);
                                    setEditForm({
                                      employee_id: job.employee?.id || '',
                                      scheduled_date: job.scheduled_date ? job.scheduled_date.slice(0, 16) : '',
                                      note: job.note || ''
                                    });
                                    setShowEditModal(true);
                                  }}
                                  className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="ערוך עבודה"
                                >
                                  <Edit className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedJob(job);
                                    setShowDeleteModal(true);
                                  }}
                                  className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="מחק עבודה"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </>
                            )}
                            {job.status === 'completed' && (
                              <div className="w-full flex flex-wrap gap-2">
                                {job.receipt_url && (
                                  <button
                                    onClick={() => setSelectedImage(job.receipt_url!)}
                                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium"
                                  >
                                    <Image className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    <span>צפייה</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setReceiptJob(job);
                                    setReceiptFile(null);
                                    setReceiptError(null);
                                    setShowReceiptModal(true);
                                  }}
                                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium"
                                  title={job.receipt_url ? 'ערוך תמונה' : 'העלה תמונה'}
                                >
                                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span>{job.receipt_url ? 'עריכה' : 'העלאה'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setError(null);
                                    setJobToRevert(job);
                                    setShowRevertToPendingModal(true);
                                  }}
                                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 rounded-lg transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium"
                                  title="העבר לסטטוס ממתין (ימחק את התמונה)"
                                >
                                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span>העבר לממתין</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedJob(job);
                                    setShowDeleteModal(true);
                                  }}
                                  className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="מחק עבודה"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <Calendar className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium text-lg">לא נמצאו עבודות</p>
              <p className="text-gray-500 text-sm mt-1">נסה לשנות את הפילטרים או להוסיף עבודה חדשה</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Job Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="bg-white rounded-lg p-6 w-full max-w-2xl my-8"
            ref={addModalCardRef}
            style={{ willChange: 'transform' }}
          >
            <div
              className={`flex justify-between items-center mb-4 select-none ${isAddModalDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={onAddModalHeaderPointerDown}
              onPointerMove={onAddModalHeaderPointerMove}
              onPointerUp={onAddModalHeaderPointerUpOrCancel}
              onPointerCancel={onAddModalHeaderPointerUpOrCancel}
              style={{ touchAction: 'none' }}
              title="גרור כדי להזיז את החלון"
            >
              <h2 className="text-xl font-bold">הוספת עבודה חדשה</h2>
              <button
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setShowAddModal(false);
                  setAddForm({
                    branch_id: '',
                    employee_id: '',
                    scheduled_date: '',
                    note: ''
                  });
                  setSelectedClientId(null);
                  setClientSearchTerm('');
                  setBranchSearchTerm('');
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddJob} className="space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        setAddForm(prev => ({ ...prev, branch_id: '' }));
                      }}
                      className="input pr-10"
                      placeholder="חפש לפי שם בית עסק..."
                    />
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setClientSearchTerm(client.full_name);
                          setAddForm(prev => ({ ...prev, branch_id: '' }));
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
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            setAddForm(prev => ({ ...prev, branch_id: branch.id }));
                            setBranchSearchTerm(`${branch.name} - ${branch.address}`);
                          }}
                          className={`w-full text-right p-3 hover:bg-gray-50 ${
                            addForm.branch_id === branch.id ? 'bg-blue-50 text-blue-700' : ''
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
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    עובד
                  </label>
                  <select
                    value={addForm.employee_id}
                    onChange={(e) => setAddForm(prev => ({ ...prev, employee_id: e.target.value }))}
                    className="input"
                    required
                    disabled={isLoadingOptions}
                  >
                    <option value="">בחר עובד</option>
                    {activeEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    תאריך
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  הערה (אופציונלי)
                </label>
                <textarea
                  value={addForm.note}
                  onChange={(e) => setAddForm(prev => ({ ...prev, note: e.target.value }))}
                  className="input min-h-[96px]"
                  placeholder="לדוגמה: יש להיכנס מהדלת האחורית / קוד כניסה / דגשים מיוחדים..."
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
                    setShowAddModal(false);
                    setAddForm({
                      branch_id: '',
                      employee_id: '',
                      scheduled_date: '',
                      note: ''
                    });
                    setSelectedClientId(null);
                    setClientSearchTerm('');
                    setBranchSearchTerm('');
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
                  disabled={isSubmitting || isLoadingOptions || !addForm.branch_id}
                >
                  {isSubmitting ? 'מוסיף...' : 'הוסף עבודה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-md my-8 relative shadow-2xl"
            ref={editModalCardRef}
            style={{ willChange: 'transform' }}
          >
            <div 
              className={`flex justify-between items-center mb-4 select-none ${isEditModalDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={onEditModalHeaderPointerDown}
              onPointerMove={onEditModalHeaderPointerMove}
              onPointerUp={onEditModalHeaderPointerUpOrCancel}
              onPointerCancel={onEditModalHeaderPointerUpOrCancel}
              style={{ touchAction: 'none' }}
              title="גרור כדי להזיז את החלון"
            >
              <h2 className="text-xl font-bold">עריכת עבודה</h2>
              <button
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedJob(null);
                  setEditForm({
                    employee_id: '',
                    scheduled_date: '',
                    note: ''
                  });
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditJob} className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  עובד
                </label>
                <select
                  value={editForm.employee_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, employee_id: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">בחר עובד</option>
                  {isSelectedEmployeeInactive && selectedEmployeeRecord && (
                    <option value={selectedEmployeeRecord.id} disabled>
                      {selectedEmployeeRecord.full_name} (לא פעיל)
                    </option>
                  )}
                  {activeEmployees.map((employee) => (
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
                  value={editForm.scheduled_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="input"
                  required
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  הערה (אופציונלי)
                </label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                  className="input min-h-[96px]"
                  placeholder="דגשים לעבודה..."
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
                    setShowEditModal(false);
                    setSelectedJob(null);
                    setEditForm({
                      employee_id: '',
                      scheduled_date: '',
                      note: ''
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

      {/* Bulk Edit Modal */}
      {showBulkEditModal && isBulkEditMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md my-8 shadow-2xl relative"
            ref={bulkEditModalCardRef}
            style={{ willChange: 'transform' }}
          >
            <div
              className={`flex justify-between items-center mb-4 select-none ${isBulkEditModalDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={onBulkEditModalHeaderPointerDown}
              onPointerMove={onBulkEditModalHeaderPointerMove}
              onPointerUp={onBulkEditModalHeaderPointerUpOrCancel}
              onPointerCancel={onBulkEditModalHeaderPointerUpOrCancel}
              style={{ touchAction: 'none' }}
              title="גרור כדי להזיז את החלון"
            >
              <h2 className="text-xl font-bold">עריכת עבודות מרובה</h2>
              <button
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setShowBulkEditModal(false);
                  setBulkEditForm({ employee_id: '', scheduled_date: '' });
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              נבחרו <span className="font-semibold">{selectedJobIds.length}</span> עבודות (ממתינות והושלמו).
            </p>

            <form onSubmit={handleBulkEditJobs} className="space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  עובד
                </label>
                <select
                  value={bulkEditForm.employee_id}
                  onChange={(e) => setBulkEditForm(prev => ({ ...prev, employee_id: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">בחר עובד</option>
                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  תאריך
                </label>
                <input
                  type="date"
                  value={bulkEditForm.scheduled_date}
                  onChange={(e) => setBulkEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="input"
                  required
                  dir="ltr"
                />
                {bulkEditScheduledDatePreview && (
                  <p className="mt-1 text-xs text-gray-600">
                    תאריך שנבחר: <span className="font-medium">{bulkEditScheduledDatePreview}</span>
                  </p>
                )}
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
                    setShowBulkEditModal(false);
                    setBulkEditForm({ employee_id: '', scheduled_date: '' });
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
                  disabled={isSubmitting || !selectedJobIds.length}
                >
                  {isSubmitting ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Job Modal */}
      {showDeleteModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md my-8 shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">מחיקת עבודה</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedJob(null);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
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
              <div className="bg-red-50 border border -red-200 text-red-600 px-4 py-3 rounded-md mb-4">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-4 space-x-reverse">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
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

      {/* Revert to Pending Modal (for completed jobs) */}
      {showRevertToPendingModal && jobToRevert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md my-8 shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">החזרה לסטטוס ממתין</h2>
              <button
                onClick={() => {
                  setShowRevertToPendingModal(false);
                  setJobToRevert(null);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-2">
              <p className="text-gray-700">
                פעולה זו תחזיר את העבודה לסטטוס <span className="font-semibold">ממתין</span>.
              </p>
              <p className="text-sm text-yellow-700">
                אם קיימת תמונת עבודה/קבלה, היא תימחק.
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
                  setShowRevertToPendingModal(false);
                  setJobToRevert(null);
                  setError(null);
                }}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleRevertCompletedJobToPending}
                className="btn bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'מעדכן...' : 'העבר לממתין'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Receipt Modal */}
      {showReceiptModal && receiptJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto z-50">
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-md my-8 shadow-2xl relative"
            ref={receiptModalCardRef}
            style={{ willChange: 'transform' }}
          >
            <div 
              className={`flex justify-between items-center mb-4 select-none ${isReceiptModalDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={onReceiptModalHeaderPointerDown}
              onPointerMove={onReceiptModalHeaderPointerMove}
              onPointerUp={onReceiptModalHeaderPointerUpOrCancel}
              onPointerCancel={onReceiptModalHeaderPointerUpOrCancel}
              style={{ touchAction: 'none' }}
              title="גרור כדי להזיז את החלון"
            >
              <h2 className="text-xl font-bold">
                {receiptJob.receipt_url ? 'עריכת תמונת עבודה' : 'העלאת תמונת עבודה'}
              </h2>
              <button
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptJob(null);
                  setReceiptFile(null);
                  setReceiptError(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
              <div className="text-sm text-gray-700">
                <div className="font-medium">{receiptJob.branch.client.full_name}</div>
                <div className="text-gray-600">{receiptJob.branch.name} - {receiptJob.branch.address}</div>
                <div className="text-gray-500">
                  {format(new Date(receiptJob.scheduled_date), 'EEEE, d בMMMM', { locale: he })}{' '}
                  {format(
                    new Date(new Date(receiptJob.scheduled_date).getTime() + new Date().getTimezoneOffset() * 60000),
                    'HH:mm'
                  )}
                </div>
              </div>

              {(receiptPreviewUrl || receiptJob.receipt_url) && (
                <div className="border rounded-lg p-2 bg-gray-50">
                  <img
                    src={receiptPreviewUrl || receiptJob.receipt_url}
                    alt="תצוגה מקדימה"
                    className="w-full max-h-[420px] object-contain rounded"
                  />
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="receipt-edit-upload"
                />
                <label
                  htmlFor="receipt-edit-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Image className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    {receiptFile ? receiptFile.name : 'בחר תמונה חדשה'}
                  </span>
                </label>
              </div>

              {receiptError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 mt-0.5" />
                  <span>{receiptError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-4 space-x-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowReceiptModal(false);
                    setReceiptJob(null);
                    setReceiptFile(null);
                    setReceiptError(null);
                  }}
                  className="btn btn-secondary"
                  disabled={isReceiptSubmitting}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleUpdateReceiptImage}
                  className="btn btn-primary"
                  disabled={!receiptFile || isReceiptSubmitting}
                >
                  {isReceiptSubmitting ? 'שומר...' : 'שמור תמונה'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


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