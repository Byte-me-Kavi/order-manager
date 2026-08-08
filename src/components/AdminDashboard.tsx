'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useReactToPrint } from 'react-to-print'
import ReceiptsPrintView from './ReceiptsPrintView'
import { Loader2, Search, Filter, Plus, CheckCircle2, Printer } from 'lucide-react'

export default function AdminDashboard({ user }: { user: any }) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Admin_Receipts_${new Date().getTime()}`
  })

  const [startRange, setStartRange] = useState('')
  const [endRange, setEndRange] = useState('')

  // Waybill Generation State
  const [genStart, setGenStart] = useState('')
  const [genEnd, setGenEnd] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genMessage, setGenMessage] = useState('')

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
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

  // Filter orders purely on the frontend to allow real-time filtering 
  // without spamming the database, since admins view all anyway.
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const waybill = Number(order.waybill_id)
      const min = startRange ? Number(startRange) : 0
      const max = endRange ? Number(endRange) : Infinity

      if (startRange && endRange) return waybill >= min && waybill <= max
      if (startRange) return waybill >= min
      if (endRange) return waybill <= max
      return true
    })
  }, [orders, startRange, endRange])

  const handleGenerateWaybills = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setGenMessage('')

    const start = Number(genStart)
    const end = Number(genEnd)

    if (start > end) {
      setGenMessage('Start ID must be less than or equal to End ID')
      setGenerating(false)
      return
    }

    // Create array of waybills to insert
    const waybillsToInsert = []
    for (let i = start; i <= end; i++) {
      waybillsToInsert.push({
        waybill_id: i,
        is_used: false,
        created_by: user.id
      })
    }

    // Insert in batches if it's too large, but for now a direct insert works for reasonable ranges
    const { error } = await supabase.from('waybills').insert(waybillsToInsert)

    if (error) {
      setGenMessage('Error generating waybills: ' + error.message)
    } else {
      setGenMessage(`Successfully generated ${waybillsToInsert.length} waybills!`)
      setGenStart('')
      setGenEnd('')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">

      {/* Generate Waybills Section */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-900">
          <Plus className="w-5 h-5 text-emerald-600" />
          Generate Waybill Range
        </h2>
        <form onSubmit={handleGenerateWaybills} className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Start Waybill ID</label>
            <input 
              type="number" 
              required
              value={genStart}
              onChange={(e) => setGenStart(e.target.value)}
              className="w-full md:w-48 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">End Waybill ID</label>
            <input 
              type="number" 
              required
              value={genEnd}
              onChange={(e) => setGenEnd(e.target.value)}
              className="w-full md:w-48 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" 
            />
          </div>
          <button 
            type="submit" 
            disabled={generating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 h-10.5"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Range'}
          </button>
          
          {genMessage && (
            <div className="ml-4 flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {genMessage}
            </div>
          )}
        </form>
      </div>
      
      {/* Filter Section */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col md:flex-row md:items-end gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-900">
            <Filter className="w-5 h-5 text-indigo-600" />
            Filter by Waybill ID Range
          </h2>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Start ID</label>
              <input 
                type="number" 
                value={startRange}
                onChange={(e) => setStartRange(e.target.value)}
                placeholder="e.g. 10000000"
                className="w-full md:w-32 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
              />
            </div>
            <div className="text-slate-400 font-medium pt-6">to</div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">End ID</label>
              <input 
                type="number" 
                value={endRange}
                onChange={(e) => setEndRange(e.target.value)}
                placeholder="e.g. 19999999"
                className="w-full md:w-32 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
              />
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-lg flex-1 flex items-center justify-between gap-3 h-10.5">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-indigo-500" />
            <p className="text-sm text-indigo-800">
              Showing <span className="font-bold">{filteredOrders.length}</span> orders.
            </p>
          </div>
          <button 
            onClick={() => {
              if (filteredOrders.length === 0) return alert('No orders to print.')
              handlePrint()
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Receipts
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No orders found.</div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap text-slate-700">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Waybill Id</th>
                  <th className="px-6 py-4 font-medium">Order #</th>
                  <th className="px-6 py-4 font-medium">Receiver Name</th>
                  <th className="px-6 py-4 font-medium">District</th>
                  <th className="px-6 py-4 font-medium">City</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">COD</th>
                  <th className="px-6 py-4 font-medium">Manager ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-indigo-600">{order.waybill_id}</td>
                    <td className="px-6 py-4">{order.order_number}</td>
                    <td className="px-6 py-4">{order.receiver_name}</td>
                    <td className="px-6 py-4">{order.district_name}</td>
                    <td className="px-6 py-4">{order.city}</td>
                    <td className="px-6 py-4">{order.receiver_phone}</td>
                    <td className="px-6 py-4 font-medium">{order.cod}</td>
                    <td className="px-6 py-4 text-xs text-slate-400" title={order.manager_id}>
                      {order.manager_id ? order.manager_id.substring(0, 8) + '...' : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Hidden Print View */}
      <div className="hidden">
        <ReceiptsPrintView ref={printRef} orders={filteredOrders} />
      </div>
    </div>
  )
}
