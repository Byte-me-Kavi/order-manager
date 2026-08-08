'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useReactToPrint } from 'react-to-print'
import ReceiptsPrintView from './ReceiptsPrintView'
import { Download, Plus, Loader2, Printer } from 'lucide-react'

export default function ManagerDashboard({ user }: { user: any }) {
  const [orders, setOrders] = useState<any[]>([])
  const [availableWaybills, setAvailableWaybills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Manager_Receipts_${new Date().getTime()}`
  })

  // Form State
  const [formData, setFormData] = useState({
    waybill_id: '',
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
    const [ordersRes, waybillsRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('waybills').select('waybill_id').eq('is_used', false).order('waybill_id', { ascending: true })
    ])
    
    if (ordersRes.error) {
      console.error('Error fetching orders:', ordersRes.error)
    } else {
      setOrders(ordersRes.data || [])
    }

    if (waybillsRes.error) {
      console.error('Error fetching waybills:', waybillsRes.error)
    } else {
      setAvailableWaybills(waybillsRes.data || [])
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

    const payload = {
      ...formData,
      waybill_id: Number(formData.waybill_id),
      cod: Number(formData.cod),
      actual_value: formData.actual_value ? Number(formData.actual_value) : null,
      manager_id: user.id
    }

    const { error: insertError } = await supabase.from('orders').insert([payload])

    if (insertError) {
      alert('Error saving order: ' + insertError.message)
    } else {
      // Mark waybill as used
      await supabase.from('waybills').update({ is_used: true }).eq('waybill_id', payload.waybill_id)

      // Clear form except maybe some defaults
      setFormData({
        waybill_id: '',
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
            <label className="text-xs font-medium text-slate-600">Waybill Id *</label>
            <select name="waybill_id" required value={formData.waybill_id} onChange={(e) => setFormData({...formData, waybill_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors [&>option]:bg-white">
              <option value="" disabled>Select a Waybill</option>
              {availableWaybills.map(wb => (
                <option key={wb.waybill_id} value={wb.waybill_id}>{wb.waybill_id}</option>
              ))}
            </select>
          </div>
          
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
            <input type="text" name="city" required value={formData.city} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Order'}
            </button>
          </div>
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">My Orders</h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (orders.length === 0) return alert('No orders to print.')
                handlePrint()
              }}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Receipts
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No orders entered yet.</div>
          ) : (
            <table className="w-full text-sm text-left text-slate-700">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Waybill Id</th>
                  <th className="px-6 py-4 font-medium">Order #</th>
                  <th className="px-6 py-4 font-medium">Receiver Name</th>
                  <th className="px-6 py-4 font-medium">Delivery Address</th>
                  <th className="px-6 py-4 font-medium">City</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">COD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-blue-600">{order.waybill_id}</td>
                    <td className="px-6 py-4">{order.order_number}</td>
                    <td className="px-6 py-4">{order.receiver_name}</td>
                    <td className="px-6 py-4 max-w-xs truncate" title={order.delivery_address}>{order.delivery_address}</td>
                    <td className="px-6 py-4">{order.city}</td>
                    <td className="px-6 py-4">{order.receiver_phone}</td>
                    <td className="px-6 py-4 font-medium">{order.cod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Hidden Print View */}
      <div className="hidden">
        <ReceiptsPrintView ref={printRef} orders={orders} />
      </div>
    </div>
  )
}
