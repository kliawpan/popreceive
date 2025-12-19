import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import './PopTracking.css';

// --- Type Definitions ---
interface InventoryItem {
    id: string;
    branch: string;
    category: string;
    item: string;
    qty: number;
}

interface ProgressStats {
    count: number;
    total: number;
    percent: number;
    isComplete: boolean;
}

interface SubmitPayload {
    branch: string;
    date: string;
    note: string;
    images: string[];
    missingItems: string;
}

type LoadingStatus = 'loading' | 'ready' | 'error';

// --- Constants ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzGeolO4863-OXTya5X3pSJvFaAaVgfrjFI5DqSeHfzWnAyhUeB0cU8DUiT4PO0ibsp/exec";

const SHEET_URLS = {
    brand: "https://docs.google.com/spreadsheets/d/1f4jzIQd2wdIAMclsY4vRw04SScm5xUYN0bdOz8Rn4Pk/export?format=csv&gid=577319442",
    system: "https://docs.google.com/spreadsheets/d/1f4jzIQd2wdIAMclsY4vRw04SScm5xUYN0bdOz8Rn4Pk/export?format=csv&gid=1864539100",
    special: "https://docs.google.com/spreadsheets/d/1f4jzIQd2wdIAMclsY4vRw04SScm5xUYN0bdOz8Rn4Pk/export?format=csv&gid=1283637344"
};

const PopTracking: React.FC = () => {
    // --- State ---
    const [database, setDatabase] = useState<InventoryItem[]>([]);
    const [branches, setBranches] = useState<string[]>([]);
    const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>('loading');

    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>('');

    // Store checked IDs as a Map for O(1) lookup: { "id_string": true }
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

    const [reportNote, setReportNote] = useState<string>('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDefectMode, setIsDefectMode] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // --- Effects ---
    useEffect(() => {
        // Set Default Date
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);

        // Load LocalStorage
        const savedChecks: Record<string, boolean> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('pop_check_')) {
                const id = key.replace('pop_check_', '');
                savedChecks[id] = true;
            }
        }
        setCheckedItems(savedChecks);

        // Fetch Data
        const loadAllData = async () => {
            try {
                const [brandData, systemData, specialData] = await Promise.all([
                    fetchData(SHEET_URLS.brand),
                    fetchData(SHEET_URLS.system),
                    fetchData(SHEET_URLS.special)
                ]);

                let allData: InventoryItem[] = [];
                const allBranches = new Set<string>();

                const parseData = (csv: string, catName: string) => {
                    const parsed = parseCSV(csv, catName, allBranches);
                    allData = [...allData, ...parsed];
                };

                parseData(brandData, "RE-Brand");
                parseData(systemData, "RE-System");
                parseData(specialData, "Special-POP");

                const sortedBranches = Array.from(allBranches)
                    .sort()
                    .filter(b => b.length > 2 && !b.includes("Total") && !b.includes("POP"));

                setDatabase(allData);
                setBranches(sortedBranches);
                setLoadingStatus('ready');
            } catch (error) {
                console.error(error);
                setLoadingStatus('error');
            }
        };

        loadAllData();
    }, []);

    // --- Helpers ---
    const fetchData = async (url: string): Promise<string> => {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network error");
        return await response.text();
    };

    const parseCSV = (csvText: string, categoryName: string, branchSet: Set<string>): InventoryItem[] => {
        if (!csvText) return [];
        const lines = csvText.trim().split('\n');
        let headerIndex = -1;
        const branchIndices: Record<number, string> = {};
        const parsedData: InventoryItem[] = [];

        // Find Header
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("Head Office")) {
                headerIndex = i;
                const headers = lines[i].split(',');
                headers.forEach((h, index) => {
                    const name = h.trim().replace(/^"|"$/g, '');
                    if (name && !name.includes("Total") && !name.includes("Tracking") && !name.includes("List") && !name.includes("No.")) {
                        branchSet.add(name);
                        branchIndices[index] = name;
                    }
                });
                break;
            }
        }

        if (headerIndex === -1) return [];

        for (let i = headerIndex + 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            if (row.length < 5) continue;
            const itemName = (row[1] || row[0] || "").trim().replace(/^"|"$/g, '');
            if (!itemName || itemName.startsWith("Total") || itemName.startsWith("Tracking")) continue;

            for (const [indexStr, branchName] of Object.entries(branchIndices)) {
                const index = parseInt(indexStr);
                const qtyStr = (row[index] || "0").trim().replace(/^"|"$/g, '');
                const qty = parseInt(qtyStr);
                
                if (!isNaN(qty) && qty > 0) {
                    parsedData.push({
                        branch: branchName,
                        category: categoryName,
                        item: itemName,
                        qty: qty,
                        id: `${branchName}_${itemName}`.replace(/\s+/g, '_')
                    });
                }
            }
        }
        return parsedData;
    };

    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    // --- Logic & Memos ---
    const filteredData = useMemo<InventoryItem[]>(() => {
        if (!selectedBranch) return [];
        let data = database.filter(d => d.branch === selectedBranch);
        if (selectedCategory !== 'all') {
            data = data.filter(d => d.category === selectedCategory);
        }
        return data;
    }, [database, selectedBranch, selectedCategory]);

    const progress = useMemo<ProgressStats>(() => {
        if (filteredData.length === 0) return { count: 0, total: 0, percent: 0, isComplete: false };
        const checkedCount = filteredData.filter(item => checkedItems[item.id]).length;
        const total = filteredData.length;
        return {
            count: checkedCount,
            total: total,
            percent: Math.round((checkedCount / total) * 100),
            isComplete: checkedCount === total
        };
    }, [filteredData, checkedItems]);

    // --- Handlers ---
    const handleToggleCheck = (id: string) => {
        if (!selectedDate) {
            alert('⚠️ กรุณาระบุวันที่รับของก่อนครับ');
            return;
        }
        setCheckedItems(prev => {
            const newState = { ...prev, [id]: !prev[id] };
            if (newState[id]) {
                localStorage.setItem('pop_check_' + id, 'true');
            } else {
                localStorage.removeItem('pop_check_' + id);
            }
            return newState;
        });
    };

    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;
        
        const fileList = Array.from(files);
        if (selectedFiles.length + fileList.length > 3) {
             alert('แนบไฟล์ได้ไม่เกิน 3 ไฟล์');
             return;
        }
        setSelectedFiles(prev => [...prev, ...fileList]);
        event.target.value = '';
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!selectedBranch) return alert("กรุณาเลือกสาขา");
        if (!selectedDate) return alert("กรุณาเลือกวันที่");

        const allBranchItems = database.filter(d => d.branch === selectedBranch);
        const missingList = allBranchItems
            .filter(item => !checkedItems[item.id])
            .map(item => ` ${item.item} (จำนวน: ${item.qty})`);

        const isMissing = missingList.length > 0;
        const missingString = isMissing ? missingList.join("\n") : "-";

        // Validation Logic
        if (isMissing) {
            if (!reportNote && selectedFiles.length === 0) {
                return alert("⚠️ ของไม่ครบ: กรุณาระบุรายละเอียด หรือแนบรูปภาพ");
            }
        } else if (isDefectMode) {
            if (!reportNote) return alert("⚠️ แจ้งชำรุด: กรุณาระบุรายละเอียดความเสียหาย");
            if (selectedFiles.length === 0) return alert("⚠️ แจ้งชำรุด: กรุณาแนบรูปภาพ/วิดีโอประกอบ");
        } else {
            if (selectedFiles.length === 0) {
                return alert("⚠️ รับของครบ: กรุณาถ่ายรูป/วิดีโอยืนยันการรับของ");
            }
        }

        setIsSubmitting(true);

        try {
            const mediaBase64 = await Promise.all(selectedFiles.map(file => toBase64(file)));
            
            let finalNote = reportNote;
            if (!isMissing && !isDefectMode) {
                finalNote = "Received All (รับครบถ้วน)";
            }

            const payload: SubmitPayload = {
                branch: selectedBranch,
                date: selectedDate,
                note: finalNote,
                images: mediaBase64,
                missingItems: missingString
            };

            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Alerts
            let msg = "";
            if (isMissing) {
                msg = `⚠️ บันทึกข้อมูลแล้ว (แต่มีของที่ยังไม่ได้ ${missingList.length} รายการ)\nระบบแจ้งเตือนแล้ว`;
                msg += missingList.join("\n");
                msg += `\n\n================\nระบบได้แจ้งเตือนฝ่ายที่เกี่ยวข้องแล้ว`;
            } else if (isDefectMode) {
                msg = `✅ บันทึกข้อมูลสำเร็จ (แจ้งชำรุด)`;
            } else {
                msg = `✅ บันทึกข้อมูลสำเร็จ (ครบถ้วน)\nขอบคุณครับ`;
            }
            alert(msg);

            // Cleanup
            setReportNote('');
            setSelectedFiles([]);
            setIsDefectMode(false);
            
            const newCheckedState = { ...checkedItems };
            allBranchItems.forEach(item => {
                delete newCheckedState[item.id];
                localStorage.removeItem('pop_check_' + item.id);
            });
            setCheckedItems(newCheckedState);

        } catch (error) {
            console.error(error);
            alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Render Logic ---
    const isComplete = progress.isComplete;
    
    // UI State Determination
    let reportClass = 'mode-incomplete';
    let reportIcon = '📝';
    let reportTitle = 'แจ้งปัญหา / ของไม่ครบ';
    let btnText = '🚀 ยืนยันและส่งรายงาน';

    if (isComplete && !isDefectMode) {
        reportClass = 'mode-complete';
        reportIcon = '✅';
        reportTitle = 'ยืนยันการรับของครบถ้วน';
        btnText = '✅ ยืนยันการรับของ (Submit All)';
    } else if (isDefectMode) {
        reportClass = 'mode-incomplete';
        reportIcon = '⚠️';
        reportTitle = 'รายงานสินค้าชำรุด/เสียหาย';
        btnText = '🚀 ส่งรายงานความเสียหาย';
    }

    return (
        <div className="pop-container">
            {isSubmitting && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p style={{ marginTop: 15, fontWeight: 600, color: '#ea580c' }}>กำลังส่งข้อมูลและไฟล์...</p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>(กรุณารอสักครู่ ห้ามปิดหน้าจอ)</p>
                </div>
            )}

            <header>
                <h1>POP Order Tracking</h1>
                <div className="subtitle">ระบบตรวจสอบและรายงานยอดรับวัสดุ</div>
            </header>

            <div className="status-wrapper">
                {loadingStatus === 'loading' && (
                    <div className="loading-pill">
                        <div className="dot"></div> กำลังเชื่อมต่อ...
                    </div>
                )}
                {loadingStatus === 'ready' && (
                    <div className="loading-pill ready" style={{animation: 'fadeOut 3s forwards'}}>
                         ✅ พร้อมใช้งาน
                    </div>
                )}
                {loadingStatus === 'error' && (
                    <div className="loading-pill error">❌ เชื่อมต่อไม่ได้</div>
                )}
            </div>

            <div className="controls-card">
                <div className="input-group">
                    <label>1. เลือกสาขา (Branch)</label>
                    <select 
                        value={selectedBranch} 
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={loadingStatus !== 'ready'}
                    >
                        <option value="">-- กรุณาเลือกสาขา --</option>
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div className="input-group">
                    <label>2. หมวดหมู่ (Category)</label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        <option value="all">แสดงทั้งหมด (All)</option>
                        <option value="RE-Brand">RE-Brand</option>
                        <option value="RE-System">RE-System</option>
                        <option value="Special-POP">Special POP</option>
                    </select>
                </div>
                <div className="input-group">
                    <label>3. วันที่รับของ <span className="required">*</span></label>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)} 
                    />
                    {!selectedDate && <div className="alert-date">⚠️ กรุณาระบุวันที่รับของ</div>}
                </div>
            </div>

            {selectedBranch && filteredData.length > 0 && (
                <>
                    <div className="progress-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 5, color: 'var(--text-sub)' }}>
                            <span>ความคืบหน้าการตรวจรับ</span>
                            <span>{progress.count}/{progress.total} ({progress.percent}%)</span>
                        </div>
                        <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${progress.percent}%` }}></div>
                        </div>
                    </div>

                    <div className="result-card">
                        <div className="result-header">
                            <span className="branch-title">{selectedBranch}</span>
                            <span className="total-badge">รวม {filteredData.length} รายการ</span>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 50 }}>หมวด</th>
                                        <th>รายการ</th>
                                        <th style={{ width: 40, textAlign: 'center' }}>จำนวน</th>
                                        <th style={{ width: 40, textAlign: 'center' }}>รับแล้ว</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map(row => {
                                        const isChecked = !!checkedItems[row.id];
                                        return (
                                            <tr 
                                                key={row.id} 
                                                className={isChecked ? 'checked-row' : ''} 
                                                onClick={() => handleToggleCheck(row.id)}
                                            >
                                                <td><span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, color: '#64748b' }}>
                                                    {row.category.replace('RE-', '').replace('Special-', '')}
                                                </span></td>
                                                <td className="item-name" style={{ color: '#334155', whiteSpace: 'normal', pointerEvents: 'none' }}>
                                                    {row.item}
                                                </td>
                                                <td style={{ textAlign: 'center', pointerEvents: 'none' }}>
                                                    <span className="qty-pill">{row.qty}</span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            className="custom-checkbox"
                                                            checked={isChecked}
                                                            readOnly
                                                            style={{ pointerEvents: 'none' }}
                                                            disabled={!selectedDate}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className={`report-section ${reportClass}`}>
                        <div className="report-header">
                            <div>
                                <span style={{ marginRight: 8 }}>{reportIcon}</span>
                                <span>{reportTitle}</span>
                            </div>
                            
                            {(isComplete || isDefectMode) && (
                                <button 
                                    className={`defect-toggle-btn ${isDefectMode ? 'active' : ''}`}
                                    onClick={() => setIsDefectMode(!isDefectMode)}
                                >
                                    {isDefectMode ? '↩️ ยกเลิกแจ้งชำรุด' : '⚠️ พบสินค้าชำรุด?'}
                                </button>
                            )}
                        </div>

                        <div className="report-grid">
                            {(!isComplete || isDefectMode) && (
                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                                        รายละเอียดปัญหา
                                    </label>
                                    <textarea 
                                        rows={3} 
                                        placeholder="ระบุรายการที่หายไป หรือเสียหาย..."
                                        value={reportNote}
                                        onChange={(e) => setReportNote(e.target.value)}
                                    />
                                </div>
                            )}

                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                                    แนบรูปภาพ/วิดีโอ (จำเป็น)
                                </label>
                                <div className="upload-box">
                                    <input 
                                        type="file" 
                                        className="upload-input"
                                        accept="image/*,video/*" 
                                        multiple 
                                        onChange={handleFileSelect}
                                    />
                                    <div style={{ fontSize: 24, marginBottom: 5, color: '#fb923c' }}>📷 🎥</div>
                                    <div style={{ color: '#f97316', fontSize: '0.85rem', fontWeight: 600, pointerEvents: 'none' }}>
                                        กดเพื่อถ่ายรูป/วิดีโอ หรือเลือกไฟล์<br />
                                        <span style={{ color: 'red', fontSize: '0.7rem' }}>(รวมไม่เกิน 3 ไฟล์)</span>
                                    </div>
                                </div>

                                <div className="preview-grid">
                                    {selectedFiles.map((file, index) => {
                                        const url = URL.createObjectURL(file);
                                        return (
                                            <div key={index} className="preview-item">
                                                {file.type.startsWith('video/') ? (
                                                    <video src={url} className="preview-media" controls />
                                                ) : (
                                                    <img src={url} alt="preview" className="preview-media" />
                                                )}
                                                <div className="delete-btn" onClick={() => removeFile(index)}>×</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <button className="btn-submit" onClick={handleSubmit}>
                                {btnText}
                            </button>
                        </div>
                    </div>
                    
                    <div style={{ textAlign: 'center', marginTop: 30, fontSize: '0.75rem', color: '#94a3b8' }}>
                        * ข้อมูลจะถูกบันทึกลง Google Sheet
                    </div>
                </>
            )}

            {!selectedBranch && (
                <div className="empty-state">
                    <span style={{ fontSize: '2.5rem', opacity: 0.3, display: 'block' }}>👈</span>
                    <p>เลือกสาขาเพื่อเริ่ม</p>
                </div>
            )}
            
            {selectedBranch && filteredData.length === 0 && (
                <div className="empty-state">
                    <span style={{ fontSize: '2.5rem', opacity: 0.3, display: 'block' }}>📭</span>
                    <p>ไม่พบข้อมูล</p>
                </div>
            )}
        </div>
    );
};

export default PopTracking;