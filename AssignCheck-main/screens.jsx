// Screens for AssignCheck Pro
const { useState: useState_s, useMemo: useMemo_s, useEffect: useEffect_s } = React;

// ─────────────────────────────────────────────────────────────
// HOME — Today
// ─────────────────────────────────────────────────────────────
function ScreenHome({ state, openCheck, goto }) {
  const { classes, assignments, submissions } = state;
  const td = new Date(TODAY);
  const totalStats = useMemo_s(() => {
    let done = 0, late = 0, miss = 0;
    assignments.forEach((a) => {
      const sub = submissions[a.id] || {};
      Object.values(sub).forEach((v) => {
        if (v.status === 'done') done++;
        else if (v.status === 'late') late++;
        else if (v.status === 'miss') miss++;
      });
    });
    return { done, late, miss };
  }, [assignments, submissions]);

  const alerts = useMemo_s(() => {
    const out = [];
    assignments.forEach((a) => {
      const dd = daysFromToday(a.due);
      const s = statsForAssign(a, classes, submissions);
      if (dd < 0 && s.unchecked > 0) {
        out.push({ kind: 'over', a, dd, s });
      } else if (dd >= 0 && dd <= 3 && s.unchecked > 0) {
        out.push({ kind: 'soon', a, dd, s });
      }
    });
    // Overdue first, then soonest
    out.sort((x, y) => {
      if (x.kind !== y.kind) return x.kind === 'over' ? -1 : 1;
      return x.dd - y.dd;
    });
    return out.slice(0, 4);
  }, [assignments, submissions, classes]);

  const recent = useMemo_s(() => {
    return assignments.slice().sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 6);
  }, [assignments]);

  if (!classes.length) {
    return (
      <div className="screen-pad">
        <div className="hero-empty">
          <div className="hero-empty-eyebrow">เริ่มต้นใช้งาน</div>
          <h2>ยังไม่มีห้องเรียน</h2>
          <p>สร้างห้องเรียนแรกของคุณ แล้วเพิ่มรายชื่อนักเรียน — จากนั้นจึงสั่งงานและเช็คงานได้</p>
          <button className="btn btn-primary btn-block" onClick={() => goto('classes')}>
            <Icon name="plus" size={16}/> สร้างห้องเรียน
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-pad">
      {/* Date header */}
      <div className="home-date">
        <div className="home-date-eyebrow">วัน{TH_DAY[td.getDay()]} · {td.getDate()} {TH_MONTH_FULL[td.getMonth()]} {td.getFullYear() + 543}</div>
        <h1 className="home-greet">สวัสดี, {state.me.name.replace('อ.', '')}</h1>
        <div className="home-sub">{classes.length} ห้องเรียน · {assignments.length} งานกำลังดำเนินการ</div>
      </div>

      {/* Cumulative status */}
      <SectionLabel>สถานะการส่งงานรวม</SectionLabel>
      <div className="stat-row">
        <StatBox n={totalStats.done} label="ส่งแล้ว" tone="ok"/>
        <StatBox n={totalStats.late} label="ส่งช้า" tone="warn"/>
        <StatBox n={totalStats.miss} label="ไม่ส่ง" tone="err"/>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <React.Fragment>
          <SectionLabel>ต้องดำเนินการ</SectionLabel>
          <div className="alert-list">
            {alerts.map((al) => (
              <button key={al.a.id} className={'alert ' + (al.kind === 'over' ? 'alert-over' : 'alert-soon')} onClick={() => openCheck(al.a.id)}>
                <div className="alert-icon">
                  <Icon name={al.kind === 'over' ? 'alert' : 'clock'} size={18}/>
                </div>
                <div className="alert-body">
                  <div className="alert-title">{al.a.title}</div>
                  <div className="alert-meta">
                    {al.s.cls ? al.s.cls.subject + ' ' + al.s.cls.grade : ''} · {al.kind === 'over' ? `เกินกำหนด ${Math.abs(al.dd)} วัน` : (al.dd === 0 ? 'ครบกำหนดวันนี้' : `อีก ${al.dd} วัน`)} · ยังไม่เช็ค {al.s.unchecked}/{al.s.total}
                  </div>
                </div>
                <Icon name="chev-r" size={14}/>
              </button>
            ))}
          </div>
        </React.Fragment>
      )}

      {/* Recent assignments */}
      <SectionLabel action={<button className="link-btn" onClick={() => goto('assign')}>ดูทั้งหมด <Icon name="chev-r" size={12}/></button>}>งานล่าสุด</SectionLabel>
      <div className="assign-list">
        {recent.map((a) => <AssignRow key={a.id} a={a} state={state} onClick={() => openCheck(a.id)}/>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AssignRow — used in Home and Assign list
// ─────────────────────────────────────────────────────────────
function AssignRow({ a, state, onClick, showEdit, onEdit }) {
  const s = statsForAssign(a, state.classes, state.submissions);
  const dd = daysFromToday(a.due);
  const submitPct = s.total > 0 ? Math.round(((s.done + s.late) / s.total) * 100) : 0;
  const tone = dueTone(a.due);
  return (
    <button className="assign-row" onClick={onClick}>
      <div className="assign-row-head">
        <div className="assign-row-title-wrap">
          <div className="assign-row-title">{a.title}</div>
          <div className="assign-row-meta">{s.cls ? s.cls.subject + ' ' + s.cls.grade : '—'}</div>
        </div>
        <div className={'due-pill due-' + tone}>
          <Icon name="calendar" size={11}/>
          <span className="tnum">{fmtDate(a.due)}</span>
        </div>
      </div>
      <div className="assign-row-bar">
        <div className="bar">
          <div className={'bar-fill bar-' + (submitPct >= 80 ? 'g' : submitPct >= 50 ? 'y' : 'r')} style={{ width: submitPct + '%' }}/>
        </div>
        <div className="assign-row-pct tnum">{submitPct}%</div>
      </div>
      <div className="assign-row-foot">
        <span className="micro micro-g"><i className="dot dot-g"/>{s.done} ส่ง</span>
        <span className="micro micro-y"><i className="dot dot-y"/>{s.late} ช้า</span>
        <span className="micro micro-r"><i className="dot dot-r"/>{s.miss} ไม่ส่ง</span>
        <span className="micro micro-n"><i className="dot dot-n"/>{s.unchecked} รอ</span>
        {showEdit && (
          <span className="edit-handle" onClick={(e) => { e.stopPropagation(); onEdit(a.id); }}>
            <Icon name="edit" size={13}/>
          </span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// CLASSES
// ─────────────────────────────────────────────────────────────
function ScreenClasses({ state, openNewCls, openRoster, openEditCls }) {
  return (
    <div className="screen-pad">
      <div className="page-head">
        <div>
          <h1 className="page-title">ห้องเรียน</h1>
          <div className="page-sub">{state.classes.length} ห้องเรียน ปีการศึกษา 2568</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNewCls}>
          <Icon name="plus" size={14}/> เพิ่ม
        </button>
      </div>

      {state.classes.length === 0 && (
        <div className="empty-block">
          <div className="empty-icon"><Icon name="class" size={28}/></div>
          <p>ยังไม่มีห้องเรียน</p>
          <small>กด "เพิ่ม" เพื่อสร้างห้องแรก</small>
        </div>
      )}

      <div className="class-list">
        {state.classes.map((c) => {
          const aCount = state.assignments.filter((a) => a.classId === c.id).length;
          const stuCount = (c.students || []).length;
          return (
            <div key={c.id} className="class-card">
              <div className="class-card-icon">{c.icon || '📋'}</div>
              <div className="class-card-body" onClick={() => openRoster(c.id)}>
                <div className="class-card-title">{c.subject}</div>
                <div className="class-card-meta">{c.grade} · ปีการศึกษา {c.year}</div>
                <div className="class-card-stats">
                  <span className="micro micro-n"><Icon name="users" size={11}/> <span className="tnum">{stuCount}</span> คน</span>
                  <span className="micro micro-n"><Icon name="check" size={11}/> <span className="tnum">{aCount}</span> งาน</span>
                </div>
              </div>
              <button className="iconbtn class-card-edit" onClick={() => openEditCls(c.id)}><Icon name="edit" size={14}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ASSIGN — list + filter
// ─────────────────────────────────────────────────────────────
function ScreenAssign({ state, openNewAssign, openCheck, openEditAssign, classFilter, setClassFilter, statusFilter, setStatusFilter }) {
  const filtered = useMemo_s(() => {
    let list = state.assignments;
    if (classFilter) list = list.filter((a) => a.classId === classFilter);
    if (statusFilter === 'over') list = list.filter((a) => daysFromToday(a.due) < 0);
    if (statusFilter === 'soon') list = list.filter((a) => { const dd = daysFromToday(a.due); return dd >= 0 && dd <= 3; });
    if (statusFilter === 'future') list = list.filter((a) => daysFromToday(a.due) > 3);
    return list.slice().sort((a, b) => (a.due > b.due ? 1 : -1));
  }, [state.assignments, classFilter, statusFilter]);

  return (
    <div className="screen-pad">
      <div className="page-head">
        <div>
          <h1 className="page-title">งานที่สั่ง</h1>
          <div className="page-sub">{filtered.length} จาก {state.assignments.length} งาน</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNewAssign}>
          <Icon name="plus" size={14}/> สั่งงาน
        </button>
      </div>

      <div className="filter-row">
        <CustomSelect
          value={classFilter}
          onChange={setClassFilter}
          options={[
            { value: '', label: 'ทุกห้อง' },
            ...state.classes.map((c) => ({ value: c.id, label: c.subject + ' ' + c.grade }))
          ]}
        />
        <div className="seg">
          {[
            { v: '', l: 'ทั้งหมด' },
            { v: 'over', l: 'เลยกำหนด' },
            { v: 'soon', l: 'ใกล้ส่ง' },
            { v: 'future', l: 'อนาคต' },
          ].map((opt) => (
            <button key={opt.v} className={'seg-btn' + (statusFilter === opt.v ? ' seg-on' : '')} onClick={() => setStatusFilter(opt.v)}>{opt.l}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="empty-block">
          <div className="empty-icon"><Icon name="check" size={28}/></div>
          <p>ไม่มีงานตรงเงื่อนไข</p>
          <small>ลองเปลี่ยนตัวกรอง หรือสั่งงานใหม่</small>
        </div>
      )}

      <div className="assign-list">
        {filtered.map((a) => <AssignRow key={a.id} a={a} state={state} onClick={() => openCheck(a.id)} showEdit onEdit={openEditAssign}/>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────
function ScreenReport({ state, openStuReport, showToast, onExport }) {
  const [cid, setCid] = useState_s(state.classes[0]?.id || '');
  useEffect_s(() => {
    if (!cid && state.classes[0]) setCid(state.classes[0].id);
    if (cid && !state.classes.find((c) => c.id === cid)) setCid(state.classes[0]?.id || '');
  }, [state.classes]);

  const cls = state.classes.find((c) => c.id === cid);
  const assigns = useMemo_s(() => state.assignments.filter((a) => a.classId === cid).sort((a, b) => (a.due > b.due ? 1 : -1)), [state.assignments, cid]);

  const rows = useMemo_s(() => {
    if (!cls) return [];
    return (cls.students || []).map((s) => {
      let done = 0, late = 0, miss = 0, total = 0, scoreSum = 0, scoreCnt = 0, maxSum = 0;
      assigns.forEach((a) => {
        const sub = (state.submissions[a.id] || {})[s.num] || {};
        if (sub.status === 'done') done++;
        else if (sub.status === 'late') late++;
        else if (sub.status === 'miss') miss++;
        total++;
        if (sub.score != null) { scoreSum += sub.score; scoreCnt++; maxSum += a.maxScore; }
      });
      const submitted = done + late;
      const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
      return { s, done, late, miss, total, submitted, pct, scoreSum, scoreCnt, maxSum };
    });
  }, [cls, assigns, state.submissions]);

  const overall = useMemo_s(() => {
    let done = 0, late = 0, miss = 0, totalPossible = (cls?.students.length || 0) * assigns.length;
    rows.forEach((r) => { done += r.done; late += r.late; miss += r.miss; });
    const submitted = done + late;
    const pct = totalPossible > 0 ? Math.round((submitted / totalPossible) * 100) : 0;
    return { done, late, miss, pct, totalPossible };
  }, [rows, assigns, cls]);

  if (!cls) {
    return (
      <div className="screen-pad">
        <div className="page-head">
          <div><h1 className="page-title">รายงาน</h1><div className="page-sub">สรุปการส่งงานรายห้องและรายคน</div></div>
        </div>
        <div className="empty-block">
          <div className="empty-icon"><Icon name="chart" size={28}/></div>
          <p>ยังไม่มีห้องเรียน</p>
        </div>
      </div>
    );
  }

  const doExport = () => { if (onExport) onExport(cid); else showToast('Export CSV สำเร็จ', 'ok'); };

  return (
    <div className="screen-pad">
      <div className="page-head">
        <div><h1 className="page-title">รายงาน</h1><div className="page-sub">สรุปรายห้องและรายคน</div></div>
        <button className="btn btn-ghost btn-sm" onClick={doExport}><Icon name="download" size={14}/> CSV</button>
      </div>

      <div className="filter-row">
        <select className="filter-select filter-select-full" value={cid} onChange={(e) => setCid(e.target.value)}>
          {state.classes.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.subject} {c.grade}</option>)}
        </select>
      </div>

      <div className="report-overall">
        <div className="report-overall-head">
          <div>
            <div className="report-overall-eyebrow">อัตราการส่งงานทั้งห้อง</div>
            <div className="report-overall-name">{cls.subject} {cls.grade}</div>
          </div>
          <div className={'report-overall-pct tnum tone-' + (overall.pct >= 80 ? 'ok' : overall.pct >= 60 ? 'warn' : 'err')}>{overall.pct}<span>%</span></div>
        </div>
        <div className="bar bar-tall"><div className={'bar-fill bar-' + (overall.pct >= 80 ? 'g' : overall.pct >= 60 ? 'y' : 'r')} style={{ width: overall.pct + '%' }}/></div>
        <div className="report-overall-foot">
          <span><span className="tnum">{cls.students.length}</span> นักเรียน</span>
          <span><span className="tnum">{assigns.length}</span> งาน</span>
          <span><span className="tnum">{overall.done + overall.late}</span>/<span className="tnum">{overall.totalPossible}</span> การส่ง</span>
        </div>
      </div>

      <SectionLabel>นักเรียนทั้งห้อง · เรียงตามอัตราการส่ง</SectionLabel>
      <div className="report-rows">
        {rows.slice().sort((a, b) => a.pct - b.pct).map((r) => (
          <button key={r.s.num} className="report-row" onClick={() => openStuReport(cid, r.s.num)}>
            <div className="report-row-num tnum">{r.s.num}</div>
            <div className="report-row-mid">
              <div className="report-row-name">{r.s.name}</div>
              {r.s.studentId && <div className="report-row-id tnum">{r.s.studentId}</div>}
              <div className="report-row-meta">
                <span className="micro micro-g"><span className="tnum">{r.done}</span></span>
                <span className="micro-sep">/</span>
                <span className="micro micro-y"><span className="tnum">{r.late}</span></span>
                <span className="micro-sep">/</span>
                <span className="micro micro-r"><span className="tnum">{r.miss}</span></span>
                <span className="report-row-avg">เฉลี่ย <span className="tnum">{r.scoreCnt > 0 ? ((r.scoreSum / r.maxSum) * 100).toFixed(0) : '—'}</span>%</span>
              </div>
              <div className="bar bar-sm"><div className={'bar-fill bar-' + (r.pct >= 80 ? 'g' : r.pct >= 60 ? 'y' : 'r')} style={{ width: r.pct + '%' }}/></div>
            </div>
            <div className={'report-row-pct tnum tone-' + (r.pct >= 80 ? 'ok' : r.pct >= 60 ? 'warn' : 'err')}>{r.pct}%</div>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ScreenHome, ScreenClasses, ScreenAssign, ScreenReport, AssignRow });
