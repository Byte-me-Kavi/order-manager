'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { supabase } from '@/lib/supabase'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import ReceiptsPrintView from './ReceiptsPrintView'
import { Download, Plus, Loader2, Printer, Trash2, X } from 'lucide-react'
import citiesData from '@/lib/cities.json'

export default function ManagerDashboard({ user }: { user: any }) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [singleOrderToPrint, setSingleOrderToPrint] = useState<any>(null)
  const [fromPhone, setFromPhone] = useState('')
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false)
  const [pendingPrintAction, setPendingPrintAction] = useState<'all' | 'single' | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

  const handlePrintClick = (action: 'all' | 'single', order?: any) => {
    if (action === 'all' && orders.length === 0) return alert('No orders to print.')
    setPendingPrintAction(action)
    if (action === 'single') setSingleOrderToPrint(order)
    setIsPhoneModalOpen(true)
  }

  const handleConfirmPrint = async () => {
    setIsPhoneModalOpen(false)
    setIsGeneratingPdf(true)
    
    if (pendingPrintAction === 'all') {
      setSingleOrderToPrint(null)
    }

    // Wait for React to render the hidden print view with new state
    await new Promise(resolve => setTimeout(resolve, 500))

    const element = printRef.current
    if (!element) {
      setIsGeneratingPdf(false)
      return
    }

    try {
      // Dynamically import html2pdf.js for client side
      const html2pdf = (await import('html2pdf.js')).default
      const opt = {
        margin:       0,
        filename:     `Receipts_${new Date().getTime()}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
        pagebreak:    { mode: ['css'] }
      }
      
      await html2pdf().set(opt).from(element).save()
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    } finally {
      setIsGeneratingPdf(false)
      setPendingPrintAction(null)
    }
  }

  // Form State
  const [formData, setFormData] = useState({
    order_number: '',
    receiver_name: '',
    delivery_address: '',
    district_name: '',
    city: '',
    receiver_phone: '',
    cod: '',
    description: '',
    actual_value: ''
  })

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('manager_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching orders:', error)
    } else {
      setOrders(data || [])
    }
    
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const availableCities = (citiesData as Record<string, string[]>)[formData.district_name] || []
    const exactCity = availableCities.find(c => c.toLowerCase() === formData.city.toLowerCase())
    if (!exactCity) {
      alert(`Please select a valid city from the suggestions for ${formData.district_name || 'the selected district'}.`)
      setSaving(false)
      return
    }

    const payload = {
      ...formData,
      city: exactCity,
      cod: Number(formData.cod),
      actual_value: formData.actual_value ? Number(formData.actual_value) : null,
      manager_id: user.id
    }

    const { error: insertError } = await supabase.from('orders').insert([payload])

    if (insertError) {
      alert('Error saving order: ' + insertError.message)
    } else {
      // Clear form except maybe some defaults
      setFormData({
        order_number: '',
        receiver_name: '',
        delivery_address: '',
        district_name: '',
        city: '',
        receiver_phone: '',
        cod: '',
        description: '',
        actual_value: ''
      })
      fetchOrders()
    }
    setSaving(false)
  }

  const handleExport = async () => {
    if (orders.length === 0) return alert('No orders to export.')

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Orders')

    worksheet.columns = [
      { header: 'Waybill Id', key: 'waybill_id' },
      { header: 'Order Number', key: 'order_number' },
      { header: 'Receiver Name', key: 'receiver_name' },
      { header: 'Delivery Address', key: 'delivery_address' },
      { header: 'District Name', key: 'district_name' },
      { header: 'City', key: 'city' },
      { header: 'Receiver Phone', key: 'receiver_phone' },
      { header: 'COD', key: 'cod' },
      { header: 'Description', key: 'description' },
      { header: 'Actual Value', key: 'actual_value' }
    ]

    orders.forEach(order => {
      worksheet.addRow({
        waybill_id: order.waybill_id,
        order_number: order.order_number,
        receiver_name: order.receiver_name,
        delivery_address: order.delivery_address,
        district_name: order.district_name,
        city: order.city,
        receiver_phone: order.receiver_phone,
        cod: order.cod,
        description: order.description || '',
        actual_value: order.actual_value || ''
      })
    })

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' } // Dark blue header
      }
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })

    // Auto-fit columns and add borders to all cells
    worksheet.columns.forEach(column => {
      let maxLength = 0
      column.eachCell?.({ includeEmpty: true }, (cell, rowNumber) => {
        const columnLength = cell.value ? cell.value.toString().length : 10
        if (columnLength > maxLength) {
          maxLength = columnLength
        }
        
        // Add borders to data cells
        if (rowNumber > 1) {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
          }
        }
      })
      column.width = maxLength < 10 ? 12 : maxLength + 2
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Manager_Orders_${new Date().getTime()}.xlsx`)
  }

  const handleDeleteSelected = async () => {
    if (selectedOrders.size === 0) return alert('No orders selected.')
    if (!window.confirm(`Are you sure you want to delete ${selectedOrders.size} order(s)?`)) return

    setDeleting(true)
    const idsToDelete = Array.from(selectedOrders)

    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      alert('Error deleting orders: ' + deleteError.message)
      setDeleting(false)
      return
    }

    setSelectedOrders(new Set())
    await fetchOrders()
    setDeleting(false)
  }

  const handleDeleteAll = async () => {
    if (orders.length === 0) return alert('No orders to delete.')
    if (!window.confirm('Are you sure you want to delete ALL your orders? This cannot be undone.')) return

    setDeleting(true)
    const orderIds = orders.map(o => o.id)

    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .in('id', orderIds)

    if (deleteError) {
      alert('Error deleting orders: ' + deleteError.message)
      setDeleting(false)
      return
    }

    setSelectedOrders(new Set())
    await fetchOrders()
    setDeleting(false)
  }

  const cityOptions = useMemo(() => {
    const availableCities = (citiesData as Record<string, string[]>)[formData.district_name] || []
    return availableCities.map(city => <option key={city} value={city} />)
  }, [formData.district_name])

  return (
    <div className="space-y-8">
      {/* Entry Form */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-900">
          <Plus className="w-5 h-5 text-blue-600" />
          Add New Order
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Order Number *</label>
            <input type="text" name="order_number" required value={formData.order_number} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Receiver Name *</label>
            <input type="text" name="receiver_name" required value={formData.receiver_name} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">District Name *</label>
            <select name="district_name" required value={formData.district_name} onChange={(e) => setFormData({...formData, district_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors [&>option]:bg-white">
              <option value="" disabled>Select District</option>
              {['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Moneragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">City *</label>
            <input type="text" name="city" list="city-suggestions" required value={formData.city} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" autoComplete="off" />
            <datalist id="city-suggestions">
              {cityOptions}
            </datalist>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Receiver Phone *</label>
            <input type="text" name="receiver_phone" required value={formData.receiver_phone} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">COD Amount *</label>
            <input type="number" step="0.01" name="cod" required value={formData.cod} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Actual Value</label>
            <input type="number" step="0.01" name="actual_value" value={formData.actual_value} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-medium text-slate-600">Delivery Address *</label>
            <input type="text" name="delivery_address" required value={formData.delivery_address} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-medium text-slate-600">Description</label>
            <input type="text" name="description" value={formData.description} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>

          <div className="xl:col-span-4 flex justify-end mt-4">
            <button 
              type="submit" 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Order'}
            </button>
          </div>
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-transparent md:bg-white md:border md:border-slate-200 md:shadow-sm rounded-2xl md:overflow-hidden">
        <div className="p-4 md:p-6 md:border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-2xl md:rounded-none shadow-sm md:shadow-none mb-4 md:mb-0 border border-slate-200 md:border-none">
          <h2 className="text-xl font-semibold text-slate-900">My Orders</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => handlePrintClick('all')}
              disabled={isGeneratingPdf}
              className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-3 sm:py-2 rounded-xl text-sm font-medium transition-colors w-full sm:w-auto disabled:opacity-50"
            >
              {isGeneratingPdf && pendingPrintAction === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {isGeneratingPdf && pendingPrintAction === 'all' ? 'Generating...' : 'Print All Receipts'}
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-4 py-3 sm:py-2 rounded-xl text-sm font-medium transition-colors w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
            <button 
              onClick={handleDeleteSelected}
              disabled={deleting || selectedOrders.size === 0}
              className="flex items-center justify-center gap-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-4 py-3 sm:py-2 rounded-xl text-sm font-medium transition-colors w-full sm:w-auto disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Selected
            </button>
            <button 
              onClick={handleDeleteAll}
              disabled={deleting || orders.length === 0}
              className="flex items-center justify-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 px-4 py-3 sm:py-2 rounded-xl text-sm font-medium transition-colors w-full sm:w-auto disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete All
            </button>
          </div>
        </div>
        
        <div>
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl">No orders entered yet.</div>
          ) : (
            <table className="w-full text-sm text-left text-slate-700 block md:table">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 hidden md:table-header-group">
                <tr>
                  <th className="px-6 py-4 font-medium w-12">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      checked={orders.length > 0 && selectedOrders.size === orders.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders(new Set(orders.map(o => o.id)))
                        } else {
                          setSelectedOrders(new Set())
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-4 font-medium">Waybill Id</th>
                  <th className="px-6 py-4 font-medium">Order #</th>
                  <th className="px-6 py-4 font-medium">Receiver Name</th>
                  <th className="px-6 py-4 font-medium">Delivery Address</th>
                  <th className="px-6 py-4 font-medium">City</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">COD</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 block md:table-row-group">
                {orders.map((order) => (
                  <tr key={order.id} className={`hover:bg-slate-50 transition-colors block md:table-row bg-white border border-slate-200 md:border-none rounded-2xl md:rounded-none mb-4 md:mb-0 shadow-sm md:shadow-none ${selectedOrders.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Select</div>
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedOrders)
                          if (e.target.checked) {
                            newSelected.add(order.id)
                          } else {
                            newSelected.delete(order.id)
                          }
                          setSelectedOrders(newSelected)
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Waybill Id</div>
                      <span className="font-medium text-blue-600">{order.waybill_id}</span>
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Order #</div>
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Receiver Name</div>
                      {order.receiver_name}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none md:max-w-xs md:truncate" title={order.delivery_address}>
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Delivery Address</div>
                      {order.delivery_address}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">City</div>
                      {order.city}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Phone</div>
                      {order.receiver_phone}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">COD Amount</div>
                      <span className="font-medium text-slate-900">{order.cod}</span>
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell text-left md:text-right bg-slate-50 md:bg-transparent rounded-b-2xl md:rounded-none">
                      <button
                        onClick={() => handlePrintClick('single', order)}
                        disabled={isGeneratingPdf}
                        className="p-2 sm:p-1.5 w-full md:w-auto text-indigo-600 md:text-slate-400 md:hover:text-indigo-600 hover:bg-indigo-100 md:hover:bg-indigo-50 rounded-lg md:rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        title="Print Receipt"
                      >
                        {isGeneratingPdf && singleOrderToPrint?.waybill_id === order.waybill_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        <span className="md:hidden text-sm font-medium">{isGeneratingPdf && singleOrderToPrint?.waybill_id === order.waybill_id ? 'Wait...' : 'Print Receipt'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Phone Number Modal */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Print Receipts</h3>
              <button onClick={() => setIsPhoneModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  FROM Telephone Number
                </label>
                <input 
                  type="text" 
                  value={fromPhone} 
                  onChange={e => setFromPhone(e.target.value)} 
                  placeholder="e.g. 077 123 4567"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setIsPhoneModalOpen(false)} 
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmPrint} 
                  disabled={!fromPhone.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Generate PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print View */}
      <div className="hidden">
        <ReceiptsPrintView ref={printRef} orders={singleOrderToPrint ? [singleOrderToPrint] : orders} fromPhone={fromPhone} />
      </div>
    </div>
  )
}
