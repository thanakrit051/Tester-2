// Shared UI primitives & helpers for AssignCheck Pro
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ── Helpers ─────────────────────────────────────────────────
const TODAY = new Date();
const pad2 = (n) => String(n).padStart(2, '0');
const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const TH_MONTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_DAY = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() + ' ' + TH_MONTH[d.getMonth()];
}
function fmtDateFull(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() + ' ' + TH_MONTH_FULL[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
function daysFromToday(iso) {
  const t = new Date(TODAY); t.setHours(0,0,0,0);
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d - t) / 86400000);
}
function dueLabel(iso) {
  const dd = daysFromToday(iso);
  if (dd === 0) return 'ครบกำหนดวันนี้';
  if (dd === 1) return 'พรุ่งนี้';
  if (dd === -1) return 'เกินกำหนด 1 วัน';
  if (dd < 0) return 'เกินกำหนด ' + Math.abs(dd) + ' วัน';
  return 'อีก ' + dd + ' วัน';
}
function dueTone(iso) {
  const dd = daysFromToday(iso);
  if (dd < 0) return 'r';
  if (dd <= 3) return 'y';
  return 'g';
}

const STATUS_LABEL = { done: 'ส่ง', late: 'ช้า', miss: 'ไม่ส่ง' };
const STATUS_LABEL_FULL = { done: 'ส่งแล้ว', late: 'ส่งช้า', miss: 'ไม่ส่ง' };

function statsForAssign(a, classes, submissions) {
  const cls = classes.find((c) => c.id === a.classId);
  const stu = cls ? (cls.students || []) : [];
  const sub = submissions[a.id] || {};
  let done=0, late=0, miss=0;
  Object.values(sub).forEach((v) => {
    if (v.status === 'done') done++;
    else if (v.status === 'late') late++;
    else if (v.status === 'miss') miss++;
  });
  const total = stu.length;
  const checked = done + late + miss;
  return { total, done, late, miss, unchecked: total - checked, checked, cls };
}

// ── Icons (1.5px stroke, square cap) ───────────────────────
function Icon({ name, size = 16, stroke = 1.6 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...props}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>;
    case 'class': return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9h18M8 5v14"/></svg>;
    case 'check': return <svg {...props}><path d="M9 11l3 3 7-7"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
    case 'chart': return <svg {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>;
    case 'plus': return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'x': return <svg {...props}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case 'edit': return <svg {...props}><path d="M14 4l6 6L9 21H3v-6L14 4z"/></svg>;
    case 'trash': return <svg {...props}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>;
    case 'chev-r': return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chev-d': return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'filter': return <svg {...props}><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case 'calendar': return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'alert': return <svg {...props}><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.8 2.5 18a2 2 0 0 0 1.7 3h15.5a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/></svg>;
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'user': return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>;
    case 'users': return <svg {...props}><circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5.5-5-6.5"/></svg>;
    case 'logout': return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
    case 'check-mark': return <svg {...props}><path d="M5 12l5 5L20 7"/></svg>;
    case 'download': return <svg {...props}><path d="M12 4v12M7 11l5 5 5-5M4 21h16"/></svg>;
    case 'upload': return <svg {...props}><path d="M12 20V8M7 13l5-5 5 5M4 21h16"/></svg>;
    case 'sparkle': return <svg {...props}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>;
    case 'dot': return <svg {...props}><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
    case 'arrow-r': return <svg {...props}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'gear': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.5-2.4.9a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.5 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.5 2.4-.9a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.5-2-1.6c0-.4.1-.8.1-1.2z"/></svg>;
    default: return null;
  }
}

// ── Status pill ─────────────────────────────────────────────
function StatusPill({ status }) {
  if (!status) return <span className="pill pill-neutral">—</span>;
  return <span className={'pill pill-' + status}>{STATUS_LABEL_FULL[status]}</span>;
}

// ── Section header ──────────────────────────────────────────
function SectionLabel({ children, action }) {
  return (
    <div className="sect-label">
      <span>{children}</span>
      {action}
    </div>
  );
}

// ── Stat box (dense, monospace numbers) ─────────────────────
function StatBox({ n, label, tone = 'ink' }) {
  return (
    <div className={'stat tone-' + tone}>
      <div className="stat-n tnum">{n}</div>
      <div className="stat-l">{label}</div>
    </div>
  );
}

// ── Tap row (list row with chevron) ─────────────────────────
function TapRow({ children, onClick, right, dense }) {
  return (
    <div className={'tap-row' + (dense ? ' dense' : '')} onClick={onClick}>
      <div className="tap-row-body">{children}</div>
      {right}
    </div>
  );
}

// ── Sheet modal ─────────────────────────────────────────────
function Sheet({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  if (!open) return null;
  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'sheet sheet-' + size}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="sheet-sub">{subtitle}</div>}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="ปิด"><Icon name="x" size={18}/></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ── Custom Select (replaces native <select>) ────────────────
function CustomSelect({ value, onChange, options, placeholder = 'เลือก...' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={'csel' + (open ? ' csel-open' : '')} ref={ref}>
      <button
        type="button"
        className="csel-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="csel-label">{selected ? selected.label : placeholder}</span>
        <span className={'csel-arrow' + (open ? ' csel-arrow-up' : '')}><Icon name="chev-d" size={15}/></span>
      </button>
      {open && (
        <div className="csel-menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={value === o.value}
              className={'csel-opt' + (value === o.value ? ' csel-opt-on' : '')}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <span>{o.label}</span>
              {value === o.value && <Icon name="check-mark" size={14}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toast ───────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState(null);
  const t = useRef();
  const show = useCallback((text, tone = 'info') => {
    setMsg({ text, tone, key: Date.now() });
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 2200);
  }, []);
  const node = msg ? <div key={msg.key} className={'toast toast-' + msg.tone}>{msg.text}</div> : null;
  return [show, node];
}

Object.assign(window, {
  fmtDate, fmtDateFull, daysFromToday, dueLabel, dueTone,
  statsForAssign, STATUS_LABEL, STATUS_LABEL_FULL,
  Icon, StatusPill, SectionLabel, StatBox, TapRow, Sheet, useToast, CustomSelect,
  pad2, uid, TODAY, TH_MONTH, TH_MONTH_FULL, TH_DAY,
});
