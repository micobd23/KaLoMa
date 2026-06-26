import { useEffect, useRef, useState } from 'react'

interface Props {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)
  const [status, setStatus] = useState('Kamera wird gestartet…')

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
    const ZXing = (window as any).ZXing
    if (!ZXing) { setStatus('Scanner-Bibliothek nicht geladen. Bitte Seite neu laden.'); return }
    try {
      const hints = new Map()
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.UPC_A,
      ])
      const reader = new ZXing.BrowserMultiFormatReader(hints)
      readerRef.current = reader
      setStatus('Barcode in die Kamera halten…')
      await reader.decodeFromVideoDevice(null, videoRef.current, (result: any) => {
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
