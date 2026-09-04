// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyABv4bIS3H8wj7zoy5aZPtskfSLljJyGOw",
    authDomain: "assigncheck-pro-6e559.firebaseapp.com",
    projectId: "assigncheck-pro-6e559",
    storageBucket: "assigncheck-pro-6e559.firebasestorage.app",
    messagingSenderId: "855085128789",
    appId: "1:855085128789:web:b7693a44082e617f6448dc",
    measurementId: "G-Y1VSW0DBLM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const dbFirestore = firebase.firestore();

// DOM Elements
const loginSection = document.getElementById('loginSection');
const tasksSection = document.getElementById('tasksSection');
const studentIdInput = document.getElementById('studentIdInput');
const searchSuggestion = document.getElementById('searchSuggestion');
const checkButton = document.getElementById('checkButton');
const logoutButton = document.getElementById('logoutButton');
const displayStudentName = document.getElementById('displayStudentName');
const displayStudentId = document.getElementById('displayStudentId');
const tasksList = document.getElementById('tasksList');
const summaryBar = document.getElementById('summaryBar');
const loginErrorMsg = document.getElementById('loginErrorMsg');

let globalData = null;
let allStudentsMap = {}; // { studentId: { name, num, classes: [{ classId, classInfo }] } }
let selectedStudentId = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);
studentIdInput.addEventListener('input', handleStudentIdInput);
studentIdInput.addEventListener('keydown', handleInputKeydown);
checkButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', handleLogout);

// ปิด suggestion เมื่อคลิกที่อื่น
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-wrapper')) {
        searchSuggestion.style.display = 'none';
    }
});

async function initializeApp() {
    try {
        studentIdInput.placeholder = 'กำลังโหลดข้อมูล...';

        const docRef = dbFirestore.collection('assigncheck_users').doc('TyggIsu3ZTZgyUt7xYlNhzbn4X23');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            globalData = docSnap.data();
            console.log("Firebase Data Loaded:", globalData);

            loginErrorMsg.style.display = 'none';

            if (globalData.classes && globalData.classes.length > 0) {
                buildStudentsMap(globalData.classes);
                studentIdInput.disabled = false;
                studentIdInput.placeholder = 'กรอกรหัสประจำตัว เช่น 12345';
            } else {
                showSchemaDebugger('ไม่พบโครงสร้าง classes ในข้อมูล');
            }
        } else {
            showError('ไม่พบข้อมูล Document TyggIsu3ZTZgyUt7xYlNhzbn4X23');
        }
    } catch (error) {
        console.error("Firebase error", error);
        showError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message);
    }
}

/**
 * สร้าง map ของนักเรียนทุกคนจากทุกห้อง
 * key = studentId (รหัสประจำตัว)
 * value = { name, num, classes: [{ classId, className, grade }] }
 */
function buildStudentsMap(classesArr) {
    allStudentsMap = {};

    classesArr.forEach(cls => {
        const students = Array.isArray(cls.students) ? cls.students : Object.values(cls.students || {});
        const className = cls.subject || cls.name || 'ไม่ทราบวิชา';
        const grade = cls.grade || '';

        students.forEach(student => {
            const sid = String(student.studentId || student.id || student.num || '');
            if (!sid) return;

            if (!allStudentsMap[sid]) {
                allStudentsMap[sid] = {
                    name: student.name || student.fullname || 'ไม่มีชื่อ',
                    num: student.num || student.no || student.number || '',
                    studentId: sid,
                    classes: []
                };
            }

            allStudentsMap[sid].classes.push({
                classId: cls.id,
                className: className,
                grade: grade,
                studentNum: student.num || student.no || student.number || sid
            });
        });
    });

    console.log("Students Map Built:", Object.keys(allStudentsMap).length, "unique students");
}

function showSchemaDebugger(msg) {
    loginErrorMsg.style.display = 'block';
    loginErrorMsg.style.backgroundColor = '#e0f2fe';
    loginErrorMsg.style.color = '#0369a1';
    loginErrorMsg.style.textAlign = 'left';
    loginErrorMsg.style.fontSize = '12px';

    const debugInfo = {
        classes_example: globalData && globalData.classes
            ? (Array.isArray(globalData.classes) ? globalData.classes[0] : Object.values(globalData.classes)[0])
            : null,
        submissions_example: globalData && globalData.submissions
            ? (Array.isArray(globalData.submissions) ? globalData.submissions[0] : Object.values(globalData.submissions)[0])
            : null,
        top_level_keys: globalData ? Object.keys(globalData) : []
    };

    loginErrorMsg.innerHTML = `
        <strong>${msg || 'ระบบต้องการทราบโครงสร้างข้อมูลเพิ่มเติม'}</strong> รบกวนแคปจอนี้ให้ AI ดูครับ:<br>
        <pre style="white-space: pre-wrap; overflow-x: auto; margin-top: 10px;">${JSON.stringify(debugInfo, null, 2)}</pre>
    `;
}

function handleStudentIdInput() {
    const query = studentIdInput.value.trim();
    selectedStudentId = null;
    checkButton.disabled = true;

    if (!query) {
        searchSuggestion.style.display = 'none';
        return;
    }

    // ค้นหาจาก studentId ที่ตรงหรือ contains query
    const matchedIds = Object.keys(allStudentsMap).filter(sid => sid.includes(query));

    if (matchedIds.length === 0) {
        searchSuggestion.innerHTML = `
            <div class="suggestion-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                ไม่พบรหัสประจำตัวนี้
            </div>
        `;
        searchSuggestion.style.display = 'block';
        return;
    }

    // สร้าง suggestion items
    let html = '';
    matchedIds.slice(0, 10).forEach(sid => {
        const info = allStudentsMap[sid];
        const classCount = info.classes.length;
        const classNames = info.classes.map(c => c.className).join(', ');
        
        html += `
            <div class="suggestion-item" onclick="selectSuggestion('${escapeAttr(sid)}')">
                <div class="suggestion-info">
                    <span class="suggestion-id">${highlightMatch(sid, query)}</span>
                    <span class="suggestion-name">${info.name}</span>
                    <span class="suggestion-classes">${classCount} วิชา: ${classNames}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
        `;
    });

    if (matchedIds.length > 10) {
        html += `<div class="suggestion-more">...อีก ${matchedIds.length - 10} รายการ</div>`;
    }

    searchSuggestion.innerHTML = html;
    searchSuggestion.style.display = 'block';
}

function highlightMatch(text, query) {
    const idx = text.indexOf(query);
    if (idx === -1) return text;
    return text.slice(0, idx) + '<mark>' + text.slice(idx, idx + query.length) + '</mark>' + text.slice(idx + query.length);
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function handleInputKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        // ถ้ายังไม่ได้เลือก ลอง exact match
        if (!selectedStudentId) {
            const query = studentIdInput.value.trim();
            if (allStudentsMap[query]) {
                selectedStudentId = query;
                studentIdInput.value = query;
                searchSuggestion.style.display = 'none';
                checkButton.disabled = false;
            }
        }
        if (!checkButton.disabled) {
            handleLogin();
        }
    }
}

// ฟังก์ชันเลือก suggestion
window.selectSuggestion = function(sid) {
    if (!allStudentsMap[sid]) return;

    selectedStudentId = sid;
    studentIdInput.value = sid;
    searchSuggestion.style.display = 'none';
    checkButton.disabled = false;

    // เพิ่ม animation ให้ปุ่มค้นหา
    checkButton.classList.add('btn-pulse');
    setTimeout(() => checkButton.classList.remove('btn-pulse'), 600);
};

function handleLogin() {
    // ถ้ายังไม่ได้เลือกจาก suggestion, ลอง exact match
    if (!selectedStudentId) {
        const query = studentIdInput.value.trim();
        if (!query) return;

        if (!allStudentsMap[query]) {
            showError('ไม่พบรหัสประจำตัว "' + query + '" ในระบบ');
            return;
        }
        selectedStudentId = query;
    }

    const studentInfo = allStudentsMap[selectedStudentId];
    if (!studentInfo) return;

    loginErrorMsg.style.display = 'none';
    searchSuggestion.style.display = 'none';

    loginSection.style.display = 'none';
    tasksSection.style.display = 'block';
    displayStudentName.textContent = studentInfo.name;
    displayStudentId.textContent = selectedStudentId;

    fetchAllSubjectTasks(selectedStudentId, studentInfo);
}

function handleLogout() {
    studentIdInput.value = '';
    checkButton.disabled = true;
    selectedStudentId = null;

    tasksSection.style.display = 'none';
    loginSection.style.display = 'block';
    loginErrorMsg.style.display = 'none';
    searchSuggestion.style.display = 'none';
    summaryBar.innerHTML = '';
    tasksList.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
        </div>
    `;

    studentIdInput.focus();
}

function showError(msg) {
    loginErrorMsg.textContent = msg;
    loginErrorMsg.style.backgroundColor = '';
    loginErrorMsg.style.color = '';
    loginErrorMsg.style.textAlign = '';
    loginErrorMsg.style.fontSize = '';
    loginErrorMsg.style.display = 'block';
}

/**
 * ดึงงานจากทุกวิชาที่นักเรียนคนนี้อยู่ แล้วจัดกลุ่มแสดงแยกตามวิชา
 */
function fetchAllSubjectTasks(studentId, studentInfo) {
    tasksList.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>กำลังโหลดงานทุกวิชาของคุณ...</p>
        </div>
    `;

    const allAssignments = Array.isArray(globalData.assignments)
        ? globalData.assignments
        : Object.values(globalData.assignments || {});

    const submissionsMap = globalData.submissions || {};

    // จัดกลุ่มงานตามห้อง/วิชา
    const subjectGroups = [];
    let totalDone = 0;
    let totalPending = 0;
    let totalLate = 0;
    let totalMissing = 0;

    studentInfo.classes.forEach(classEntry => {
        const { classId, className, grade, studentNum } = classEntry;

        // หางานที่เกี่ยวกับห้องนี้
        const classAssignments = allAssignments.filter(a => {
            if (Array.isArray(a.classId)) return a.classId.includes(classId);
            return a.classId === classId;
        });

        const tasks = classAssignments.map(assignment => {
            const assignmentSubs = submissionsMap[assignment.id] || {};
            const submission = assignmentSubs[studentNum];

            let status = 'missing';
            if (submission && submission.status) {
                status = submission.status;
            }

            // นับสถิติ
            const s = (status || '').toLowerCase();
            if (s === 'done' || s === 'checked' || s === 'graded' || s === 'เสร็จสิ้น') totalDone++;
            else if (s === 'late') totalLate++;
            else if (s === 'pending' || s === 'submitted') totalPending++;
            else totalMissing++;

            return {
                title: assignment.title || assignment.name,
                subject: assignment.desc || assignment.description,
                status: status,
                due: assignment.due || assignment.dueDate
            };
        });

        subjectGroups.push({
            className: className,
            grade: grade,
            classId: classId,
            tasks: tasks
        });
    });

    // แสดง summary bar
    renderSummary(totalDone, totalPending, totalLate, totalMissing);

    // แสดงงานแยกตามวิชา
    renderGroupedTasks(subjectGroups);
}

function renderSummary(done, pending, late, missing) {
    const total = done + pending + late + missing;
    summaryBar.innerHTML = `
        <div class="summary-item summary-total">
            <span class="summary-count">${total}</span>
            <span class="summary-label">งานทั้งหมด</span>
        </div>
        <div class="summary-item summary-done">
            <span class="summary-count">${done}</span>
            <span class="summary-label">ส่งแล้ว</span>
        </div>
        <div class="summary-item summary-pending-stat">
            <span class="summary-count">${pending}</span>
            <span class="summary-label">รอตรวจ</span>
        </div>
        <div class="summary-item summary-late-stat">
            <span class="summary-count">${late}</span>
            <span class="summary-label">ส่งช้า</span>
        </div>
        <div class="summary-item summary-missing-stat">
            <span class="summary-count">${missing}</span>
            <span class="summary-label">ยังไม่ส่ง</span>
        </div>
    `;
}

function renderGroupedTasks(subjectGroups) {
    if (subjectGroups.length === 0) {
        tasksList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">ไม่พบวิชาที่ลงทะเบียน</p>';
        return;
    }

    let html = '';
    // สี gradient สำหรับแต่ละวิชา
    const subjectColors = [
        { accent: '#4f46e5', bg: 'rgba(79, 70, 229, 0.08)', border: 'rgba(79, 70, 229, 0.2)' },
        { accent: '#0891b2', bg: 'rgba(8, 145, 178, 0.08)', border: 'rgba(8, 145, 178, 0.2)' },
        { accent: '#d946ef', bg: 'rgba(217, 70, 239, 0.08)', border: 'rgba(217, 70, 239, 0.2)' },
        { accent: '#ea580c', bg: 'rgba(234, 88, 12, 0.08)', border: 'rgba(234, 88, 12, 0.2)' },
        { accent: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)', border: 'rgba(22, 163, 74, 0.2)' },
        { accent: '#ca8a04', bg: 'rgba(202, 138, 4, 0.08)', border: 'rgba(202, 138, 4, 0.2)' },
    ];

    subjectGroups.forEach((group, groupIdx) => {
        const color = subjectColors[groupIdx % subjectColors.length];
        const gradeText = group.grade ? ` ม.${group.grade}` : '';
        const doneCount = group.tasks.filter(t => {
            const s = (t.status || '').toLowerCase();
            return s === 'done' || s === 'checked' || s === 'graded' || s === 'เสร็จสิ้น';
        }).length;

        html += `
            <div class="subject-group" style="--subject-accent: ${color.accent}; --subject-bg: ${color.bg}; --subject-border: ${color.border};">
                <div class="subject-header" onclick="this.parentElement.classList.toggle('collapsed')">
                    <div class="subject-title-area">
                        <div class="subject-dot" style="background: ${color.accent};"></div>
                        <div>
                            <h3 class="subject-title">${group.className}${gradeText}</h3>
                            <span class="subject-meta">${doneCount}/${group.tasks.length} ชิ้น ส่งแล้ว</span>
                        </div>
                    </div>
                    <svg class="subject-chevron" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="subject-tasks">
        `;

        if (group.tasks.length === 0) {
            html += '<p class="no-tasks-msg">ยังไม่มีงานในวิชานี้</p>';
        } else {
            group.tasks.forEach(task => {
                let statusClass = '';
                let statusText = '';

                const s = (task.status || '').toLowerCase();
                if (s === 'done' || s === 'checked' || s === 'graded' || s === 'เสร็จสิ้น') {
                    statusClass = 'status-done';
                    statusText = 'ส่งแล้ว';
                } else if (s === 'late') {
                    statusClass = 'status-late';
                    statusText = 'ส่งช้า';
                } else if (s === 'pending' || s === 'submitted') {
                    statusClass = 'status-pending';
                    statusText = 'รอตรวจ';
                } else {
                    statusClass = 'status-missing';
                    statusText = 'ยังไม่ส่ง';
                }

                const dueText = task.due
                    ? `<small class="task-due">กำหนดส่ง: ${task.due}</small>`
                    : '';

                html += `
                    <div class="task-item">
                        <div class="task-details">
                            <h4>${task.title || 'ไม่มีชื่องาน'}</h4>
                            <p>${task.subject || 'ไม่มีรายละเอียด'}</p>
                            ${dueText}
                        </div>
                        <div class="task-status ${statusClass}">
                            ${statusText}
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;
    });

    tasksList.innerHTML = html;
}
