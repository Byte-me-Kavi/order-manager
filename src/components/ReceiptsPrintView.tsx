import React, { forwardRef } from 'react'
import Barcode from 'react-barcode'

interface ReceiptsPrintViewProps {
  orders: any[]
  fromPhone: string
}

const ReceiptsPrintView = forwardRef<HTMLDivElement, ReceiptsPrintViewProps>(
  ({ orders, fromPhone }, ref) => {
    // Group orders into pages of 6
    const pages = []
    for (let i = 0; i < orders.length; i += 6) {
      pages.push(orders.slice(i, i + 6))
    }

    if (!orders || orders.length === 0) return <div ref={ref}></div>

    return (
      <div ref={ref} className="bg-white text-black font-sans">
        <style type="text/css" media="print">
          {`
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; background: white; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          `}
        </style>

        {pages.map((pageOrders, pageIdx) => (
          <div
            key={pageIdx}
            className="w-[210mm] h-[297mm] mx-auto bg-white p-[10mm] box-border relative"
            style={{ pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto' }}
          >
            <div className="grid grid-cols-2 grid-rows-3 gap-[10mm] w-full h-full">
              {pageOrders.map((order, i) => (
                <div key={i} className="border border-gray-400 p-3 flex flex-col justify-between h-full overflow-hidden rounded-xl bg-white shadow-sm">
                  
                  {/* FROM Section */}
                  <div className="text-[11px] mb-1 pb-1 border-b border-gray-200 leading-snug shrink-0">
                    <div className="font-bold text-gray-500 mb-0.5 tracking-wider text-[9px]">FROM</div>
                    <div className="font-semibold text-gray-900">Lassana lk</div>
                    <div className="text-gray-700">Peradeniya</div>
                    <div className="text-gray-700">Tel: {fromPhone}</div>
                  </div>

                  {/* TO Section */}
                  <div className="text-sm flex-1 flex flex-col justify-center py-1 min-h-0">
                    <div className="font-bold text-gray-500 mb-0.5 tracking-wider text-[10px]">TO</div>
                    <div className="font-bold text-base text-gray-900 leading-tight truncate">{order.receiver_name}</div>
                    <div className="text-gray-800 leading-snug mt-0.5 line-clamp-2">{order.delivery_address}</div>
                    <div className="text-gray-800 leading-snug truncate">{order.city}, {order.district_name}</div>
                    <div className="font-semibold text-gray-900 mt-1">Tel: {order.receiver_phone}</div>
                    {order.description && (
                      <div className="text-gray-600 text-[11px] mt-1 line-clamp-2">Desc: {order.description}</div>
                    )}
                  </div>

                  {/* COD Amount Box */}
                  <div className="mt-1 border-2 border-gray-800 rounded-lg p-1.5 text-center bg-gray-50 flex flex-col justify-center shrink-0">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">COD Amount:</div>
                    <div className="text-lg font-bold text-black tracking-tight">
                      Rs. {Number(order.cod).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Barcode Section */}
                  <div className="mt-2 flex justify-center border-t border-gray-200 pt-2 shrink-0">
                    <Barcode 
                      value={order.waybill_id.toString()} 
                      width={1.5} 
                      height={35} 
                      fontSize={12} 
                      margin={0} 
                      displayValue={true}
                      background="transparent"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
)

ReceiptsPrintView.displayName = 'ReceiptsPrintView'

export default ReceiptsPrintView
