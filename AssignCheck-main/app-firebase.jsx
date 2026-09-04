// ═════════════════════════════════════════════════════════════
//  AssignCheck Pro — Production app with Firebase
// ═════════════════════════════════════════════════════════════
const { useState: useS, useEffect: useE, useMemo: useM, useCallback: useC, useRef: useR } = React;

// ── Firebase config (USER'S OWN PROJECT) ──────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyABv4bIS3H8wj7zoy5aZPtskfSLljJyGOw",
  authDomain:        "assigncheck-pro-6e559.firebaseapp.com",
  projectId:         "assigncheck-pro-6e559",
  storageBucket:     "assigncheck-pro-6e559.firebasestorage.app",
  messagingSenderId: "855085128789",
  appId:             "1:855085128789:web:b7693a44082e617f6448dc",
  measurementId:     "G-Y1VSW0DBLM",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ═════════════════════════════════════════════════════════════
// SPLASH
// ═════════════════════════════════════════════════════════════
function Splash() {
  return (
    <div className="splash">
      <div className="splash-mark">A<span className="splash-tick">✓</span></div>
      <div className="splash-title">AssignCheck Pro</div>
      <div className="splash-sub">ระบบเช็คงานและจัดการห้องเรียน</div>
      <div className="splash-spin"/>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════════
function Login({ onGoogle, busy, error }) {
  return (
    <div className="login-stage">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark login-brand-mark">A<span className="brand-tick">✓</span></div>
          <div>
            <div className="login-brand-name">AssignCheck Pro</div>
            <div className="login-brand-sub">เครื่องมือเช็คงานสำหรับครู</div>
          </div>
        </div>

        <h1 className="login-title">เข้าสู่ระบบเพื่อเริ่มใช้งาน</h1>
        <p className="login-desc">
          ข้อมูลห้องเรียน รายชื่อนักเรียน และการเช็คงานทั้งหมดของคุณ จะถูกซิงค์อย่างปลอดภัยกับ Google Account
          และเข้าถึงได้จากทุกอุปกรณ์
        </p>

        {error && <div className="login-err">{error}</div>}

        <button className="login-google" disabled={busy} onClick={onGoogle}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
        </button>

        <div className="login-features">
          <div className="login-feat"><span className="login-feat-dot"/> สั่งงาน เช็คการส่ง บันทึกคะแนน</div>
          <div className="login-feat"><span className="login-feat-dot"/> รายงานสรุปรายห้องและรายคน</div>
          <div className="login-feat"><span className="login-feat-dot"/> ส่งออกข้อมูลเป็น CSV</div>
        </div>

        <div className="login-foot">
          เข้าสู่ระบบหมายถึงคุณยอมรับเงื่อนไขการใช้งาน · ข้อมูลของคุณจะถูกเก็บแยกตาม Google Account
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN APP (after sign-in)
// ═════════════════════════════════════════════════════════════
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "theme": "warm"
}/*EDITMODE-END*/;

const THEME_COLOR = { warm: '#fff8f3', cool: '#f2f6ff', forest: '#f2f7f3' };

const EMPTY_STATE = { classes: [], assignments: [], submissions: {} };

function AppInner({ me, onLogout }) {
  const [tweak, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useE(() => { document.documentElement.setAttribute('data-density', tweak.density); }, [tweak.density]);
  useE(() => {
    document.documentElement.setAttribute('data-theme', tweak.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[tweak.theme] || THEME_COLOR.warm);
  }, [tweak.theme]);

  // ── Data state ─────────────────────────────────────────────
  const [state, setState] = useS({ me, ...EMPTY_STATE });
  const [loading, setLoading] = useS(true);
  const [syncStatus, setSyncStatus] = useS('กำลังโหลด...');

  // Load on mount
  useE(() => {
    let cancelled = false;
    db.collection('assigncheck_users').doc(me.uid).get().then((doc) => {
      if (cancelled) return;
      if (doc.exists) {
        const d = doc.data();
        setState({ me, classes: d.classes || [], assignments: d.assignments || [], submissions: d.submissions || {} });
      } else {
        // Create empty doc
        db.collection('assigncheck_users').doc(me.uid).set(EMPTY_STATE);
        setState({ me, ...EMPTY_STATE });
      }
      setLoading(false);
      setSyncStatus('ซิงค์ล่าสุด ' + nowTime());
    }).catch((e) => {
      console.error('Load failed', e);
      if (cancelled) return;
      setLoading(false);
      setSyncStatus('โหลดไม่สำเร็จ');
      showToast('โหลดข้อมูลไม่สำเร็จ — โปรดเช็ค Firestore Rules', 'err');
    });
    return () => { cancelled = true; };
  }, [me.uid]);

  // Debounced save
  const saveTimer = useR(null);
  const [saving, setSaving] = useS(false);
  const skipFirstSaveRef = useR(true);
  useE(() => {
    if (loading) return;
    if (skipFirstSaveRef.current) { skipFirstSaveRef.current = false; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      db.collection('assigncheck_users').doc(me.uid).set({
        classes: state.classes,
        assignments: state.assignments,
        submissions: state.submissions,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).then(() => {
        setSaving(false);
        setSyncStatus('ซิงค์ล่าสุด ' + nowTime());
      }).catch((e) => {
        console.error('Save failed', e);
        setSaving(false);
        setSyncStatus('บันทึกไม่สำเร็จ');
        showToast('บันทึกไม่สำเร็จ', 'err');
      });
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [state.classes, state.assignments, state.submissions, loading, me.uid]);

  // ── Nav & modals ────────────────────────────────────────────
  const [tab, setTab] = useS('home');
  const [checkId, setCheckId] = useS(null);
  const [clsModal, setClsModal] = useS({ open: false, editId: null });
  const [rosterId, setRosterId] = useS(null);
  const [assignModal, setAssignModal] = useS({ open: false, editId: null, defaultClassId: null });
  const [stuReport, setStuReport] = useS({ open: false, cid: null, num: null });
  const [accOpen, setAccOpen] = useS(false);

  const [classFilter, setClassFilter] = useS('');
  const [statusFilter, setStatusFilter] = useS('');

  const [showToastFn, toastNode] = useToast();
  const showToast = showToastFn;

  // ── Handlers ───────────────────────────────────────────────
  const openCheck = (id) => setCheckId(id);
  const openNewCls = () => setClsModal({ open: true, editId: null });
  const openEditCls = (id) => setClsModal({ open: true, editId: id });
  const openRoster = (id) => setRosterId(id);
  const openNewAssign = () => setAssignModal({ open: true, editId: null, defaultClassId: classFilter || null });
  const openEditAssign = (id) => setAssignModal({ open: true, editId: id, defaultClassId: null });
  const openStuReport = (cid, num) => setStuReport({ open: true, cid, num });

  const deleteClass = (id) => {
    if (!confirm('ลบห้องเรียนนี้และงานทั้งหมดของห้อง? การกระทำนี้ย้อนกลับไม่ได้')) return;
    setState((p) => ({
      ...p,
      classes: p.classes.filter((c) => c.id !== id),
      assignments: p.assignments.filter((a) => a.classId !== id),
    }));
    setRosterId(null);
    showToast('ลบห้องเรียนแล้ว', 'warn');
  };

  const deleteAssign = (id) => {
    const a = state.assignments.find((x) => x.id === id);
    if (!a) return;
    if (!confirm('ลบงาน "' + a.title + '" และข้อมูลการเช็คทั้งหมดของงานนี้? การกระทำนี้ย้อนกลับไม่ได้')) return;
    setState((p) => {
      const subs = { ...p.submissions };
      delete subs[id];
      return {
        ...p,
        assignments: p.assignments.filter((x) => x.id !== id),
        submissions: subs,
      };
    });
    setAssignModal({ open: false, editId: null, defaultClassId: null });
    showToast('ลบงานแล้ว', 'warn');
  };
  const handleExport = (cid) => {
    const cls = state.classes.find((c) => c.id === cid);
    if (!cls) return;
    const stu = cls.students || [];
    const assigns = state.assignments.filter((a) => a.classId === cid).sort((a, b) => (a.due > b.due ? 1 : -1));
    const header = ['เลขที่', 'ชื่อ-นามสกุล'];
    assigns.forEach((a) => { header.push(a.title + ' (สถานะ)'); header.push(a.title + ' (คะแนน)'); });
    header.push('ส่งแล้ว', 'ส่งช้า', 'ไม่ส่ง', 'คะแนนรวม');
    const rows = [header];
    stu.forEach((s) => {
      const row = [s.num, s.name];
      let done=0, late=0, miss=0, total=0;
      assigns.forEach((a) => {
        const sub = (state.submissions[a.id] || {})[s.num] || {};
        const st = sub.status || '';
        row.push(st === 'done' ? 'ส่งแล้ว' : st === 'late' ? 'ส่งช้า' : st === 'miss' ? 'ไม่ส่ง' : '-');
        row.push(sub.score != null ? sub.score : '');
        if (st === 'done') done++;
        else if (st === 'late') late++;
        else if (st === 'miss') miss++;
        if (sub.score != null) total += sub.score;
      });
      rows.push(row.concat([done, late, miss, total]));
    });
    const csv = rows.map((r) => r.map((v) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `assigncheck_${cls.subject}_${cls.grade}_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Export CSV สำเร็จ', 'ok');
  };

  // Overdue badge
  const overdueCount = useM(() =>
    state.assignments.filter((a) => {
      const dd = daysFromToday(a.due);
      if (dd >= 0) return false;
      const s = statsForAssign(a, state.classes, state.submissions);
      return s.unchecked > 0;
    }).length, [state]);

  const TABS = [
    { id: 'home',    label: 'วันนี้',    icon: 'home'  },
    { id: 'classes', label: 'ห้องเรียน', icon: 'class' },
    { id: 'assign',  label: 'งาน',       icon: 'check', badge: overdueCount },
    { id: 'report',  label: 'รายงาน',    icon: 'chart' },
  ];

  if (loading) return <Splash/>;

  return (
    <React.Fragment>
      <div className="acp-app">

        {/* ── Sidebar — desktop only ──────────────────────── */}
        <nav className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-mark">A<span className="brand-tick">✓</span></div>
            <div className="brand-text">
              <div className="brand-name">AssignCheck Pro</div>
              <div className="brand-sub">{me.role}</div>
            </div>
          </div>
          <div className="sidebar-nav">
            {TABS.map((t) => (
              <button key={t.id} className={'sidebar-tab' + (tab === t.id ? ' sidebar-tab-on' : '')} onClick={() => setTab(t.id)}>
                <div className="tab-icon">
                  <Icon name={t.icon} size={19} stroke={tab === t.id ? 1.9 : 1.5}/>
                  {t.badge > 0 && <span className="tab-badge tnum">{t.badge}</span>}
                </div>
                <span className="sidebar-tab-label">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-foot">
            {saving && <div className="save-chip save-chip-full"><span className="save-dot"/> กำลังบันทึก...</div>}
            <button className="sidebar-user" onClick={() => setAccOpen(true)}>
              {me.photo
                ? <img className="user-avatar user-avatar-img" src={me.photo} alt=""/>
                : <div className="user-avatar">{me.initial}</div>}
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{me.name}</div>
                <div className="sidebar-user-role">{me.role}</div>
              </div>
            </button>
          </div>
        </nav>

        {/* ── Mobile app bar ──────────────────────────────── */}
        <header className="appbar">
          <div className="appbar-brand">
            <div className="brand-mark">A<span className="brand-tick">✓</span></div>
            <div className="brand-text">
              <div className="brand-name">AssignCheck</div>
              <div className="brand-sub">{me.name}</div>
            </div>
          </div>
          <div className="appbar-right">
            {saving && <div className="save-chip"><span className="save-dot"/> บันทึก</div>}
            <button className="user-chip" onClick={() => setAccOpen(true)}>
              {me.photo
                ? <img className="user-avatar user-avatar-img" src={me.photo} alt=""/>
                : <div className="user-avatar">{me.initial}</div>}
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="appbody">
          {tab === 'home'    && <ScreenHome state={state} openCheck={openCheck} goto={setTab}/>}
          {tab === 'classes' && <ScreenClasses state={state} openNewCls={openNewCls} openRoster={openRoster} openEditCls={openEditCls}/>}
          {tab === 'assign'  && <ScreenAssign state={state} openNewAssign={openNewAssign} openCheck={openCheck} openEditAssign={openEditAssign} classFilter={classFilter} setClassFilter={setClassFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}/>}
          {tab === 'report'  && <ScreenReport state={state} openStuReport={openStuReport} showToast={showToast} onExport={handleExport}/>}
        </main>

        {/* Tab bar */}
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={'tab' + (tab === t.id ? ' tab-on' : '')} onClick={() => setTab(t.id)}>
              <div className="tab-icon">
                <Icon name={t.icon} size={20} stroke={tab === t.id ? 1.9 : 1.5}/>
                {t.badge > 0 && <span className="tab-badge tnum">{t.badge}</span>}
              </div>
              <div className="tab-label">{t.label}</div>
            </button>
          ))}
        </nav>

        {toastNode}
      </div>

      {/* Modals */}
      <ModalCheck assignId={checkId} state={state} setState={setState} onClose={() => setCheckId(null)} showToast={showToast}/>
      <ModalClass open={clsModal.open} editingId={clsModal.editId} state={state} setState={setState} onClose={() => setClsModal({ open: false, editId: null })} showToast={showToast}/>
      <ModalRoster classId={rosterId} state={state} setState={setState} onClose={() => setRosterId(null)} onDelete={deleteClass} showToast={showToast}/>
      <ModalAssign open={assignModal.open} editingId={assignModal.editId} defaultClassId={assignModal.defaultClassId} state={state} setState={setState} onClose={() => setAssignModal({ open: false, editId: null, defaultClassId: null })} onDelete={deleteAssign} showToast={showToast}/>
      <ModalStuReport open={stuReport.open} classId={stuReport.cid} num={stuReport.num} state={state} onClose={() => setStuReport({ open: false, cid: null, num: null })} openCheck={openCheck}/>
      <ModalAccount open={accOpen} state={state} onClose={() => setAccOpen(false)} onLogout={() => { setAccOpen(false); onLogout(); }} syncStatus={syncStatus}/>

      <TweaksPanel title="Tweaks">
        <TweakSection title="ธีม" subtitle="เลือกโทนสีของแอป">
          <TweakRadio label="Theme" value={tweak.theme} onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'warm',   label: 'Warm Sunset' },
              { value: 'cool',   label: 'Cool Ocean'  },
              { value: 'forest', label: 'Forest'      },
            ]}/>
        </TweakSection>
        <TweakSection title="ความหนาแน่น" subtitle="ปรับขนาดและระยะห่างของแถวข้อมูล">
          <TweakRadio label="Density" value={tweak.density} onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'compact', label: 'แน่น' },
              { value: 'cozy',    label: 'ปกติ' },
              { value: 'roomy',   label: 'โปร่ง' },
            ]}/>
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

// ── nowTime helper ─────────────────────────────────────────
function nowTime() {
  const d = new Date();
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// ═════════════════════════════════════════════════════════════
// ROOT — auth gate
// ═════════════════════════════════════════════════════════════
function Root() {
  const [me, setMe] = useS(null);
  const [authReady, setAuthReady] = useS(false);
  const [signingIn, setSigningIn] = useS(false);
  const [error, setError] = useS('');

  useE(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        const name = user.displayName || (user.email || '').split('@')[0] || 'ผู้ใช้';
        const initial = name.trim().substring(0, 2).toUpperCase();
        setMe({
          uid: user.uid,
          email: user.email || '',
          name,
          initial,
          photo: user.photoURL || null,
          role: 'ครู',
        });
      } else {
        setMe(null);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const signIn = () => {
    setSigningIn(true);
    setError('');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithPopup(provider).catch((e) => {
      setSigningIn(false);
      setError(translateAuthError(e));
    });
  };

  const signOut = () => {
    auth.signOut().catch(() => {});
  };

  if (!authReady) return <Splash/>;
  if (!me) return <Login onGoogle={signIn} busy={signingIn} error={error}/>;
  return <AppInner me={me} onLogout={signOut}/>;
}

function translateAuthError(e) {
  const code = e?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'คุณปิดหน้าต่างก่อนเข้าสู่ระบบสำเร็จ';
  if (code === 'auth/popup-blocked')        return 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัพ — โปรดอนุญาตและลองอีกครั้ง';
  if (code === 'auth/network-request-failed') return 'การเชื่อมต่อขัดข้อง โปรดตรวจสอบอินเทอร์เน็ต';
  if (code === 'auth/unauthorized-domain')  return 'โดเมนนี้ยังไม่ถูก authorize ใน Firebase Console';
  return e?.message || 'เข้าสู่ระบบไม่สำเร็จ';
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root/>);
