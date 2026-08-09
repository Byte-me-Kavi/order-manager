'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { flushSync } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useReactToPrint } from 'react-to-print'
import ReceiptsPrintView from './ReceiptsPrintView'
import { Loader2, Search, Filter, Plus, CheckCircle2, Printer, Trash2 } from 'lucide-react'

export default function AdminDashboard({ user }: { user: any }) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [singleOrderToPrint, setSingleOrderToPrint] = useState<any>(null)
  const [fromPhone, setFromPhone] = useState('')
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Admin_Receipts_${new Date().getTime()}`
  })

  const [startRange, setStartRange] = useState('')
  const [endRange, setEndRange] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

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
      // Range Filter
      const waybill = Number(order.waybill_id)
      const min = startRange ? Number(startRange) : 0
      const max = endRange ? Number(endRange) : Infinity

      let inRange = true
      if (startRange && endRange) inRange = waybill >= min && waybill <= max
      else if (startRange) inRange = waybill >= min
      else if (endRange) inRange = waybill <= max

      if (!inRange) return false

      // Search Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesSearch = 
          order.waybill_id?.toString().toLowerCase().includes(term) ||
          order.order_number?.toLowerCase().includes(term) ||
          order.receiver_name?.toLowerCase().includes(term) ||
          order.delivery_address?.toLowerCase().includes(term) ||
          order.city?.toLowerCase().includes(term) ||
          order.receiver_phone?.toLowerCase().includes(term) ||
          order.cod?.toString().toLowerCase().includes(term) ||
          order.manager_id?.toLowerCase().includes(term)

        if (!matchesSearch) return false
      }

      return true
    })
  }, [orders, startRange, endRange, searchTerm])

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

    if (end - start > 5000) {
      setGenMessage('Please generate a maximum of 5,000 waybills at a time to prevent server overload.')
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

    // Upsert gracefully ignores duplicates that already exist
    const { error } = await supabase.from('waybills').upsert(waybillsToInsert, { onConflict: 'waybill_id', ignoreDuplicates: true })

    if (error) {
      setGenMessage('Error generating waybills: ' + error.message)
    } else {
      setGenMessage(`Successfully generated ${waybillsToInsert.length} waybills!`)
      setGenStart('')
      setGenEnd('')
    }
    setGenerating(false)
  }

  const handleDeleteSelected = async () => {
    if (selectedOrders.size === 0) return alert('No orders selected.')
    if (!window.confirm(`Are you sure you want to delete ${selectedOrders.size} order(s)?`)) return

    setDeleting(true)
    const orderIdsToDelete = Array.from(selectedOrders)
    const waybillIdsToFree = orderIdsToDelete

    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .in('waybill_id', waybillIdsToFree)

    if (deleteError) {
      alert('Error deleting orders: ' + deleteError.message)
      setDeleting(false)
      return
    }

    const { error: updateError } = await supabase
      .from('waybills')
      .update({ is_used: false })
      .in('waybill_id', waybillIdsToFree)

    if (updateError) console.error('Error freeing waybills:', updateError)

    setSelectedOrders(new Set())
    await fetchOrders()
    setDeleting(false)
  }

  const handleDeleteAllFiltered = async () => {
    if (filteredOrders.length === 0) return alert('No orders to delete.')
    if (!window.confirm(`Are you sure you want to delete ALL ${filteredOrders.length} filtered orders? This cannot be undone.`)) return

    setDeleting(true)
    const waybillIdsToFree = filteredOrders.map(o => o.waybill_id)

    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .in('waybill_id', waybillIdsToFree)

    if (deleteError) {
      alert('Error deleting orders: ' + deleteError.message)
      setDeleting(false)
      return
    }

    const { error: updateError } = await supabase
      .from('waybills')
      .update({ is_used: false })
      .in('waybill_id', waybillIdsToFree)

    if (updateError) console.error('Error freeing waybills:', updateError)

    setSelectedOrders(new Set())
    await fetchOrders()
    setDeleting(false)
  }

  return (
    <div className="space-y-6">

      {/* Generate Waybills Section */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-900">
          <Plus className="w-5 h-5 text-emerald-600" />
          Generate Waybill Range
        </h2>
        <form onSubmit={handleGenerateWaybills} className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4 w-full">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Start ID</label>
            <input 
              type="number" 
              required
              value={genStart}
              onChange={(e) => setGenStart(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
              placeholder="e.g. 1000"
            />
          </div>
          <div className="hidden md:block pb-2 text-slate-400 font-medium">to</div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">End ID</label>
            <input 
              type="number" 
              required
              value={genEnd}
              onChange={(e) => setGenEnd(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
              placeholder="e.g. 1999"
            />
          </div>
          <button 
            type="submit" 
            disabled={generating}
            className="w-full md:w-auto mt-2 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 md:py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
      
      {/* Filters & Actions */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by any field..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-3 md:py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
            />
          </div>
          <button 
            onClick={() => {
              if (filteredOrders.length === 0) return alert('No orders to print.')
              const phone = window.prompt('Enter the telephone number for the FROM address on the receipts:', '')
              if (phone === null) return
              flushSync(() => {
                setFromPhone(phone)
                setSingleOrderToPrint(null)
              })
              handlePrint()
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto px-4 py-3 md:py-1.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print All Receipts
          </button>
          <button 
            onClick={handleDeleteSelected}
            disabled={deleting || selectedOrders.size === 0}
            className="flex items-center justify-center gap-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-4 py-3 md:py-1.5 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete Selected
          </button>
          <button 
            onClick={handleDeleteAllFiltered}
            disabled={deleting || filteredOrders.length === 0}
            className="flex items-center justify-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 px-4 py-3 md:py-1.5 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete All
          </button>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0">
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
            <div className="text-slate-400 font-medium pt-5">to</div>
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

      {/* Admin Orders Table */}
      <div className="bg-transparent md:bg-white md:border md:border-slate-200 md:shadow-sm rounded-2xl md:overflow-hidden">
        <div>
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl">No orders found matching your search.</div>
          ) : (
            <table className="w-full text-sm text-left text-slate-700 block md:table">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 hidden md:table-header-group">
                <tr>
                  <th className="px-6 py-4 font-medium w-12">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders(new Set(filteredOrders.map(o => o.waybill_id)))
                        } else {
                          setSelectedOrders(new Set())
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-4 font-medium">Waybill Id</th>
                  <th className="px-6 py-4 font-medium">Order #</th>
                  <th className="px-6 py-4 font-medium">Receiver Name</th>
                  <th className="px-6 py-4 font-medium">District</th>
                  <th className="px-6 py-4 font-medium">City</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">COD</th>
                  <th className="px-6 py-4 font-medium">Manager ID</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 block md:table-row-group">
                {filteredOrders.map((order) => (
                  <tr key={order.waybill_id} className={`hover:bg-slate-50 transition-colors block md:table-row bg-white border border-slate-200 md:border-none rounded-2xl md:rounded-none mb-4 md:mb-0 shadow-sm md:shadow-none ${selectedOrders.has(order.waybill_id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Select</div>
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        checked={selectedOrders.has(order.waybill_id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedOrders)
                          if (e.target.checked) {
                            newSelected.add(order.waybill_id)
                          } else {
                            newSelected.delete(order.waybill_id)
                          }
                          setSelectedOrders(newSelected)
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Waybill Id</div>
                      <span className="font-medium text-indigo-600">{order.waybill_id}</span>
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Order #</div>
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Receiver Name</div>
                      {order.receiver_name}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none">
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">District</div>
                      {order.district_name}
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
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-b border-slate-100 md:border-none text-xs text-slate-400" title={order.manager_id}>
                      <div className="flex md:hidden text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Manager ID</div>
                      {order.manager_id ? order.manager_id.substring(0, 8) + '...' : 'N/A'}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell text-left md:text-right bg-slate-50 md:bg-transparent rounded-b-2xl md:rounded-none">
                      <button
                        onClick={() => {
                          const phone = window.prompt('Enter the telephone number for the FROM address on the receipt:', '')
                          if (phone === null) return
                          flushSync(() => {
                            setFromPhone(phone)
                            setSingleOrderToPrint(order)
                          })
                          handlePrint()
                        }}
                        className="p-2 sm:p-1.5 w-full md:w-auto text-indigo-600 md:text-slate-400 md:hover:text-indigo-600 hover:bg-indigo-100 md:hover:bg-indigo-50 rounded-lg md:rounded-md transition-colors flex items-center justify-center gap-2"
                        title="Print Receipt"
                      >
                        <Printer className="w-4 h-4" />
                        <span className="md:hidden text-sm font-medium">Print Receipt</span>
                      </button>
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
        <ReceiptsPrintView ref={printRef} orders={singleOrderToPrint ? [singleOrderToPrint] : filteredOrders} fromPhone={fromPhone} />
      </div>
    </div>
  )
}
