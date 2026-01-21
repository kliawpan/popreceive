import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
 
interface InventoryItem { id: string; branch: string; category: string; item: string; qty: number; }

interface OrderPanelProps {
    database: InventoryItem[]; 
    branches: string[];      
    onClose: () => void;
}

const OrderPanel: React.FC<OrderPanelProps> = ({ database, branches, onClose }) => {
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('RE-Brand'); 
    const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({}); 

    const uniqueItems = useMemo(() => {
        const items = new Set<string>();
        database.forEach(d => {
            if (d.category === selectedCategory) {
                items.add(d.item);
            }
        });
        return Array.from(items).sort();
    }, [database, selectedCategory]);


    const handleQtyChange = (item: string, qty: number) => {
        setOrderQuantities(prev => ({
            ...prev,
            [item]: qty
        }));
    };

  
    const handleExportExcel = () => {
        if (!selectedBranch) return alert("กรุณาเลือกสาขาก่อน Export");

      
        const itemsToOrder = uniqueItems.filter(item => (orderQuantities[item] || 0) > 0);

        if (itemsToOrder.length === 0) return alert("กรุณาใสจำนวนสินค้าอย่างน้อย 1 รายการ");

     
        const headerInfo = [
            ["ใบสั่งซื้อสินค้า (Order Form)"],
            ["สาขา (Branch):", selectedBranch],
            ["ประเภท (Category):", selectedCategory],
            ["วันที่ (Date):", new Date().toLocaleDateString()],
            [""] 
        ];

       
        const tableHeader = ["Item Name (รายการ)", "Quantity (จำนวน)", "Status"];

      
        const dataRows = itemsToOrder.map(item => [
            item,
            orderQuantities[item],
            "Pending"
        ]);

        const finalData = [...headerInfo, tableHeader, ...dataRows];

        
        const ws = XLSX.utils.aoa_to_sheet(finalData);


        ws['!cols'] = [{ wch: 50 }, { wch: 15 }, { wch: 20 }];

  
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Order");

       
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    
        saveAs(data, `Order_${selectedBranch}_${selectedCategory}.xlsx`);
    };

    return (
        <div style={{ padding: 20, background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2>🛒 Create New Order</h2>
                    <button onClick={onClose} style={{ background: '#cbd5e1', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>Close</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>Branch</label>
                        <select 
                            value={selectedBranch} 
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                            <option value="">-- Select Branch --</option>
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>Category</label>
                        <select 
                            value={selectedCategory} 
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                setOrderQuantities({}); 
                            }}
                            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                            <option value="RE-Brand">RE-Brand</option>
                            <option value="RE-System">RE-System</option>
                            <option value="Special-POP">Special POP</option>
                            <option value="Equipment-Order">Equipment</option>
                        </select>
                    </div>
                </div>

                {/* รายการสินค้า (ตารางสั่งซื้อ) */}
                <div style={{ maxHeight: '60vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 1 }}>
                            <tr>
                                <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Item Name</th>
                                <th style={{ padding: 12, textAlign: 'center', width: 100, borderBottom: '2px solid #e2e8f0' }}>Order Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {uniqueItems.map((item, idx) => {
                                const qty = orderQuantities[item] || 0;
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: qty > 0 ? '#eff6ff' : 'white' }}>
                                        <td style={{ padding: 12 }}>{item}</td>
                                        <td style={{ padding: 12, textAlign: 'center' }}>
                                            <input 
                                                type="number" 
                                                min="0" 
                                                value={qty === 0 ? '' : qty} 
                                                placeholder="0"
                                                onChange={(e) => handleQtyChange(item, parseInt(e.target.value) || 0)}
                                                style={{ 
                                                    width: 60, 
                                                    textAlign: 'center', 
                                                    padding: '6px', 
                                                    borderRadius: 4, 
                                                    border: qty > 0 ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                                                    fontWeight: qty > 0 ? 'bold' : 'normal',
                                                    color: qty > 0 ? '#2563eb' : 'inherit'
                                                }}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer สรุปยอดและปุ่ม Export */}
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                    <div>
                        <strong>Total Items: </strong> 
                        {Object.values(orderQuantities).filter(q => q > 0).length} รายการ
                    </div>
                    <button 
                        onClick={handleExportExcel}
                        style={{ 
                            background: '#16a34a', 
                            color: 'white', 
                            border: 'none', 
                            padding: '12px 24px', 
                            borderRadius: 30, 
                            fontWeight: 'bold', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.4)'
                        }}
                    >
                        📥 Export Excel Form
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderPanel;