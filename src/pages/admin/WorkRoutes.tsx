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

      // Validate branch IDs before creating jobs - optimized with single query
      const uniqueBranchIds = [...new Set(template.stops.map(stop => stop.branch_id))];
      
      const { data: existingBranches, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .in('id', uniqueBranchIds);

      if (branchError) {
        throw new Error('שגיאה בבדיקת סניפים: ' + branchError.message);
      }

      const existingBranchIds = new Set(existingBranches?.map(b => b.id) || []);
      
      const validJobsToCreate = template.stops
        .filter(stop => {
          if (!existingBranchIds.has(stop.branch_id)) {
            console.warn(`Branch not found: ${stop.branch_id}`);
            return false;
          }
          return true;
        })
        .map(stop => ({
          branch_id: stop.branch_id,
          employee_id: stop.employee_id,
          scheduled_date: `${dateStr}T${stop.time}:00`,
          status: 'pending'
        }));

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
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">שיבוץ קווי עבודה</h1>
        <p className="text-gray-600">שבץ תבניות עבודה לימים שונים בחודש</p>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">שיבוץ תבניות</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
                className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm border border-gray-200"
                title="חודש קודם"
              >
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </button>
              <span className="font-semibold text-lg hidden sm:inline min-w-[150px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: he })}
              </span>
              <span className="font-semibold sm:hidden min-w-[80px] text-center">
                {format(currentMonth, 'MM/yyyy')}
              </span>
              <button
                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm border border-gray-200"
                title="חודש הבא"
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-6">
          <div
            className="overflow-x-auto overflow-y-hidden -mx-2 sm:mx-0 px-2 sm:px-0 pb-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
            dir="ltr"
          >
            <div className="w-max min-w-[980px] lg:w-full lg:min-w-0">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 gap-1 sm:gap-3 mb-4">
                {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((day, index) => (
                  <div 
                    key={day} 
                    className={`text-center py-1 sm:py-2 rounded-lg ${
                      index === 5 ? 'bg-blue-50' : index === 6 ? 'bg-indigo-50' : 'bg-gray-50'
                    }`}
                  >
                    <span className="hidden sm:inline font-semibold text-gray-700 text-sm">{day}</span>
                    <span className="sm:hidden font-semibold text-gray-700 text-xs">{day.slice(0, 1)}</span>
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-3">
                {getDaysInMonth().map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="p-1 sm:p-4" />;
                  }

                  const dateStr = format(date, 'yyyy-MM-dd');
                  const assignedTemplateIndex = assignments[dateStr];
                  const assignedTemplate = assignedTemplateIndex !== undefined ? templates[assignedTemplateIndex] : null;
                  const dayOfWeek = getDay(date);
                  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
                  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                  
                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[80px] sm:min-h-[120px] p-1.5 sm:p-4 border-2 rounded-xl transition-all ${
                        isToday 
                          ? 'border-indigo-500 ring-2 ring-indigo-200' 
                          : assignedTemplate
                          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-sm'
                          : isWeekend
                          ? 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-md'
                      }`}
                    >
                      <div className="h-full flex flex-col">
                        <div className={`text-center font-bold text-sm sm:text-lg mb-1 sm:mb-2 ${
                          isToday 
                            ? 'text-indigo-600' 
                            : assignedTemplate 
                            ? 'text-blue-700' 
                            : 'text-gray-700'
                        }`}>
                          {format(date, 'd')}
                        </div>
                        {assignedTemplate ? (
                          <div className="mt-auto space-y-1 sm:space-y-2">
                            <div className="bg-white rounded-lg p-1 sm:p-2 shadow-sm border border-blue-200">
                              <div className="text-[10px] sm:text-sm font-semibold text-blue-700 truncate" title={assignedTemplate.name}>
                                {assignedTemplate.name}
                              </div>
                              {assignedTemplate.stops && assignedTemplate.stops.length > 0 && (
                                <div className="text-[9px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">
                                  {assignedTemplate.stops.length} תחנות
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => removeTemplateFromDate(date)}
                              disabled={isSubmitting}
                              className="w-full text-[10px] sm:text-xs font-medium text-red-600 hover:text-white hover:bg-red-600 py-1 sm:py-1.5 rounded-md transition-colors border border-red-300 hover:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              הסר
                            </button>
                          </div>
                        ) : (
                          <select
                            className="mt-auto w-full text-[10px] sm:text-sm border-2 border-gray-300 rounded-lg py-1 sm:py-2 px-0.5 sm:px-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            value=""
                            onChange={(e) => {
                              const templateIndex = parseInt(e.target.value);
                              if (!isNaN(templateIndex)) {
                                assignTemplateToDate(date, templateIndex);
                              }
                            }}
                            disabled={isSubmitting}
                          >
                            <option value="">בחר...</option>
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
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-4 sm:mx-6 sm:mb-6 bg-red-50 border-2 border-red-300 text-red-700 px-4 py-3 rounded-xl shadow-sm flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold">שגיאה</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}
        
        {isSubmitting && (
          <div className="mx-4 mb-4 sm:mx-6 sm:mb-6 bg-blue-50 border-2 border-blue-300 text-blue-700 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="font-medium">מבצע שיבוץ...</span>
          </div>
        )}
      </div>
    </div>
  );
}