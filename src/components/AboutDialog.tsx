interface Props {
  onClose: () => void
}

export default function AboutDialog({ onClose }: Props) {
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="about-badge">K</div>
        <div className="about-name">KaLoMa 4.60</div>
        <div className="about-tagline">Der kleine Kalorien- &amp; Makromanager</div>
        <div className="about-meta">
          React · TypeScript · Supabase<br />
          Nährwerte via Open Food Facts
        </div>
        <div className="modal-btns">
          <button className="btn btn-primary" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  )
}
