import React, { useMemo, useRef, useState, useEffect } from 'react';
import { FileText, Download, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import html2pdf from 'html2pdf.js';

interface Job {
  scheduled_date: string;
  branch: {
    name: string;
    address: string;
    client_id?: string;
  };
}

interface Client {
  id: string;
  full_name: string;
}

type ReportRow = {
  index: number;
  date: string;
  branchName: string;
  branchAddress: string;
};

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportClientName, setReportClientName] = useState<string>('');
  const [reportSubtitle, setReportSubtitle] = useState<string>('');
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'client')
        .order('full_name');

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  }

  const generateReport = async () => {
    try {
      if (!selectedClientId) {
        throw new Error('נא לבחור לקוח');
      }

      setIsGenerating(true);
      setError(null);
      setReportRows([]);

      // תיקון טווח תאריכים כולל כל שעות החודש
      const startDate = new Date(`${selectedMonth}-01T00:00:00`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1); // חודש הבא
      endDate.setMilliseconds(-1); // כולל את כל היום האחרון של החודש הנבחר

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          scheduled_date,
          branch:branches!inner (
            name,
            address,
            client_id
          )
        `)
        .eq('status', 'completed')
        .eq('branch.client_id', selectedClientId)
        .gte('scheduled_date', startDate.toISOString())
        .lt('scheduled_date', endDate.toISOString()) // קטן מ-חודש הבא = כולל החודש הנבחר
        .order('scheduled_date', { ascending: true });

      if (jobsError) throw jobsError;

      console.log(`Total jobs fetched: ${jobs.length}`);

      if (!jobs || jobs.length === 0) {
        throw new Error('לא נמצאו עבודות בתאריכים שנבחרו');
      }

      const { data: clientData, error: clientError } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', selectedClientId)
        .single();

      if (clientError) throw clientError;
      if (!clientData) throw new Error('לא נמצא לקוח');

      const titleClientName = clientData.full_name;
      const subtitle = format(startDate, 'MMMM yyyy', { locale: he });

      const rows: ReportRow[] = jobs.map((job, index) => {
        const date = new Date(job.scheduled_date);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();

        return {
          index: index + 1,
          date: `${day}/${month}/${year}`,
          branchName: job.branch.name ?? '',
          branchAddress: job.branch.address ?? ''
        };
      });

      setReportClientName(titleClientName);
      setReportSubtitle(subtitle);
      setReportRows(rows);

      // Wait for the hidden report DOM to render before converting to PDF
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const el = reportRef.current;
      if (!el) throw new Error('לא ניתן להפיק PDF (אלמנט דוח חסר)');

      const filename = `דוח_עבודות_${titleClientName}_${format(startDate, 'MM_yyyy')}.pdf`;

      await html2pdf()
        .set({
          // Add a slightly larger bottom margin as a "safe area" so rows near the page end
          // are more likely to move to the next page instead of getting clipped.
          margin: [10, 10, 18, 10],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          // Try to avoid splitting table rows across pages.
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'], avoid: 'tr' }
        })
        .from(el)
        .save();
    } catch (error) {
      console.error('Error generating report:', error);
      setError(error instanceof Error ? error.message : 'אירעה שגיאה בהפקת הדוח');
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTitle = useMemo(() => {
    return reportClientName ? `דו"ח עבודות חודשי - ${reportClientName}` : 'דו"ח עבודות חודשי';
  }, [reportClientName]);

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Hidden printable area for html2pdf */}
      <div
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width: 794, // roughly A4 width @ 96dpi
          background: '#fff'
        }}
      >
        <div
          ref={reportRef}
          dir="rtl"
          style={{
            padding: 24,
            fontFamily: 'Arial, "Segoe UI", Tahoma, sans-serif',
            color: '#111827'
          }}
        >
          <style>{`
            .report-root { direction: rtl; padding-bottom: 16mm; } /* safe area at bottom */
            .bidi { unicode-bidi: plaintext; }
            .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .th { background: rgb(59,130,246); color: #fff; font-weight: 700; }
            .cell, .th { border: 1px solid #e5e7eb; padding: 8px; vertical-align: middle; }
            .right { text-align: right; }
            .center { text-align: center; }
            .ltr { direction: ltr; unicode-bidi: isolate; }
            .pagebreak { page-break-after: always; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
          `}</style>

          <div className="report-root">
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }} className="bidi">{reportTitle}</div>
              <div style={{ fontSize: 14, marginTop: 4 }} className="bidi">{reportSubtitle}</div>
            </div>

            <table className="table" aria-label="Monthly report table">
              <thead>
                <tr>
                  <th className="th cell right" style={{ width: 90 }}>תאריך</th>
                  <th className="th cell right" style={{ width: 160 }}>סניף</th>
                  <th className="th cell right">כתובת</th>
                  <th className="th cell center" style={{ width: 60 }}>מס׳</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((r) => (
                  <tr key={r.index}>
                    <td className="cell right bidi"><span className="ltr">{r.date}</span></td>
                    <td className="cell right bidi">{r.branchName}</td>
                    <td className="cell right bidi">{r.branchAddress}</td>
                    <td className="cell center bidi"><span className="ltr">{r.index}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12, fontSize: 11, color: '#6b7280', textAlign: 'center' }} className="bidi">
              {/* Note: html2pdf doesn't provide an easy page count callback here */}
              הופק בתאריך: <span className="ltr">{format(new Date(), 'dd/MM/yyyy')}</span>
            </div>
          </div>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">דוחות</h1>
      <div className="bg-white rounded-lg shadow-sm max-w-2xl">
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              בחר לקוח
            </label>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="חפש לקוח..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setSearchTerm(client.full_name);
                    }}
                    className={`w-full text-right p-3 hover:bg-gray-50 ${
                      selectedClientId === client.id ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    {client.full_name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              בחר חודש
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <button
            onClick={generateReport}
            disabled={isGenerating || !selectedClientId}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <FileText className="h-5 w-5 ml-2 animate-pulse" />
                מייצר דוח...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 ml-2" />
                הפק דוח חודשי
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
