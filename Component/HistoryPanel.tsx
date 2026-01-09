import React, { useState, useRef, useEffect } from 'react';

// --- Interfaces ---
interface SnapshotItem { id: string; item: string; qty: number; category: string; isChecked: boolean; }

// ✨ 1. เพิ่ม trackingNo เข้าไปใน Interface เพื่อรองรับข้อมูลที่ส่งกลับมา
interface HistoryRecord { 
    date: string; 
    branch: string; 
    trackingNo?: string; // ใส่ ? เผื่อข้อมูลเก่าไม่มี
    items: string; 
    missing: string; 
    note: string; 
    images: string; 
}

interface HistoryPanelProps {
    branches: string[];
    scriptUrl: string;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ branches, scriptUrl }) => {
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [historyData, setHistoryData] = useState<HistoryRecord | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const componentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
    }, []);

    const handleSearchHistory = async () => {
        if (!selectedBranch || !selectedDate) return alert("Please select branch and date before searching");
        setIsHistoryLoading(true); 
        setHistoryData(null);
        
        try {
            const url = `${scriptUrl}?action=getHistory&branch=${encodeURIComponent(selectedBranch)}&date=${selectedDate}`;
            const res = await fetch(url); 
            const data = await res.json();
            
            if (data && data.length > 0) {
                // ข้อมูลล่าสุด
                setHistoryData(data[data.length - 1]); 
            } else {
                alert("No record found for today");
            }
        } catch (error) { 
            console.error(error); 
            alert("Error fetching history"); 
        } finally { 
            setIsHistoryLoading(false); 
        }
    };

    const handleDownloadPDF = () => {
        const element = componentRef.current; 
        if (!element) return;
        
        setIsExporting(true);
        const elementsToHide = element.querySelectorAll('.hide-on-pdf'); 
        const originalStyles: string[] = [];
        
        elementsToHide.forEach((el) => { 
            const htmlEl = el as HTMLElement; 
            originalStyles.push(htmlEl.style.display); 
            htmlEl.style.display = 'none'; 
        });
        
        const opt = { 
            margin: 10, 
            filename: `POP_Report_${selectedBranch}_${selectedDate}.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2 }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };

        (import('html2pdf.js') as any).then((html2pdf: any) => {
            html2pdf.default().set(opt).from(element).save().then(() => {
                elementsToHide.forEach((el, index) => { 
                    (el as HTMLElement).style.display = originalStyles[index]; 
                }); 
                setIsExporting(false);
            });
        });
    };

    return (
        <div className="history-panel">
            {/* Controls */}
            <div className="controls-card">
                <div className="input-group">
                    <label>1. Select Branch</label>
                    <select 
                        value={selectedBranch} 
                        onChange={(e) => setSelectedBranch(e.target.value)}
                    >
                        <option value="">-- Please Select Branch --</option>
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div className="input-group">
                    <label>2. Date <span className="required">*</span></label>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)} 
                    />
                </div>
                <div className="input-group search-btn-container">
                    <button 
                        onClick={handleSearchHistory} 
                        disabled={isHistoryLoading} 
                        className="search-btn"
                    >
                        {isHistoryLoading ? '⏳ Searching...' : '🔍 Search History'}
                    </button>
                </div>
            </div>

            {/* Loading Overlay for Export */}
            {isExporting && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p className="loading-text">Exporting PDF...</p>
                </div>
            )}

            {/* Results Area */}
            <div className="result-card history-result">
                {!historyData && !isHistoryLoading && (
                    <div className="empty-state">
                        <span>🔍</span>
                        <p>Select branch and date, then press "Search History"</p>
                    </div>
                )}

                {isHistoryLoading && (
                    <div className="empty-state">
                        <div className="spinner-center"></div>
                        <p>Fetching data...</p>
                    </div>
                )}

                {historyData && (
                    <div>
                        <div className="export-btn-container">
                            <button 
                                onClick={handleDownloadPDF} 
                                className="export-btn"
                            >
                                🖨️ Export PDF / Print
                            </button>
                        </div>

                        {/* PDF Content Area */}
                        <div ref={componentRef} className="pdf-content">
                            <div className="pdf-header">
                                <h2 className="pdf-title">POP Receive Tracking Order</h2>
                                <p className="pdf-subtitle">POP Receive Tracking Order System</p>
                            </div>
                            
                            {/* ✨ 2. แก้ไขส่วนแสดงข้อมูลให้มี Tracking No. */}
                            <div className="pdf-info-grid" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div><strong>🏠 Branch:</strong> {historyData.branch}</div>
                                    {/* แสดง Tracking No. ถ้ามี */}
                                    <div><strong>📦 Tracking No.:</strong> {historyData.trackingNo || "-"}</div>
                                </div>
                                <div className="text-right">
                                    <strong>📅 Date Checked:</strong> {historyData.date}
                                </div>
                            </div>

                            <table className="pdf-table" style={{ marginTop: '15px' }}>
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th>Item</th>
                                        <th className="text-center w-60">Qty</th>
                                        <th className="text-center w-100">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => { 
                                        try { 
                                            const items: SnapshotItem[] = JSON.parse(historyData.items); 
                                            return items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>{item.category}</td>
                                                    <td>{item.item}</td>
                                                    <td className="text-center">{item.qty}</td>
                                                    <td className={`text-center font-bold ${item.isChecked ? 'text-success' : 'text-danger'}`}>
                                                        {item.isChecked ? '✅ Received' : '❌ Not Received'}
                                                    </td>
                                                </tr>
                                            )); 
                                        } catch (e) { 
                                            return <tr><td colSpan={3} className="text-center error-text">⚠️ Cannot load POP items (Data might be corrupted)</td></tr>; 
                                        } 
                                    })()}
                                </tbody>
                            </table>

                            {historyData.missing && historyData.missing !== "-" && (
                                <div className="hide-on-pdf missing-alert">
                                    <h4 className="missing-title">⚠️ Missing Items / Reported Issues:</h4>
                                    <pre className="missing-content">{historyData.missing}</pre>
                                </div>
                            )}

                            <div className="note-box">
                                <strong>📝 Note:</strong> {historyData.note || "-"}
                            </div>

                            <div className="pdf-footer">
                                <div className="timestamp">
                                    (Auto-saved on {historyData.date})
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPanel;