import React, { forwardRef } from 'react'
import Barcode from 'react-barcode'

interface ReceiptsPrintViewProps {
  orders: any[]
  fromPhone: string
}

const ReceiptsPrintView = forwardRef<HTMLDivElement, ReceiptsPrintViewProps>(
  ({ orders, fromPhone }, ref) => {
    // Group orders into pages of 6 (2x3 grid)
    const pages = []
    for (let i = 0; i < orders.length; i += 6) {
      pages.push(orders.slice(i, i + 6))
    }

    if (!orders || orders.length === 0) return <div ref={ref}></div>

    return (
      <div ref={ref} style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif' }}>
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
            style={{
              width: '210mm',
              height: '295mm',
              margin: '0 auto',
              backgroundColor: '#ffffff',
              padding: '6mm 8mm',
              boxSizing: 'border-box',
              position: 'relative',
              pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto'
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr 1fr',
              columnGap: '6mm',
              rowGap: '2mm',
              width: '100%',
              height: '100%'
            }}>
              {pageOrders.map((order, i) => (
                <div key={i} style={{
                  border: '1px solid #9ca3af',
                  padding: '4px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  height: 'fit-content',
                  overflow: 'hidden',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff'
                }}>
                  
                  {/* FROM Section */}
                  <div style={{ fontSize: '11px', marginBottom: '2px', paddingBottom: '2px', borderBottom: '1px solid #e5e7eb', lineHeight: '1.3', flexShrink: 0 }}>
                    <div style={{ fontWeight: 'bold', color: '#6b7280', marginBottom: '1px', letterSpacing: '0.05em', fontSize: '9px' }}>FROM</div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>Lassana lk</div>
                    <div style={{ color: '#374151' }}>Peradeniya</div>
                    <div style={{ color: '#374151' }}>Tel: {fromPhone}</div>
                  </div>

                  {/* TO Section */}
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '1px', minHeight: 0 }}>
                    <div style={{ fontWeight: 'bold', color: '#6b7280', marginBottom: '1px', letterSpacing: '0.05em', fontSize: '9px' }}>TO</div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#111827', lineHeight: '1.2', wordBreak: 'break-word' }}>{order.receiver_name}</div>
                    <div style={{ color: '#1f2937', lineHeight: '1.2', marginTop: '1px', wordBreak: 'break-word' }}>{order.delivery_address}</div>
                    <div style={{ color: '#1f2937', lineHeight: '1.2', wordBreak: 'break-word' }}>{order.city}, {order.district_name}</div>
                    <div style={{ fontWeight: 600, color: '#111827', marginTop: '2px', fontSize: '13px' }}>Tel: {order.receiver_phone}</div>
                    
                    {/* Description - under telephone */}
                    {order.description && (
                      <div style={{ marginTop: '2px', color: '#1f2937', fontSize: '12px', lineHeight: '1.2', wordBreak: 'break-word' }}>
                        <span style={{ fontWeight: 600, color: '#111827' }}>Desc: </span>
                        {order.description}
                      </div>
                    )}
                  </div>

                  {/* COD Amount Box */}
                  <div style={{
                    marginTop: '15px',
                    border: '2px solid #1f2937',
                    borderRadius: '6px',
                    padding: '2px 4px 4px 4px',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>COD Amount:</div>
                    <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#000000', letterSpacing: '-0.025em' }}>
                      Rs. {Number(order.cod).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Barcode Section */}
                  <div style={{ marginTop: '2px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '2px', flexShrink: 0 }}>
                    <Barcode 
                      value={order.waybill_id.toString()} 
                      width={1.5} 
                      height={24} 
                      fontSize={10} 
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
