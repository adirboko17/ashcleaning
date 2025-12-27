import React, { useState, useEffect } from 'react';
import { FileText, Download, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { arialFontBase64 } from '../../fonts/arial-font';

interface Job {
  scheduled_date: string;
  branch: {
    name: string;
    address: string;
    client: {
      full_name: string;
    };
  };
}

interface Client {
  id: string;
  full_name: string;
}

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        direction: 'rtl'
      });

      doc.addFileToVFS('Arial.ttf', arialFontBase64);
      doc.addFont('Arial.ttf', 'Arial', 'normal');
      doc.setFont('Arial');
      doc.setR2L(true);

      doc.setFontSize(20);
      const title = `דו"ח עבודות חודשי - ${clientData.full_name}`;
      const subtitle = format(startDate, 'MMMM yyyy', { locale: he });

      doc.text(title, doc.internal.pageSize.getWidth() / 2, 20, {
        align: 'center'
      });

      doc.setFontSize(16);
      doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, 30, {
        align: 'center'
      });

      const tableData = jobs.map((job, index) => {
        const date = new Date(job.scheduled_date);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        // הפיכה מלאה של המחרוזת כדי להתמודד עם RTL
        const normalDate = `${day}/${month}/${year}`;
        const formattedDate = normalDate.split('').reverse().join('');
        
        return [
          formattedDate,
          job.branch.name,
          job.branch.address,
          (index + 1).toString().split('').reverse().join('')
        ];
      });

      autoTable(doc, {
        head: [['תאריך', 'סניף', 'כתובת', 'מס\'']],
        body: tableData,
        startY: 40,
        theme: 'grid',
        styles: {
          font: 'Arial',
          fontSize: 10,
          cellPadding: 5,
          minCellHeight: 10,
          halign: 'right',
          valign: 'middle',
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          font: 'Arial',
          fontStyle: 'normal',
          halign: 'right'
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 30 },
          1: { halign: 'right', cellWidth: 40 },
          2: { halign: 'right', cellWidth: 'auto' },
          3: { halign: 'center', cellWidth: 15 }
        },
        didDrawPage: (data) => {
          doc.setFontSize(10);
          const pageNumber = `עמוד ${data.pageNumber} מתוך ${doc.getNumberOfPages()}`;
          doc.text(
            pageNumber,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
          );
        }
      });

      doc.save(`דוח_עבודות_${clientData.full_name}_${format(startDate, 'MM_yyyy')}.pdf`);
    } catch (error) {
      console.error('Error generating report:', error);
      setError(error instanceof Error ? error.message : 'אירעה שגיאה בהפקת הדוח');
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
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
