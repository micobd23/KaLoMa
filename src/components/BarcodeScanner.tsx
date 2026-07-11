import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library'
import type { Result } from '@zxing/library'
import { useEscapeKey } from '../lib/useEscapeKey'

interface Props {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [status, setStatus] = useState('Kamera wird gestartet…')

  useEscapeKey(handleClose)

  useEffect(() => {
    start()
    return () => stop()
  }, [])

  function stop() {
    if (readerRef.current) {
      try { readerRef.current.reset() } catch { /* noop */ }
      readerRef.current = null
    }
    const video = videoRef.current
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
  }

  async function start() {
    try {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.UPC_A,
      ])
      const reader = new BrowserMultiFormatReader(hints)
      readerRef.current = reader
      setStatus('Barcode in die Kamera halten…')
      await reader.decodeFromVideoDevice(null, videoRef.current, (result: Result | undefined) => {
        if (result) {
          stop()
          onScan(result.getText())
        }
      })
    } catch {
      setStatus('Kamerazugriff verweigert oder nicht verfügbar.')
    }
  }

  function handleClose() {
    stop()
    onClose()
  }

  return (
    <div className="modal-overlay open scanner-modal" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <h3>Barcode scannen</h3>
        <video ref={videoRef} autoPlay muted playsInline className="scanner-video" />
        <p className="scanner-hint">Halte den Barcode in die Kamera</p>
        <p className="scanner-status">{status}</p>
        <div className="modal-btns">
          <button className="btn" onClick={handleClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}
