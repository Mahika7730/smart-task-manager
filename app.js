// Smart Task Manager - Core Application Logic

// ==========================================
// 1. Initial State & localStorage
// ==========================================
const DEFAULT_TASKS = [
  {
    id: 'demo-1',
    title: 'Review project requirements !high #work',
    text: 'Review project requirements',
    priority: 'high',
    category: 'work',
    dueDate: getRelativeDateString(0), // Today
    completed: false,
    focusSessions: 0
  },
  {
    id: 'demo-2',
    title: 'Plan weekend road trip #personal',
    text: 'Plan weekend road trip',
    priority: 'low',
    category: 'personal',
    dueDate: getRelativeDateString(6), // Next week
    completed: false,
    focusSessions: 0
  },
  {
    id: 'demo-3',
    title: 'Complete coding challenge !medium #learning tomorrow',
    text: 'Complete coding challenge',
    priority: 'medium',
    category: 'learning',
    dueDate: getRelativeDateString(1), // Tomorrow
    completed: true,
    focusSessions: 1
  }
];

const state = {
  tasks: JSON.parse(localStorage.getItem('smart_tasks')) || DEFAULT_TASKS,
  activeView: 'dashboard',
  filters: {
    status: 'all',
    category: 'all',
    search: '',
    sort: 'date-asc'
  },
  timer: {
    timeLeft: 1500, // 25 minutes
    totalDuration: 1500,
    status: 'idle', // 'idle' | 'running' | 'paused'
    mode: 'pomodoro', // 'pomodoro' | 'short' | 'long'
    activeTaskId: 'none',
    intervalId: null,
    sessionsCompleted: parseInt(localStorage.getItem('pomodoros_completed')) || 0,
    totalFocusTime: parseInt(localStorage.getItem('total_focus_time')) || 0 // in minutes
  },
  theme: localStorage.getItem('theme') || 'dark'
};

// ==========================================
// 2. Date Utilities
// ==========================================
function getRelativeDateString(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return 'No due date';
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const targetDate = new Date(dateStr);
  targetDate.setHours(0,0,0,0);
  
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return targetDate.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function updateDateHeader() {
  const dateEl = document.getElementById('current-date');
  const greetingEl = document.getElementById('greeting');
  
  const now = new Date();
  
  // Update Date
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  dateEl.textContent = now.toLocaleDateString('en-US', options);
  
  // Update Greeting
  const hour = now.getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  if (hour >= 17) greeting = 'Good evening';
  
  greetingEl.textContent = `${greeting}, Creator`;
}

// ==========================================
// 3. Audio Synth (Web Audio API)
// ==========================================
function playSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'complete') {
      // Satisfying task completion bell
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'timer-end') {
      // Dual tone Pomodoro alert
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.8);
      osc2.stop(ctx.currentTime + 0.8);
    }
  } catch (e) {
    console.error('AudioContext error:', e);
  }
}

// ==========================================
// 4. NLP Parser Engine
// ==========================================
function parseNLP(inputString) {
  const result = {
    cleanText: inputString,
    priority: 'none',
    category: 'inbox',
    dueDate: ''
  };
  
  if (!inputString) return result;
  
  // 1. Priority Parser (!high, !medium, !low)
  const priorityRegex = /!(high|medium|low)\b/i;
  const priorityMatch = inputString.match(priorityRegex);
  if (priorityMatch) {
    result.priority = priorityMatch[1].toLowerCase();
    result.cleanText = result.cleanText.replace(priorityRegex, '');
  }
  
  // 2. Category Parser (#work, #personal, #learning, #health, #inbox)
  const categoryRegex = /#(work|personal|learning|health|inbox)\b/i;
  const categoryMatch = inputString.match(categoryRegex);
  if (categoryMatch) {
    result.category = categoryMatch[1].toLowerCase();
    result.cleanText = result.cleanText.replace(categoryRegex, '');
  }
  
  // 3. Date Parser (today, tomorrow, next week, Monday-Sunday/Mon-Sun)
  let dateVal = '';
  const todayRegex = /\b(today)\b/i;
  const tomorrowRegex = /\b(tomorrow)\b/i;
  const nextWeekRegex = /\b(next\s+week)\b/i;
  const dayNameRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
  
  if (todayRegex.test(inputString)) {
    dateVal = getRelativeDateString(0);
    result.cleanText = result.cleanText.replace(todayRegex, '');
  } else if (tomorrowRegex.test(inputString)) {
    dateVal = getRelativeDateString(1);
    result.cleanText = result.cleanText.replace(tomorrowRegex, '');
  } else if (nextWeekRegex.test(inputString)) {
    dateVal = getRelativeDateString(7);
    result.cleanText = result.cleanText.replace(nextWeekRegex, '');
  } else {
    const dayMatch = inputString.match(dayNameRegex);
    if (dayMatch) {
      const dayName = dayMatch[1].toLowerCase();
      const daysOfWeek = {
        sun: 0, sunday: 0,
        mon: 1, monday: 1,
        tue: 2, tuesday: 2,
        wed: 3, wednesday: 3,
        thu: 4, thursday: 4,
        fri: 5, friday: 5,
        sat: 6, saturday: 6
      };
      
      const targetDay = daysOfWeek[dayName];
      const today = new Date();
      const currentDay = today.getDay();
      
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // Next week's occurrence
      
      dateVal = getRelativeDateString(daysToAdd);
      result.cleanText = result.cleanText.replace(dayNameRegex, '');
    }
  }
  
  result.dueDate = dateVal;
  
  // Clean double spaces and trim
  result.cleanText = result.cleanText.replace(/\s+/g, ' ').trim();
  
  return result;
}

// Update live badge previews
function updateNLPFeedback() {
  const inputVal = document.getElementById('task-input').value;
  const feedbackEl = document.getElementById('nlp-feedback');
  
  if (!inputVal.trim()) {
    feedbackEl.classList.add('hidden');
    return;
  }
  
  const parsed = parseNLP(inputVal);
  let hasFeedback = false;
  
  // Priority Badge
  const priorityBadge = document.getElementById('parsed-priority');
  if (parsed.priority !== 'none') {
    priorityBadge.className = `nlp-badge priority-${parsed.priority}`;
    priorityBadge.innerHTML = `<i data-lucide="alert-triangle"></i> ${parsed.priority}`;
    priorityBadge.classList.remove('hidden');
    hasFeedback = true;
  } else {
    priorityBadge.classList.add('hidden');
  }
  
  // Category Badge
  const categoryBadge = document.getElementById('parsed-category');
  if (parsed.category !== 'inbox') {
    categoryBadge.className = 'nlp-badge category';
    categoryBadge.innerHTML = `<i data-lucide="tag"></i> ${parsed.category}`;
    categoryBadge.classList.remove('hidden');
    hasFeedback = true;
  } else {
    categoryBadge.classList.add('hidden');
  }
  
  // Date Badge
  const dateBadge = document.getElementById('parsed-date');
  if (parsed.dueDate) {
    dateBadge.className = 'nlp-badge date';
    dateBadge.innerHTML = `<i data-lucide="calendar"></i> ${formatDateDisplay(parsed.dueDate)}`;
    dateBadge.classList.remove('hidden');
    hasFeedback = true;
  } else {
    dateBadge.classList.add('hidden');
  }
  
  if (hasFeedback) {
    feedbackEl.classList.remove('hidden');
    lucide.createIcons();
  } else {
    feedbackEl.classList.add('hidden');
  }
}

// ==========================================
// 5. Views Controller
// ==========================================
function switchView(viewName) {
  state.activeView = viewName;
  
  // Toggle Active Class in Sidebar Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Toggle Active Content Panel
  document.querySelectorAll('.content-view').forEach(panel => {
    if (panel.id === `view-${viewName}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
  
  // Perform view-specific renders
  if (viewName === 'dashboard') {
    renderDashboard();
  } else if (viewName === 'matrix') {
    renderMatrix();
  } else if (viewName === 'pomodoro') {
    renderPomodoroView();
  }
  
  lucide.createIcons();
}

// ==========================================
// 6. CRUD Logic & State Persistence
// ==========================================
function saveState() {
  localStorage.setItem('smart_tasks', JSON.stringify(state.tasks));
}

function handleAddTask(e) {
  e.preventDefault();
  
  const inputEl = document.getElementById('task-input');
  const inputVal = inputEl.value.trim();
  if (!inputVal) return;
  
  // Run NLP Parser
  const parsed = parseNLP(inputVal);
  
  // Fallbacks to dropdown manual overrides if NLP was empty
  const manualPriority = document.getElementById('task-priority').value;
  const manualCategory = document.getElementById('task-category').value;
  const manualDate = document.getElementById('task-date').value;
  
  const finalPriority = parsed.priority !== 'none' ? parsed.priority : manualPriority;
  const finalCategory = parsed.category !== 'inbox' ? parsed.category : manualCategory;
  const finalDate = parsed.dueDate ? parsed.dueDate : manualDate;
  
  const newTask = {
    id: 'task-' + Date.now(),
    title: inputVal,
    text: parsed.cleanText || inputVal,
    priority: finalPriority,
    category: finalCategory,
    dueDate: finalDate,
    completed: false,
    focusSessions: 0
  };
  
  state.tasks.unshift(newTask);
  saveState();
  
  // Reset Form
  inputEl.value = '';
  document.getElementById('task-priority').value = 'none';
  document.getElementById('task-category').value = 'inbox';
  document.getElementById('task-date').value = '';
  document.getElementById('nlp-feedback').classList.add('hidden');
  
  // Visual Render
  if (state.activeView === 'dashboard') {
    renderDashboard();
  } else if (state.activeView === 'matrix') {
    renderMatrix();
  }
}

function toggleTaskComplete(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  task.completed = !task.completed;
  saveState();
  
  if (task.completed) {
    playSound('complete');
  }
  
  if (state.activeView === 'dashboard') {
    renderDashboard();
  } else if (state.activeView === 'matrix') {
    renderMatrix();
  } else if (state.activeView === 'pomodoro') {
    renderPomodoroView();
  }
}

function deleteTask(id) {
  // Find task card DOM element to animate
  const taskCard = document.querySelector(`[data-task-id="${id}"]`);
  if (taskCard) {
    taskCard.classList.add('slide-out');
    // Wait for slide-out keyframes to end
    setTimeout(() => {
      state.tasks = state.tasks.filter(t => t.id !== id);
      saveState();
      
      // Handle timer clean up if active task is deleted
      if (state.timer.activeTaskId === id) {
        state.timer.activeTaskId = 'none';
        updateTimerSelector();
      }
      
      if (state.activeView === 'dashboard') {
        renderDashboard();
      } else if (state.activeView === 'matrix') {
        renderMatrix();
      }
    }, 250);
  } else {
    // Fallback without animation
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    if (state.activeView === 'dashboard') renderDashboard();
  }
}

// Inline edit handling
function enableInlineEdit(id, textEl) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || task.completed) return;
  
  const originalText = task.text;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-task-input';
  input.value = originalText;
  
  // Swap elements
  textEl.replaceWith(input);
  input.focus();
  
  function saveEdit() {
    const updatedText = input.value.trim();
    if (updatedText && updatedText !== originalText) {
      task.text = updatedText;
      // Re-generate title string without NLP tokens
      task.title = updatedText; 
      saveState();
    }
    
    // Rerender view to restore DOM structures
    if (state.activeView === 'dashboard') {
      renderDashboard();
    } else if (state.activeView === 'matrix') {
      renderMatrix();
    }
  }
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') {
      // Revert
      if (state.activeView === 'dashboard') renderDashboard();
    }
  });
  
  input.addEventListener('blur', saveEdit);
}

// ==========================================
// 7. Renders & Filters (Dashboard)
// ==========================================
function updateDashboardStats() {
  const totalTasks = state.tasks.length;
  const completedTasks = state.tasks.filter(t => t.completed).length;
  
  // Calculate completion percentage
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Update Header Bar
  document.getElementById('progress-percent').textContent = `${percentage}%`;
  document.getElementById('progress-fill').style.width = `${percentage}%`;
}

function renderDashboard() {
  updateDashboardStats();
  
  const pendingList = document.getElementById('pending-list');
  const completedList = document.getElementById('completed-list');
  const emptyState = document.getElementById('empty-state');
  
  pendingList.innerHTML = '';
  completedList.innerHTML = '';
  
  // Filter Tasks
  let filteredTasks = [...state.tasks];
  
  // Search Filter
  if (state.filters.search) {
    const query = state.filters.search.toLowerCase();
    filteredTasks = filteredTasks.filter(t => t.text.toLowerCase().includes(query));
  }
  
  // Category Filter
  if (state.filters.category !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.category === state.filters.category);
  }
  
  // Sort tasks
  filteredTasks.sort((a, b) => {
    if (state.filters.sort === 'date-asc') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (state.filters.sort === 'date-desc') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(b.dueDate) - new Date(a.dueDate);
    }
    if (state.filters.sort === 'priority-desc') {
      const weight = { high: 3, medium: 2, low: 1, none: 0 };
      return weight[b.priority] - weight[a.priority];
    }
    if (state.filters.sort === 'priority-asc') {
      const weight = { high: 3, medium: 2, low: 1, none: 0 };
      return weight[a.priority] - weight[b.priority];
    }
    if (state.filters.sort === 'alpha') {
      return a.text.localeCompare(b.text);
    }
    return 0;
  });
  
  // Partition into Pending vs Completed
  const pendingTasks = filteredTasks.filter(t => !t.completed);
  const completedTasks = filteredTasks.filter(t => t.completed);
  
  document.getElementById('pending-count').textContent = pendingTasks.length;
  document.getElementById('completed-count').textContent = completedTasks.length;
  
  // Filter Tabs constraints: All, Pending, Completed
  const activeStatusFilter = state.filters.status;
  
  // Render Pending Tasks
  if (activeStatusFilter !== 'completed') {
    pendingTasks.forEach(task => {
      pendingList.appendChild(createTaskDOMElement(task));
    });
  }
  
  // Render Completed Tasks
  if (activeStatusFilter !== 'pending') {
    completedTasks.forEach(task => {
      completedList.appendChild(createTaskDOMElement(task));
    });
  }
  
  // Toggle lists headers / sections
  const showPendingSection = (activeStatusFilter !== 'completed') && (pendingTasks.length > 0);
  const showCompletedSection = (activeStatusFilter !== 'pending') && (completedTasks.length > 0);
  
  document.getElementById('pending-section').style.display = showPendingSection ? 'flex' : 'none';
  document.getElementById('completed-section').style.display = showCompletedSection ? 'flex' : 'none';
  
  // Show empty state if nothing to show
  const noTasksToShow = (!showPendingSection && !showCompletedSection);
  if (noTasksToShow) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }
  
  lucide.createIcons();
}

function createTaskDOMElement(task) {
  const item = document.createElement('div');
  item.className = `task-item glass ${task.completed ? 'completed' : ''}`;
  item.setAttribute('data-task-id', task.id);
  
  // Check if overdue
  let isOverdue = false;
  if (task.dueDate && !task.completed) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(task.dueDate);
    due.setHours(0,0,0,0);
    isOverdue = due < today;
  }
  
  const priorityBadge = task.priority !== 'none' 
    ? `<span class="task-badge badge-priority-${task.priority}"><i data-lucide="alert-triangle"></i>${task.priority}</span>` 
    : '';
    
  const categoryBadge = task.category !== 'inbox' 
    ? `<span class="task-badge badge-category"><i data-lucide="tag"></i>${task.category}</span>` 
    : '';
    
  const dateBadge = task.dueDate 
    ? `<span class="badge-date ${isOverdue ? 'overdue' : ''}"><i data-lucide="calendar"></i>${formatDateDisplay(task.dueDate)}${isOverdue ? ' (Overdue)' : ''}</span>` 
    : '';
    
  item.innerHTML = `
    <label class="checkbox-container">
      <input type="checkbox" ${task.completed ? 'checked' : ''}>
      <span class="checkmark"></span>
    </label>
    <div class="task-body">
      <span class="task-title">${escapeHTML(task.text)}</span>
      <div class="task-metadata">
        ${priorityBadge}
        ${categoryBadge}
        ${dateBadge}
        ${task.focusSessions > 0 ? `<span class="badge-date"><i data-lucide="target"></i>${task.focusSessions} focused</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      ${!task.completed ? `<button class="action-btn btn-focus" title="Start Focus Session"><i data-lucide="play-circle"></i></button>` : ''}
      <button class="action-btn btn-edit" title="Edit Task Name"><i data-lucide="edit-3"></i></button>
      <button class="action-btn btn-delete" title="Delete Task"><i data-lucide="trash-2"></i></button>
    </div>
  `;
  
  // Setup Actions Event Listeners
  const checkbox = item.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => toggleTaskComplete(task.id));
  
  const deleteBtn = item.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', () => deleteTask(task.id));
  
  const editBtn = item.querySelector('.btn-edit');
  const titleTextEl = item.querySelector('.task-title');
  editBtn.addEventListener('click', () => enableInlineEdit(task.id, titleTextEl));
  titleTextEl.addEventListener('dblclick', () => enableInlineEdit(task.id, titleTextEl));
  
  const focusBtn = item.querySelector('.btn-focus');
  if (focusBtn) {
    focusBtn.addEventListener('click', () => {
      // Set active task on pomodoro and switch view
      state.timer.activeTaskId = task.id;
      switchView('pomodoro');
    });
  }
  
  return item;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ==========================================
// 8. Eisenhower Matrix View Controller
// ==========================================
function renderMatrix() {
  const q1List = document.getElementById('matrix-q1');
  const q2List = document.getElementById('matrix-q2');
  const q3List = document.getElementById('matrix-q3');
  const q4List = document.getElementById('matrix-q4');
  
  q1List.innerHTML = '';
  q2List.innerHTML = '';
  q3List.innerHTML = '';
  q4List.innerHTML = '';
  
  state.tasks.forEach(task => {
    // Matrix Classification:
    // Important: priority high or medium
    // Urgent: due date today, tomorrow, or overdue (within last week / past)
    
    const isImportant = (task.priority === 'high' || task.priority === 'medium');
    
    let isUrgent = false;
    if (task.dueDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const due = new Date(task.dueDate);
      due.setHours(0,0,0,0);
      
      const diffTime = due - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Urgent if due today, tomorrow, or overdue
      isUrgent = diffDays <= 1;
    }
    
    const matrixItem = createMatrixTaskDOM(task);
    
    if (isImportant && isUrgent) {
      q1List.appendChild(matrixItem);
    } else if (isImportant && !isUrgent) {
      q2List.appendChild(matrixItem);
    } else if (!isImportant && isUrgent) {
      q3List.appendChild(matrixItem);
    } else {
      q4List.appendChild(matrixItem);
    }
  });
  
  // Render empty flags if quadrants are empty
  checkQuadrantEmpty(q1List, 'Do First');
  checkQuadrantEmpty(q2List, 'Schedule');
  checkQuadrantEmpty(q3List, 'Delegate');
  checkQuadrantEmpty(q4List, 'Eliminate');
  
  lucide.createIcons();
}

function createMatrixTaskDOM(task) {
  const el = document.createElement('div');
  el.className = `matrix-task-item ${task.completed ? 'completed' : ''}`;
  el.setAttribute('data-task-id', task.id);
  
  el.innerHTML = `
    <div class="matrix-task-item-left">
      <label class="checkbox-container">
        <input type="checkbox" ${task.completed ? 'checked' : ''}>
        <span class="checkmark"></span>
      </label>
      <span class="matrix-task-title" title="${escapeHTML(task.text)}">${escapeHTML(task.text)}</span>
    </div>
    <button class="action-btn btn-delete" title="Delete Task"><i data-lucide="trash-2"></i></button>
  `;
  
  el.querySelector('input').addEventListener('change', () => toggleTaskComplete(task.id));
  el.querySelector('.btn-delete').addEventListener('click', () => deleteTask(task.id));
  
  return el;
}

function checkQuadrantEmpty(listEl, name) {
  if (listEl.children.length === 0) {
    const empty = document.createElement('div');
    empty.style.display = 'flex';
    empty.style.justifyContent = 'center';
    empty.style.alignItems = 'center';
    empty.style.height = '100%';
    empty.style.minHeight = '80px';
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '12px';
    empty.textContent = `No items in ${name}`;
    listEl.appendChild(empty);
  }
}

// ==========================================
// 9. Pomodoro Focus Timer Controller
// ==========================================
function updateTimerDisplay() {
  const minutes = Math.floor(state.timer.timeLeft / 60);
  const seconds = state.timer.timeLeft % 60;
  
  const displayVal = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  document.getElementById('timer-display').textContent = displayVal;
  
  // Update Tab Title
  document.title = `${displayVal} - ${state.timer.mode === 'pomodoro' ? 'Focusing' : 'Break'}`;
  
  // Update Ring Progress
  const circle = document.getElementById('timer-progress');
  const maxOffset = 534; // 2 * PI * r (r=85)
  const percentLeft = state.timer.timeLeft / state.timer.totalDuration;
  circle.style.strokeDashoffset = maxOffset * (1 - percentLeft);
}

function updateTimerSelector() {
  const select = document.getElementById('timer-task-select');
  const prevSelected = select.value;
  select.innerHTML = '<option value="none">No specific task selected</option>';
  
  // Select active pending tasks
  const pendingTasks = state.tasks.filter(t => !t.completed);
  pendingTasks.forEach(task => {
    const opt = document.createElement('option');
    opt.value = task.id;
    opt.textContent = `${task.text} [${task.priority}]`;
    select.appendChild(opt);
  });
  
  // Try to preserve previous or set active task
  if (state.timer.activeTaskId !== 'none') {
    select.value = state.timer.activeTaskId;
  } else {
    select.value = prevSelected;
  }
}

function renderPomodoroView() {
  // Sync Display Stats
  document.getElementById('pomodoros-completed').textContent = state.timer.sessionsCompleted;
  document.getElementById('focus-time-total').textContent = `${state.timer.totalFocusTime}m`;
  
  updateTimerSelector();
  updateTimerDisplay();
}

function switchTimerMode(duration, modeName) {
  // Clear any active running timer
  clearInterval(state.timer.intervalId);
  
  state.timer.timeLeft = duration;
  state.timer.totalDuration = duration;
  state.timer.status = 'idle';
  state.timer.mode = modeName;
  
  // Toggle tabs visually
  document.querySelectorAll('.timer-tab').forEach(btn => {
    if (btn.getAttribute('data-mode') === modeName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Show Start button, hide pause
  document.getElementById('timer-start').classList.remove('hidden');
  document.getElementById('timer-pause').classList.add('hidden');
  
  updateTimerDisplay();
}

function startTimer() {
  if (state.timer.status === 'running') return;
  
  state.timer.status = 'running';
  document.getElementById('timer-start').classList.add('hidden');
  document.getElementById('timer-pause').classList.remove('hidden');
  
  state.timer.intervalId = setInterval(() => {
    if (state.timer.timeLeft > 0) {
      state.timer.timeLeft--;
      updateTimerDisplay();
    } else {
      handleTimerComplete();
    }
  }, 1000);
}

function pauseTimer() {
  if (state.timer.status !== 'running') return;
  
  clearInterval(state.timer.intervalId);
  state.timer.status = 'paused';
  
  document.getElementById('timer-start').classList.remove('hidden');
  document.getElementById('timer-pause').classList.add('hidden');
}

function resetTimer() {
  clearInterval(state.timer.intervalId);
  
  const defaultDurations = { pomodoro: 1500, short: 300, long: 900 };
  const originalDuration = defaultDurations[state.timer.mode];
  
  state.timer.timeLeft = originalDuration;
  state.timer.totalDuration = originalDuration;
  state.timer.status = 'idle';
  
  document.getElementById('timer-start').classList.remove('hidden');
  document.getElementById('timer-pause').classList.add('hidden');
  
  updateTimerDisplay();
}

function handleTimerComplete() {
  clearInterval(state.timer.intervalId);
  state.timer.status = 'idle';
  playSound('timer-end');
  
  if (state.timer.mode === 'pomodoro') {
    state.timer.sessionsCompleted++;
    // Add 25 minutes of focus time
    state.timer.totalFocusTime += 25;
    
    // Save timer logs
    localStorage.setItem('pomodoros_completed', state.timer.sessionsCompleted);
    localStorage.setItem('total_focus_time', state.timer.totalFocusTime);
    
    // Increment active task focus metrics
    const select = document.getElementById('timer-task-select');
    const taskId = select.value;
    if (taskId && taskId !== 'none') {
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.focusSessions = (task.focusSessions || 0) + 1;
        saveState();
      }
    }
    
    alert('Focus session complete! Take a break.');
    switchTimerMode(300, 'short'); // Auto switch to short break
  } else {
    alert('Break is over! Time to focus.');
    switchTimerMode(1500, 'pomodoro'); // Auto switch back
  }
  
  renderPomodoroView();
}

// ==========================================
// 10. Theme and Theme Initialization
// ==========================================
function initTheme() {
  if (state.theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}

function toggleTheme() {
  if (state.theme === 'dark') {
    state.theme = 'light';
    document.body.classList.add('light-theme');
  } else {
    state.theme = 'dark';
    document.body.classList.remove('light-theme');
  }
  localStorage.setItem('theme', state.theme);
}

// ==========================================
// 11. Event Listeners & Bootstrapping
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Update Dates & Greetings
  updateDateHeader();
  setInterval(updateDateHeader, 60000); // Check every minute
  
  // Theme Setup
  initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  
  // Navigation
  document.getElementById('nav-dashboard').addEventListener('click', () => switchView('dashboard'));
  document.getElementById('nav-matrix').addEventListener('click', () => switchView('matrix'));
  document.getElementById('nav-pomodoro').addEventListener('click', () => switchView('pomodoro'));
  
  // Form submission
  document.getElementById('task-form').addEventListener('submit', handleAddTask);
  
  // Live NLP feedback keyups
  const taskInput = document.getElementById('task-input');
  taskInput.addEventListener('input', updateNLPFeedback);
  
  // Search bar
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderDashboard();
  });
  
  // Controls Filters
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      
      state.filters.status = e.target.getAttribute('data-filter');
      renderDashboard();
    });
  });
  
  document.getElementById('category-filter').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    renderDashboard();
  });
  
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderDashboard();
  });
  
  // Pomodoro controls
  document.querySelectorAll('.timer-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const time = parseInt(e.target.getAttribute('data-time'));
      const mode = e.target.getAttribute('data-mode');
      switchTimerMode(time, mode);
    });
  });
  
  document.getElementById('timer-start').addEventListener('click', startTimer);
  document.getElementById('timer-pause').addEventListener('click', pauseTimer);
  document.getElementById('timer-reset').addEventListener('click', resetTimer);
  
  document.getElementById('timer-task-select').addEventListener('change', (e) => {
    state.timer.activeTaskId = e.target.value;
  });
  
  // Initial render
  switchView('dashboard');
});
