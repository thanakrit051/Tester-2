// Modals for AssignCheck Pro
const { useState: useState_m, useMemo: useMemo_m, useEffect: useEffect_m } = React;

// ─────────────────────────────────────────────────────────────
// CHECK SUBMISSIONS — the core grading view
// ─────────────────────────────────────────────────────────────
function ModalCheck({ assignId, state, setState, onClose, showToast }) {
  const a = assignId ? state.assignments.find((x) => x.id === assignId) : null;
  const cls = a ? state.classes.find((c) => c.id === a.classId) : null;
  const [query, setQuery] = useState_m('');
  const [showOnlyUnchecked, setShowOnlyUnchecked] = useState_m(false);

  const stu = cls ? (cls.students || []) : [];
  const sub = (assignId && state.submissions[assignId]) || {};

  const s = useMemo_m(() => {
    let done=0, late=0, miss=0;
    Object.values(sub).forEach((v) => {
      if (v.status === 'done') done++;
      else if (v.status === 'late') late++;
      else if (v.status === 'miss') miss++;
    });
    return { done, late, miss, total: stu.length, unchecked: stu.length - (done + late + miss) };
  }, [sub, stu.length]);

  const visible = useMemo_m(() => {
    let list = stu;
    if (query) list = list.filter((st) => st.name.includes(query) || st.num.includes(query) || (st.studentId && st.studentId.includes(query)));
    if (showOnlyUnchecked) list = list.filter((st) => !(sub[st.num] && sub[st.num].status));
    return list;
  }, [stu, sub, query, showOnlyUnchecked]);

  const setStatus = (num, status) => {
    setState((prev) => {
      const subs = { ...prev.submissions };
      const cur = { ...(subs[assignId] || {}) };
      const existing = cur[num] || {};
      if (existing.status === status) {
        cur[num] = { ...existing, status: null };
      } else {
        cur[num] = { ...existing, status };
      }
      subs[assignId] = cur;
      return { ...prev, submissions: subs };
    });
  };

  const setScore = (num, val) => {
    setState((prev) => {
      const subs = { ...prev.submissions };
      const cur = { ...(subs[assignId] || {}) };
      const existing = cur[num] || {};
      cur[num] = { ...existing, score: val === '' ? null : Number(val) };
      subs[assignId] = cur;
      return { ...prev, submissions: subs };
    });
  };

  const markAll = (status) => {
    setState((prev) => {
      const subs = { ...prev.submissions };
      const cur = { ...(subs[assignId] || {}) };
      stu.forEach((st) => { cur[st.num] = { ...(cur[st.num] || {}), status }; });
      subs[assignId] = cur;
      return { ...prev, submissions: subs };
    });
    showToast('ทำเครื่องหมาย "' + STATUS_LABEL_FULL[status] + '" ทุกคน', 'ok');
  };

  const fillRemainingMiss = () => {
    setState((prev) => {
      const subs = { ...prev.submissions };
      const cur = { ...(subs[assignId] || {}) };
      stu.forEach((st) => {
        const ex = cur[st.num] || {};
        if (!ex.status) cur[st.num] = { ...ex, status: 'miss' };
      });
      subs[assignId] = cur;
      return { ...prev, submissions: subs };
    });
    showToast('ที่ยังไม่เช็ค → ไม่ส่ง', 'warn');
  };

  if (!a || !cls) return null;
  const pct = s.total ? Math.round(((s.done + s.late) / s.total) * 100) : 0;

  return (
    <Sheet
      open={!!assignId}
      onClose={onClose}
      title={a.title}
      subtitle={cls.subject + ' ' + cls.grade + ' · กำหนดส่ง ' + fmtDateFull(a.due) + ' · คะแนนเต็ม ' + a.maxScore}
      size="lg"
    >
      {/* Stats strip */}
      <div className="check-stats">
        <div className="check-stat">
          <div className="check-stat-n tnum tone-ok">{s.done}</div>
          <div className="check-stat-l">ส่ง</div>
        </div>
        <div className="check-stat">
          <div className="check-stat-n tnum tone-warn">{s.late}</div>
          <div className="check-stat-l">ช้า</div>
        </div>
        <div className="check-stat">
          <div className="check-stat-n tnum tone-err">{s.miss}</div>
          <div className="check-stat-l">ไม่ส่ง</div>
        </div>
        <div className="check-stat">
          <div className="check-stat-n tnum">{s.unchecked}</div>
          <div className="check-stat-l">รอเช็ค</div>
        </div>
      </div>
      <div className="check-progress">
        <div className="bar"><div className={'bar-fill bar-' + (pct >= 80 ? 'g' : pct >= 50 ? 'y' : 'r')} style={{ width: pct + '%' }}/></div>
        <div className="check-progress-pct tnum">{pct}%</div>
      </div>

      {/* Quick actions */}
      <div className="check-actions">
        <button className="btn btn-ok btn-sm" onClick={() => markAll('done')}><Icon name="check-mark" size={13}/> ส่งทุกคน</button>
        <button className="btn btn-warn btn-sm" onClick={fillRemainingMiss}>รอ → ไม่ส่ง</button>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          setState((prev) => {
            const subs = { ...prev.submissions }; subs[assignId] = {};
            return { ...prev, submissions: subs };
          });
          showToast('ล้างทั้งหมด', 'info');
        }}>ล้าง</button>
      </div>

      {/* Search & filter */}
      <div className="check-filter">
        <div className="check-search">
          <Icon name="search" size={13}/>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ เลขที่ หรือรหัส..." />
        </div>
        <button className={'chip' + (showOnlyUnchecked ? ' chip-on' : '')} onClick={() => setShowOnlyUnchecked((v) => !v)}>
          เฉพาะรอเช็ค <span className="tnum">{s.unchecked}</span>
        </button>
      </div>

      {/* Student rows */}
      <div className="check-list">
        {visible.length === 0 && <div className="empty-block-sm">ไม่พบ</div>}
        {visible.map((st) => {
          const cur = sub[st.num] || {};
          return (
            <div key={st.num} className="check-row">
              <div className="check-row-top">
                <div className="check-row-num tnum">{st.num}</div>
                <div className="check-row-info">
                  <div className="check-row-name">{st.name}</div>
                  {st.studentId && <div className="check-row-id tnum">{st.studentId}</div>}
                </div>
              </div>
              <div className="check-row-actions">
                <div className="stat-toggle">
                  {['done', 'late', 'miss'].map((x) => (
                    <button
                      key={x}
                      className={'stat-tog stat-tog-' + x + (cur.status === x ? ' on' : '')}
                      onClick={() => setStatus(st.num, x)}
                    >
                      {STATUS_LABEL[x]}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  className={'score-inp tnum' + (cur.score != null ? ' has-val' : '')}
                  value={cur.score != null ? cur.score : ''}
                  onChange={(e) => setScore(st.num, e.target.value)}
                  min="0"
                  max={a.maxScore}
                  placeholder="—"
                />
                <div className="score-max tnum">/{a.maxScore}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// NEW / EDIT CLASS
// ─────────────────────────────────────────────────────────────
const ICON_OPTS = ['📐','📊','📝','🔬','🌍','📖','🎨','⚽','💻','🎵','📋','🧪'];

function ModalClass({ open, editingId, state, setState, onClose, showToast }) {
  const edit = editingId ? state.classes.find((c) => c.id === editingId) : null;
  const [subject, setSubject] = useState_m('');
  const [grade, setGrade] = useState_m('');
  const [year, setYear] = useState_m('2568');
  const [icon, setIcon] = useState_m('📐');

  useEffect_m(() => {
    if (open) {
      setSubject(edit?.subject || '');
      setGrade(edit?.grade || '');
      setYear(edit?.year || '2568');
      setIcon(edit?.icon || '📐');
    }
  }, [open, editingId]);

  const save = () => {
    if (!subject.trim() || !grade.trim()) { showToast('กรอกวิชาและห้องให้ครบ', 'err'); return; }
    setState((prev) => {
      const classes = prev.classes.slice();
      if (editingId) {
        const i = classes.findIndex((c) => c.id === editingId);
        if (i >= 0) classes[i] = { ...classes[i], subject, grade, year, icon };
      } else {
        classes.push({ id: uid(), subject, grade, year, icon, students: [] });
      }
      return { ...prev, classes };
    });
    showToast(editingId ? 'บันทึกแล้ว' : 'สร้างห้องเรียนแล้ว', 'ok');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editingId ? 'แก้ไขห้องเรียน' : 'สร้างห้องเรียน'}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={save}>บันทึก</button>
        </React.Fragment>
      }
    >
      <div className="form-grid form-grid-2">
        <Field label="วิชา"><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="คณิตศาสตร์"/></Field>
        <Field label="ชั้น/ห้อง"><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="ม.3/2"/></Field>
        <Field label="ปีการศึกษา"><input value={year} onChange={(e) => setYear(e.target.value)}/></Field>
        <Field label="ไอคอน">
          <div className="icon-picker">
            {ICON_OPTS.map((ic) => (
              <button key={ic} className={'icon-pick' + (icon === ic ? ' icon-pick-on' : '')} onClick={() => setIcon(ic)}>{ic}</button>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <div className="field-label">{label}</div>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// ROSTER (Student list)
// ─────────────────────────────────────────────────────────────
function ModalRoster({ classId, state, setState, onClose, onDelete, showToast }) {
  const cls = classId ? state.classes.find((c) => c.id === classId) : null;
  const [name, setName] = useState_m('');
  const [stuId, setStuId] = useState_m('');
  const [pendingImport, setPendingImport] = useState_m([]);
  const [dragOver, setDragOver] = useState_m(false);
  const fileInputRef = React.useRef(null);
  // Bulk ID import
  const [showIdImport, setShowIdImport] = useState_m(false);
  const [idText, setIdText] = useState_m('');
  const [idPreview, setIdPreview] = useState_m(null);
  const idFileRef = React.useRef(null);
  const stu = cls ? (cls.students || []) : [];

  // Reset state on close/open
  useEffect_m(() => {
    if (!classId) { setName(''); setStuId(''); setPendingImport([]); setDragOver(false); setShowIdImport(false); setIdText(''); setIdPreview(null); }
  }, [classId]);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    setState((prev) => {
      const classes = prev.classes.map((c) => {
        if (c.id !== classId) return c;
        const students = (c.students || []).slice();
        const entry = { num: pad2(students.length + 1), name: n };
        if (stuId.trim()) entry.studentId = stuId.trim();
        students.push(entry);
        return { ...c, students };
      });
      return { ...prev, classes };
    });
    setName('');
    setStuId('');
  };

  const remove = (num) => {
    setState((prev) => {
      const classes = prev.classes.map((c) => {
        if (c.id !== classId) return c;
        let students = (c.students || []).filter((s) => s.num !== num);
        students = students.map((s, i) => ({ ...s, num: pad2(i + 1) }));
        return { ...c, students };
      });
      return { ...prev, classes };
    });
  };

  // ── Bulk student ID import ──────────────────────────────
  const parseIdInput = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const map = {};
    const idPat = /^\d{4,8}$/;
    const numPat = /^\d{1,3}$/;
    lines.forEach((l, idx) => {
      const parts = l.split(/[,\t]/).map(p => p.trim());
      if (parts.length >= 2 && numPat.test(parts[0]) && idPat.test(parts[1])) {
        // รูปแบบ: เลขที่,รหัส
        map[parts[0].padStart(2, '0')] = parts[1];
      } else if (parts.length === 1 && idPat.test(parts[0])) {
        // รูปแบบ: รหัสเรียงตามลำดับ
        map[String(idx + 1).padStart(2, '0')] = parts[0];
      }
    });
    if (!Object.keys(map).length) return null;
    const entries = stu
      .filter(s => map[s.num])
      .map(s => ({ num: s.num, name: s.name, newId: map[s.num] }));
    return entries.length ? { map, entries } : null;
  };

  const doParseIds = () => {
    const result = parseIdInput(idText);
    if (!result) { showToast('ไม่พบรหัสที่ถูกต้อง ตรวจสอบรูปแบบอีกครั้ง', 'err'); return; }
    setIdPreview(result);
  };

  const parseIdFromFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result || '';
      setIdText(text);
      const result = parseIdInput(text);
      if (!result) { showToast('ไม่พบรหัสในไฟล์', 'err'); return; }
      setIdPreview(result);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const confirmIds = () => {
    if (!idPreview) return;
    setState((prev) => {
      const classes = prev.classes.map((c) => {
        if (c.id !== classId) return c;
        const students = (c.students || []).map((s) => {
          const newId = idPreview.map[s.num];
          return newId ? { ...s, studentId: newId } : s;
        });
        return { ...c, students };
      });
      return { ...prev, classes };
    });
    showToast('อัพเดต ' + idPreview.entries.length + ' รหัสแล้ว', 'ok');
    setIdPreview(null); setShowIdImport(false); setIdText('');
  };
  // ────────────────────────────────────────────────────────

  const parseFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result || '';
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const studentIdPat = /^\d{4,8}$/;
      const rowNumPat = /^\d{1,3}$/;
      const items = lines.map((l) => {
        const parts = l.split(',').map((p) => p.trim());
        if (parts.length >= 3 && rowNumPat.test(parts[0]) && studentIdPat.test(parts[1])) {
          // รูปแบบ: เลขที่,รหัสนักเรียน,ชื่อ
          return { studentId: parts[1], name: parts.slice(2).join(',').trim() };
        }
        if (parts.length >= 2 && rowNumPat.test(parts[0])) {
          // รูปแบบ: เลขที่,ชื่อ
          return { name: parts.slice(1).join(',').trim() };
        }
        if (parts.length >= 2 && studentIdPat.test(parts[0])) {
          // รูปแบบ: รหัสนักเรียน,ชื่อ
          return { studentId: parts[0], name: parts.slice(1).join(',').trim() };
        }
        return { name: l.trim() };
      }).filter((item) => item.name);
      if (!items.length) { showToast('ไฟล์ว่างหรืออ่านไม่ได้', 'err'); return; }
      setPendingImport(items);
    };
    reader.onerror = () => showToast('อ่านไฟล์ไม่สำเร็จ', 'err');
    reader.readAsText(file, 'UTF-8');
  };

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    parseFile(f);
    // Reset so picking the same file again still fires
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    parseFile(f);
  };

  const confirmImport = () => {
    if (!pendingImport.length) return;
    setState((prev) => {
      const classes = prev.classes.map((c) => {
        if (c.id !== classId) return c;
        const students = (c.students || []).slice();
        pendingImport.forEach((item) => {
          const entry = { num: pad2(students.length + 1), name: item.name };
          if (item.studentId) entry.studentId = item.studentId;
          students.push(entry);
        });
        return { ...c, students };
      });
      return { ...prev, classes };
    });
    showToast('นำเข้า ' + pendingImport.length + ' รายชื่อแล้ว', 'ok');
    setPendingImport([]);
  };

  if (!cls) return null;

  return (
    <Sheet
      open={!!classId}
      onClose={onClose}
      title={cls.subject + ' ' + cls.grade}
      subtitle={'รายชื่อนักเรียน · ' + stu.length + ' คน'}
      size="lg"
      footer={
        <React.Fragment>
          <button className="btn btn-danger-ghost" onClick={() => onDelete(classId)}><Icon name="trash" size={13}/> ลบห้อง</button>
          <button className="btn btn-primary" onClick={onClose}>เสร็จสิ้น</button>
        </React.Fragment>
      }
    >
      <div className="roster-add">
        <input
          value={stuId}
          onChange={(e) => setStuId(e.target.value)}
          placeholder="รหัส"
          className="roster-add-id"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="พิมพ์ชื่อ-นามสกุล แล้วกด Enter"
          className="roster-add-input"
        />
        <button className="btn btn-primary btn-sm" onClick={add}>เพิ่ม</button>
      </div>

      {pendingImport.length > 0 ? (
        <div className="import-preview">
          <div className="import-preview-head">
            <Icon name="check-mark" size={14}/>
            <span>พบ <span className="tnum">{pendingImport.length}</span> รายชื่อ</span>
            <button className="iconbtn iconbtn-sm" onClick={() => setPendingImport([])} aria-label="ยกเลิก"><Icon name="x" size={13}/></button>
          </div>
          <div className="import-preview-list">
            {pendingImport.slice(0, 8).map((item, i) => (
              <div key={i} className="import-preview-row">
                <span className="import-preview-num tnum">{pad2(stu.length + i + 1)}</span>
                {item.studentId && <span className="import-preview-id tnum">{item.studentId}</span>}
                <span>{item.name}</span>
              </div>
            ))}
            {pendingImport.length > 8 && (
              <div className="import-preview-more">…และอีก {pendingImport.length - 8} คน</div>
            )}
          </div>
          <div className="import-preview-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setPendingImport([])}>ยกเลิก</button>
            <button className="btn btn-primary btn-sm" onClick={confirmImport}><Icon name="check-mark" size={13}/> ยืนยันการนำเข้า</button>
          </div>
        </div>
      ) : (
        <div
          className={'import-strip' + (dragOver ? ' import-strip-drag' : '')}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <Icon name="upload" size={14}/>
          <span>นำเข้าจากไฟล์ (.txt/.csv) — รองรับ: ชื่อ · เลขที่,ชื่อ · รหัส,ชื่อ · เลขที่,รหัส,ชื่อ</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* ── Bulk ID Import ── */}
      {showIdImport ? (
        <div className="id-section">
          <div className="id-section-head">
            <span>เพิ่มรหัสประจำตัวเป็นชุด</span>
            <button className="iconbtn iconbtn-sm" onClick={() => { setShowIdImport(false); setIdText(''); setIdPreview(null); }}>
              <Icon name="x" size={12}/>
            </button>
          </div>
          <div className="id-section-hint">
            วาง <strong>รหัสประจำตัว</strong> 1 รหัสต่อบรรทัด (ตามลำดับเลขที่) หรือรูปแบบ <code>เลขที่,รหัส</code>
          </div>
          {!idPreview ? (
            <React.Fragment>
              <textarea
                className="id-paste"
                value={idText}
                onChange={(e) => setIdText(e.target.value)}
                placeholder={'61475\n61476\n61477\n…\nหรือ\n01,61475\n02,61476'}
                rows={6}
              />
              <div className="id-section-foot">
                <button className="btn btn-ghost btn-sm" onClick={() => idFileRef.current && idFileRef.current.click()}>
                  <Icon name="upload" size={13}/> เลือกไฟล์
                </button>
                <button className="btn btn-primary btn-sm" onClick={doParseIds} disabled={!idText.trim()}>
                  ดูตัวอย่าง
                </button>
                <input ref={idFileRef} type="file" accept=".txt,.csv" onChange={(e) => { parseIdFromFile(e.target.files && e.target.files[0]); e.target.value = ''; }} style={{ display: 'none' }}/>
              </div>
            </React.Fragment>
          ) : (
            <div className="id-preview">
              <div className="id-preview-head">
                จับคู่ได้ <span className="tnum">{idPreview.entries.length}</span> จาก <span className="tnum">{stu.length}</span> คน
              </div>
              <div className="id-preview-list">
                {idPreview.entries.slice(0, 8).map((e) => (
                  <div key={e.num} className="id-preview-row">
                    <span className="id-preview-num tnum">{e.num}</span>
                    <span className="id-preview-name">{e.name}</span>
                    <span className="id-preview-arrow">→</span>
                    <span className="id-preview-id tnum">{e.newId}</span>
                  </div>
                ))}
                {idPreview.entries.length > 8 && (
                  <div className="id-preview-more">…และอีก {idPreview.entries.length - 8} คน</div>
                )}
              </div>
              <div className="id-preview-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setIdPreview(null)}>แก้ไข</button>
                <button className="btn btn-primary btn-sm" onClick={confirmIds}>
                  <Icon name="check-mark" size={13}/> ยืนยัน {idPreview.entries.length} รหัส
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button className="id-toggle-btn" onClick={() => setShowIdImport(true)}>
          <Icon name="upload" size={13}/>
          <span>เพิ่มรหัสประจำตัวเป็นชุด</span>
          <Icon name="chev-r" size={12}/>
        </button>
      )}

      <div className="roster-list">
        {stu.length === 0 && <div className="empty-block-sm">ยังไม่มีนักเรียน</div>}
        {stu.map((s) => (
          <div key={s.num} className="roster-row">
            <div className="roster-num tnum">{s.num}</div>
            <div className="roster-info">
              <div className="roster-name">{s.name}</div>
              {s.studentId && <div className="roster-id tnum">{s.studentId}</div>}
            </div>
            <button className="iconbtn iconbtn-danger" onClick={() => remove(s.num)}><Icon name="x" size={14}/></button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// NEW / EDIT ASSIGNMENT
// ─────────────────────────────────────────────────────────────
function ModalAssign({ open, editingId, defaultClassId, state, setState, onClose, onDelete, showToast }) {
  const edit = editingId ? state.assignments.find((a) => a.id === editingId) : null;
  const [classId, setClassId] = useState_m('');
  const [title, setTitle] = useState_m('');
  const [due, setDue] = useState_m('');
  const [maxScore, setMaxScore] = useState_m('10');
  const [desc, setDesc] = useState_m('');

  useEffect_m(() => {
    if (open) {
      setClassId(edit?.classId || defaultClassId || state.classes[0]?.id || '');
      setTitle(edit?.title || '');
      setDue(edit?.due || new Date(TODAY).toISOString().slice(0, 10));
      setMaxScore(String(edit?.maxScore ?? 10));
      setDesc(edit?.desc || '');
    }
  }, [open, editingId]);

  const save = () => {
    if (!classId || !title.trim() || !due) { showToast('กรอกข้อมูลให้ครบ', 'err'); return; }
    setState((prev) => {
      const assigns = prev.assignments.slice();
      if (editingId) {
        const i = assigns.findIndex((a) => a.id === editingId);
        if (i >= 0) assigns[i] = { ...assigns[i], classId, title, due, maxScore: Number(maxScore) || 0, desc };
      } else {
        assigns.push({ id: uid(), classId, title, due, maxScore: Number(maxScore) || 0, desc, createdAt: new Date().toISOString().slice(0, 10) });
      }
      return { ...prev, assignments: assigns };
    });
    showToast(editingId ? 'บันทึกแล้ว' : 'สั่งงานแล้ว', 'ok');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editingId ? 'แก้ไขงาน' : 'สั่งงานใหม่'}
      footer={
        <React.Fragment>
          {editingId && onDelete && (
            <button className="btn btn-danger-ghost" onClick={() => onDelete(editingId)}>
              <Icon name="trash" size={13}/> ลบงาน
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={save}>บันทึก</button>
        </React.Fragment>
      }
    >
      <div className="form-grid">
        <Field label="ห้องเรียน">
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">-- เลือก --</option>
            {state.classes.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.subject} {c.grade}</option>)}
          </select>
        </Field>
        <Field label="ชื่องาน">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น แบบฝึกหัดบทที่ 4"/>
        </Field>
        <div className="form-grid-2">
          <Field label="กำหนดส่ง"><input type="date" value={due} onChange={(e) => setDue(e.target.value)}/></Field>
          <Field label="คะแนนเต็ม"><input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} min="0"/></Field>
        </div>
        <Field label="คำอธิบาย (ไม่บังคับ)">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="รายละเอียดงาน หรือหมายเหตุ..." rows="3"/>
        </Field>
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// STUDENT REPORT
// ─────────────────────────────────────────────────────────────
function ModalStuReport({ open, classId, num, state, onClose, openCheck }) {
  if (!open) return null;
  const cls = state.classes.find((c) => c.id === classId);
  const stu = cls?.students.find((x) => x.num === num);
  const assigns = useMemo_m(() =>
    state.assignments.filter((a) => a.classId === classId).sort((a, b) => (a.due > b.due ? 1 : -1)),
    [state.assignments, classId]
  );
  if (!cls || !stu) return null;

  let done=0, late=0, miss=0, scoreSum=0, maxSum=0, scoreCnt=0;
  assigns.forEach((a) => {
    const sub = (state.submissions[a.id] || {})[num] || {};
    if (sub.status === 'done') done++;
    else if (sub.status === 'late') late++;
    else if (sub.status === 'miss') miss++;
    if (sub.score != null) { scoreSum += sub.score; maxSum += a.maxScore; scoreCnt++; }
  });
  const submitted = done + late;
  const pct = assigns.length ? Math.round((submitted / assigns.length) * 100) : 0;
  const avgPct = maxSum > 0 ? Math.round((scoreSum / maxSum) * 100) : 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={stu.name}
      subtitle={'เลขที่ ' + stu.num + (stu.studentId ? ' · รหัส ' + stu.studentId : '') + ' · ' + cls.subject + ' ' + cls.grade}
      size="lg"
    >
      <div className="stu-rpt-head">
        <div className="stu-rpt-block">
          <div className="stu-rpt-eyebrow">อัตราการส่ง</div>
          <div className={'stu-rpt-big tnum tone-' + (pct >= 80 ? 'ok' : pct >= 60 ? 'warn' : 'err')}>{pct}<span>%</span></div>
          <div className="stu-rpt-foot tnum">{submitted}/{assigns.length} ชิ้น</div>
        </div>
        <div className="stu-rpt-block">
          <div className="stu-rpt-eyebrow">คะแนนเฉลี่ย</div>
          <div className={'stu-rpt-big tnum tone-' + (avgPct >= 80 ? 'ok' : avgPct >= 60 ? 'warn' : 'err')}>{scoreCnt > 0 ? avgPct : '—'}<span>%</span></div>
          <div className="stu-rpt-foot tnum">{scoreSum}/{maxSum} คะแนน</div>
        </div>
      </div>

      <div className="stu-rpt-stats">
        <div className="stat tone-ok"><div className="stat-n tnum">{done}</div><div className="stat-l">ส่ง</div></div>
        <div className="stat tone-warn"><div className="stat-n tnum">{late}</div><div className="stat-l">ช้า</div></div>
        <div className="stat tone-err"><div className="stat-n tnum">{miss}</div><div className="stat-l">ไม่ส่ง</div></div>
      </div>

      <SectionLabel>งานทั้งหมดของห้อง</SectionLabel>
      <div className="stu-rpt-list">
        {assigns.map((a) => {
          const sub = (state.submissions[a.id] || {})[num] || {};
          return (
            <button key={a.id} className="stu-rpt-row" onClick={() => { onClose(); setTimeout(() => openCheck(a.id), 200); }}>
              <div className="stu-rpt-row-left">
                <div className="stu-rpt-row-title">{a.title}</div>
                <div className="stu-rpt-row-meta tnum"><Icon name="calendar" size={10}/> {fmtDate(a.due)}</div>
              </div>
              <div className="stu-rpt-row-right">
                <StatusPill status={sub.status}/>
                <div className="stu-rpt-row-score tnum">
                  {sub.score != null ? sub.score : '—'}<span className="muted">/{a.maxScore}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// ACCOUNT
// ─────────────────────────────────────────────────────────────
function ModalAccount({ open, state, onClose, onLogout, mockMode, setMockMode, syncStatus }) {
  return (
    <Sheet open={open} onClose={onClose} title="บัญชีของคุณ">
      <div className="acc-card">
        {state.me.photo
          ? <img className="acc-avatar acc-avatar-img" src={state.me.photo} alt=""/>
          : <div className="acc-avatar">{state.me.initial}</div>}
        <div className="acc-info">
          <div className="acc-name">{state.me.name}</div>
          <div className="acc-email">{state.me.email}</div>
          {state.me.role && <div className="acc-role">{state.me.role}</div>}
        </div>
      </div>

      <SectionLabel>การจัดเก็บข้อมูล</SectionLabel>
      <div className="acc-storage">
        <div className="acc-storage-row">
          <div className="acc-storage-dot"/>
          <div>
            <div className="acc-storage-title">ซิงค์กับ Firebase</div>
            <div className="acc-storage-sub">ข้อมูลถูกเก็บแยกตาม Google Account · เข้าได้จากทุกอุปกรณ์</div>
          </div>
        </div>
        <div className="acc-storage-meta tnum">{syncStatus || 'พร้อมใช้งาน'}</div>
      </div>

      {setMockMode && (
        <React.Fragment>
          <SectionLabel>ข้อมูลตัวอย่าง</SectionLabel>
          <div className="seg seg-wide">
            <button className={'seg-btn' + (mockMode === 'full' ? ' seg-on' : '')} onClick={() => setMockMode('full')}>ข้อมูลจริง</button>
            <button className={'seg-btn' + (mockMode === 'empty' ? ' seg-on' : '')} onClick={() => setMockMode('empty')}>ห้องว่าง</button>
          </div>
        </React.Fragment>
      )}

      <div className="acc-actions">
        <button className="btn btn-danger-ghost btn-block" onClick={onLogout}><Icon name="logout" size={14}/> ออกจากระบบ</button>
      </div>
    </Sheet>
  );
}

Object.assign(window, {
  ModalCheck, ModalClass, ModalRoster, ModalAssign, ModalStuReport, ModalAccount, Field,
});
