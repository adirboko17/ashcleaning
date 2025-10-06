import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, addDays, getDay } from 'date-fns';
import { he } from 'date-fns/locale';

interface Template {
  id: string;
  name: string;
  stops: any[];
}

export default function WorkRoutes() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [assignments, setAssignments] = useState<{ [key: string]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    loadSavedTemplates();
    loadSavedAssignments();
  }, []);

  async function loadSavedTemplates() {
    try {
      const { data: savedTemplates, error } = await supabase
        .from('work_route_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(savedTemplates || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('אירעה שגיאה בטעינת התבניות');
    }
  }

  async function loadSavedAssignments() {
    try {
      const { data: savedAssignments, error } = await supabase
        .from('work_route_assignments')
        .select('*')
        .order('date');

      if (error) throw error;

      if (savedAssignments) {
        const assignmentsMap = savedAssignments.reduce((acc, assignment) => {
          acc[assignment.date] = assignment.template_index;
          return acc;
        }, {} as { [key: string]: number });

        setAssignments(assignmentsMap);
      }
    } catch (err) {
      console.error('Error loading assignments:', err);
      setError('אירעה שגיאה בטעינת השיבוצים');
    }
  }

  const assignTemplateToDate = async (date: Date, templateIndex: number) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const template = templates[templateIndex];
      if (!template) {
        throw new Error('תבנית לא נמצאה');
      }

      const dateStr = format(date, 'yyyy-MM-dd');

      if (!template.stops || !Array.isArray(template.stops) || template.stops.length === 0) {
        throw new Error('אין תחנות בתבנית');
      }

      // Delete existing jobs for this date
      const { error: deleteError } = await supabase
        .from('jobs')
        .delete()
        .gte('scheduled_date', `${dateStr}T00:00:00`)
        .lt('scheduled_date', `${dateStr}T23:59:59`);

      if (deleteError) throw deleteError;

      // Validate branch IDs before creating jobs
      const validJobsToCreate = [];
      for (const stop of template.stops) {
        // Check if branch exists
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('id')
          .eq('id', stop.branch_id)
          .maybeSingle();

        if (branchError) {
          console.error(`Error checking branch ${stop.branch_id}:`, branchError);
          continue;
        }

        if (!branchData) {
          console.error(`Branch not found: ${stop.branch_id}`);
          continue;
        }

        validJobsToCreate.push({
          branch_id: stop.branch_id,
          employee_id: stop.employee_id,
          scheduled_date: `${dateStr}T${stop.time}:00`,
          status: 'pending'
        });
      }

      if (validJobsToCreate.length === 0) {
        throw new Error('לא נמצאו סניפים תקינים בתבנית');
      }

      // Create new jobs
      const { error: jobsError } = await supabase
        .from('jobs')
        .insert(validJobsToCreate);

      if (jobsError) throw jobsError;

      // Update assignment record
      const { error: assignmentError } = await supabase
        .from('work_route_assignments')
        .upsert({
          date: dateStr,
          template_index: templateIndex,
          employee_id: template.stops[0].employee_id
        });

      if (assignmentError) throw assignmentError;

      setAssignments(prev => ({
        ...prev,
        [dateStr]: templateIndex
      }));

      setError(null);
    } catch (err) {
      console.error('Error assigning template:', err);
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בשיבוץ התבנית');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeTemplateFromDate = async (date: Date) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const dateStr = format(date, 'yyyy-MM-dd');

      // Delete jobs for this date
      const { error: deleteJobsError } = await supabase
        .from('jobs')
        .delete()
        .gte('scheduled_date', `${dateStr}T00:00:00`)
        .lt('scheduled_date', `${dateStr}T23:59:59`);

      if (deleteJobsError) throw deleteJobsError;

      // Delete assignment record
      const { error: deleteAssignmentError } = await supabase
        .from('work_route_assignments')
        .delete()
        .eq('date', dateStr);

      if (deleteAssignmentError) throw deleteAssignmentError;

      setAssignments(prev => {
        const newAssignments = { ...prev };
        delete newAssignments[dateStr];
        return newAssignments;
      });

      setError(null);
    } catch (err) {
      console.error('Error removing template:', err);
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בהסרת התבנית');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = [];

    const firstDayOfWeek = getDay(start);
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    let current = start;
    while (current <= end) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }

    return days;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">שיבוץ קווי עבודה</h1>

      {/* Calendar View */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">שיבוץ תבניות</h2>
            <div className="flex items-center space-x-4 space-x-reverse">
              <button
                onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="font-medium hidden sm:inline">
                {format(currentMonth, 'MMMM yyyy', { locale: he })}
              </span>
              <span className="font-medium sm:hidden">
                {format(currentMonth, 'MM/yyyy')}
              </span>
              <button
                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-4">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-2 sm:mb-4">
            {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((day) => (
              <div key={day} className="text-center">
                <span className="hidden sm:inline font-medium text-gray-500">{day}</span>
                <span className="sm:hidden font-medium text-gray-500">{day.slice(0, 1)}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 sm:gap-4">
            {getDaysInMonth().map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="p-2 sm:p-4" />;
              }

              const dateStr = format(date, 'yyyy-MM-dd');
              const assignedTemplateIndex = assignments[dateStr];
              const assignedTemplate = assignedTemplateIndex !== undefined ? templates[assignedTemplateIndex] : null;
              
              return (
                <div
                  key={dateStr}
                  className={`p-2 sm:p-4 border rounded-lg ${
                    assignedTemplate
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-medium">
                      {format(date, 'd')}
                    </div>
                    {assignedTemplate ? (
                      <div className="mt-2 space-y-2">
                        <div className="text-xs sm:text-sm text-blue-600">
                          {assignedTemplate.name}
                        </div>
                        <button
                          onClick={() => removeTemplateFromDate(date)}
                          disabled={isSubmitting}
                          className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          הסר
                        </button>
                      </div>
                    ) : (
                      <select
                        className="mt-2 w-full text-xs sm:text-sm border-gray-300 rounded-md"
                        value=""
                        onChange={(e) => {
                          const templateIndex = parseInt(e.target.value);
                          if (!isNaN(templateIndex)) {
                            assignTemplateToDate(date, templateIndex);
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        <option value="">שבץ</option>
                        {templates.map((template, index) => (
                          <option key={template.id} value={index}>
                            {template.name}
                            {template.stops && template.stops.length > 0 ? 
                              ` (${template.stops.length})` : 
                              ' (ריקה)'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="m-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}