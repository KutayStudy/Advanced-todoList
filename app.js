const STORAGE_KEY = "todo_tasks_v4";
const THEME_KEY = "todo_theme_v1";

let tasks = loadTasks();
let currentFilter = "all";
let dragId = null;

function clampText(s) {
  return String(s ?? "").trim();
}

function findTask(id) {
  return tasks.find((t) => t.id === id);
}

function commit() {
  saveTasks();
  render();
}

function makeId() {
  return crypto.randomUUID();
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

const inputEl = document.getElementById("taskInput");
const dueEl = document.getElementById("dueInput");
const priorityEl = document.getElementById("prioritySelect");
const addBtn = document.getElementById("addBtn");

const searchEl = document.getElementById("searchInput");
const sortEl = document.getElementById("sortSelect");

const ulEl = document.getElementById("todoList");
const emptyEl = document.getElementById("emptyState");

const tasksLeftEl = document.getElementById("tasksLeft");
const counterEl = document.getElementById("counter");
const clearBtn = document.getElementById("clearCompletedBtn");

const filterAllBtn = document.getElementById("filterAll");
const filterActiveBtn = document.getElementById("filterActive");
const filterCompletedBtn = document.getElementById("filterCompleted");

const themeSelect = document.getElementById("themeSelect");

initTheme();
bindUI();
render();

function bindUI() {
  addBtn.addEventListener("click", addTask);

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTask();
  });

  searchEl.addEventListener("input", render);
  sortEl.addEventListener("change", render);

  clearBtn.addEventListener("click", clearCompleted);

  filterAllBtn.addEventListener("click", () => setFilter("all"));
  filterActiveBtn.addEventListener("click", () => setFilter("active"));
  filterCompletedBtn.addEventListener("click", () => setFilter("completed"));

  bindDragAndDrop();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "tony";
  setTheme(saved);
  themeSelect.value = saved;

  themeSelect.addEventListener("change", () => {
    const next = themeSelect.value;
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
}

function setFilter(filter) {
  currentFilter = filter;
  updateFilterUI();
  render();
}

function updateFilterUI() {
  filterAllBtn.classList.toggle("active", currentFilter === "all");
  filterActiveBtn.classList.toggle("active", currentFilter === "active");
  filterCompletedBtn.classList.toggle("active", currentFilter === "completed");
}

function addTask() {
  const text = clampText(inputEl.value);
  if (!text) {
    alert("Please enter a valid task.");
    return;
  }

  tasks.push({
    id: makeId(),
    text,
    done: false,
    priority: priorityEl.value,
    due: dueEl.value || null
  });

  inputEl.value = "";
  dueEl.value = "";
  inputEl.focus();

  commit();
}

function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  commit();
}

function toggleCompleted(id) {
  const task = findTask(id);
  if (!task) return;
  task.done = !task.done;
  commit();
}

function clearCompleted() {
  tasks = tasks.filter((t) => !t.done);
  commit();
}

function editTask(id) {
  const task = findTask(id);
  if (!task) return;

  const li = document.querySelector(`li[data-id="${id}"]`);
  if (!li) return;

  const span = li.querySelector(".taskText");
  if (!span) return;

  const input = document.createElement("input");
  input.type = "text";
  input.value = task.text;
  input.className = "editInput";

  const oldText = task.text;
  span.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  const finish = (save) => {
    const cleaned = clampText(input.value);

    const newSpan = document.createElement("span");
    newSpan.className = "taskText" + (task.done ? " done" : "");
    newSpan.textContent = (save && cleaned) ? cleaned : oldText;

    input.replaceWith(newSpan);

    if (save && cleaned && cleaned !== oldText) {
      task.text = cleaned;
      commit();
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });

  input.addEventListener("blur", () => finish(true));
}

function bindDragAndDrop() {
  ulEl.addEventListener("dragstart", (e) => {
    if (sortEl.value !== "manual") { 
	e.preventDefault(); 
	return; 
    }

    const li = e.target.closest("li");
    if (!li) return;

    if (li.dataset.dragOk !== "1") {
      e.preventDefault();
      return;
    }
    li.dataset.dragOk = "0";

    dragId = li.dataset.id;
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });

  ulEl.addEventListener("dragend", (e) => {
    const li = e.target.closest("li");
    if (li) li.classList.remove("dragging");
    dragId = null;
    clearDragOverStyles();
  });

  ulEl.addEventListener("dragover", (e) => {
    if (sortEl.value !== "manual") return;
    e.preventDefault();

    const overLi = e.target.closest("li");
    if (!overLi || dragId === null) return;

    clearDragOverStyles();
    overLi.classList.add("dragOver");
    e.dataTransfer.dropEffect = "move";
  });

  ulEl.addEventListener("drop", (e) => {
    if (sortEl.value !== "manual") return;
    e.preventDefault();

    const dropLi = e.target.closest("li");
    if (!dropLi || dragId === null) return;

    const dropId = dropLi.dataset.id;
    if (dropId === dragId) return;

    const fromIndex = tasks.findIndex((t) => t.id === dragId);
    const toIndex = tasks.findIndex((t) => t.id === dropId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = tasks.splice(fromIndex, 1);
    tasks.splice(toIndex, 0, moved);

    commit();
  });
}

function clearDragOverStyles() {
  document.querySelectorAll("li.dragOver").forEach((x) => x.classList.remove("dragOver"));
}

function getVisibleTasks() {
  let list = [...tasks];

  if (currentFilter === "active") list = list.filter((t) => !t.done);
  if (currentFilter === "completed") list = list.filter((t) => t.done);

  const q = clampText(searchEl.value).toLowerCase();
  if (q) list = list.filter((t) => t.text.toLowerCase().includes(q));

  if (sortEl.value === "priority") {
    const order = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
  } else if (sortEl.value === "due") {
    const max = "9999-12-31";
    list.sort((a, b) => (a.due || max).localeCompare(b.due || max));
  }

  return list;
}

function showEmptyState() {
  emptyEl.style.display = "block";
  const big = emptyEl.querySelector(".big");
  const small = emptyEl.querySelector(".small");

  const hasSearch = !!clampText(searchEl.value);

  if (currentFilter === "all" && !hasSearch) {
    big.textContent = "No tasks yet.";
    small.textContent = "Add your first task above.";
  } else if (hasSearch) {
    big.textContent = "No results.";
    small.textContent = "Try a different search.";
  } else if (currentFilter === "active") {
    big.textContent = "No active tasks.";
    small.textContent = "Switch to All or Completed.";
  } else {
    big.textContent = "No completed tasks.";
    small.textContent = "Switch to All or Active.";
  }
}

function hideEmptyState() {
  emptyEl.style.display = "none";
}

function createHandle(li) {
  const handle = document.createElement("div");
  handle.className = "handle";
  handle.title = (sortEl.value === "manual")
    ? "Drag to reorder"
    : "Switch sort to Manual to drag";
  handle.style.opacity = (sortEl.value === "manual") ? "1" : ".35";

  handle.addEventListener("pointerdown", () => { li.dataset.dragOk = "1"; });
  handle.addEventListener("pointerup", () => { li.dataset.dragOk = "0"; });
  handle.addEventListener("pointerleave", () => { li.dataset.dragOk = "0"; });

  return handle;
}

function createCheckbox(t) {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "check";
  checkbox.checked = t.done;
  checkbox.addEventListener("change", () => toggleCompleted(t.id));
  return checkbox;
}

function createMainContent(t, today) {
  const main = document.createElement("div");
  main.className = "taskMain";

  const pr = t.priority || "medium";

  const badge = document.createElement("span");
  badge.className = `badge ${pr}`;
  badge.textContent = pr.toUpperCase();

  const textSpan = document.createElement("span");
  textSpan.className = "taskText" + (t.done ? " done" : "");
  textSpan.textContent = t.text;

  main.appendChild(badge);
  main.appendChild(textSpan);

  if (t.due) {
    const dueSpan = document.createElement("span");
    dueSpan.className = "dueText";
    dueSpan.textContent = `Due: ${t.due}`;
    main.appendChild(dueSpan);

    const isOverdue = (t.due < today && !t.done);
    if (isOverdue) {
      const overdueBadge = document.createElement("span");
      overdueBadge.className = "badge overdue";
      overdueBadge.textContent = "OVERDUE";
      main.appendChild(overdueBadge);
    }
  }

  return main;
}

function createButtons(t) {
  const editButton = document.createElement("button");
  editButton.className = "btn edit";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () => editTask(t.id));

  const deleteButton = document.createElement("button");
  deleteButton.className = "btn btn-danger";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => removeTask(t.id));

  return { editButton, deleteButton };
}

function createTaskItem(t, today) {
  const li = document.createElement("li");
  li.dataset.id = t.id;
  li.dataset.dragOk = "0";
  li.draggable = (sortEl.value === "manual");

  const isOverdue = !!(t.due && t.due < today && !t.done);
  li.classList.toggle("overdue", isOverdue);

  const handle = createHandle(li);
  const checkbox = createCheckbox(t);
  const main = createMainContent(t, today);
  const { editButton, deleteButton } = createButtons(t);

  li.appendChild(handle);
  li.appendChild(checkbox);
  li.appendChild(main);
  li.appendChild(editButton);
  li.appendChild(deleteButton);

  return li;
}

function render() {
  const visible = getVisibleTasks();
  ulEl.innerHTML = "";

  if (visible.length === 0) {
    showEmptyState();
    updateCounters();
    updateFilterUI();
    return;
  }

  hideEmptyState();

  const today = getTodayStr();
  for (const t of visible) {
    ulEl.appendChild(createTaskItem(t, today));
  }

  updateCounters();
  updateFilterUI();
}

function updateCounters() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.done).length;
  const active = total - completed;

  counterEl.textContent = `${total} total • ${active} active • ${completed} completed`;
  tasksLeftEl.textContent = `${active} tasks left`;
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.map(normalizeTask);
}

function normalizeTask(t) {
  return {
    id: typeof t?.id === "string" && t.id ? t.id : makeId(),
    text: typeof t?.text === "string" ? t.text : String(t?.text ?? ""),
    done: Boolean(t?.done),
    priority: t?.priority === "low" || t?.priority === "medium" || t?.priority === "high"
      ? t.priority
      : "medium",
    due: typeof t?.due === "string" && t.due ? t.due : null
  };
}