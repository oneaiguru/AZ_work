const STORAGE_KEY = "ai-flow-selected-project";
const messages = document.querySelector("#messages");
const screens = Array.from(document.querySelectorAll("[data-screen]"));
const screenButtons = Array.from(document.querySelectorAll("[data-screen-btn]"));
const projectDropdowns = Array.from(document.querySelectorAll(".project-dropdown"));
const manualInputs = Array.from(document.querySelectorAll(".project-path-input"));
const manualSaveButtons = Array.from(document.querySelectorAll(".project-path-save"));
const overviewSelected = document.getElementById("overview-selected");
const projectCurrentSpans = Array.from(document.querySelectorAll(".project-picker__current-value"));
const projectsList = document.querySelector("#projects-list");
const refreshButton = document.querySelector("#refresh-projects");
const urlParams = new URLSearchParams(window.location.search);

let knownProjects = [];
let currentScreen = urlParams.get("screen") || "overview";

function postJson(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then((response) => response.json());
}

function showMessage(text, type = "info") {
  if (!messages) {
    return;
  }
  const entry = document.createElement("div");
  entry.className = `message ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  messages.prepend(entry);
}

function getStoredProject() {
  return localStorage.getItem(STORAGE_KEY) || null;
}

function setStoredProject(path, options = { replaceUrl: true }) {
  if (path) {
    localStorage.setItem(STORAGE_KEY, path);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  updateProjectDisplays();
  updateUrl({ replace: options.replaceUrl });
}

function updateProjectDisplays() {
  const selected = getStoredProject();
  const displayValue = selected || "—";
  projectDropdowns.forEach((dropdown) => {
    dropdown.value = selected || "";
  });
  manualInputs.forEach((input) => {
    if (document.activeElement === input) {
      return;
    }
    input.value = selected || "";
  });
  projectCurrentSpans.forEach((span) => {
    span.textContent = displayValue;
  });
  if (overviewSelected) {
    overviewSelected.textContent = displayValue;
  }
}

function ensureSelectedProject() {
  const project = getStoredProject();
  if (!project) {
    throw new Error("Сначала выберите проект на любом экране.");
  }
  return project;
}

function requireSelectedProject() {
  const project = getStoredProject();
  if (!project) {
    showMessage("Сначала выберите проект", "error");
    return null;
  }
  return project;
}

function populateDropdowns() {
  projectDropdowns.forEach((dropdown) => {
    dropdown.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— Выберите проект —";
    placeholder.disabled = false;
    placeholder.selected = true;
    dropdown.appendChild(placeholder);
    knownProjects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.path;
      option.textContent = project.name;
      dropdown.appendChild(option);
    });
    const selected = getStoredProject();
    dropdown.value = selected || "";
  });
}

async function refreshProjects() {
  try {
    const response = await fetch("/projects");
    if (!response.ok) {
      throw new Error("Не удалось загрузить список проектов");
    }
    const payload = await response.json();
    knownProjects = payload.projects || [];
    populateDropdowns();
    if (projectsList) {
      projectsList.innerHTML = knownProjects
        .map((project) => `<li><strong>${project.name}</strong>: ${project.path}</li>`)
        .join("");
    }
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Ошибка при загрузке проектов", "error");
  }
}

function showScreen(target, push = true) {
  currentScreen = target;
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === target);
  });
  screenButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.screenBtn === target);
  });
  if (push) {
    updateUrl();
  }
}

screenButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.screenBtn;
    if (target) {
      showScreen(target);
    }
  });
});

projectDropdowns.forEach((dropdown) => {
  dropdown.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.value) {
      setStoredProject(target.value);
    }
  });
});

manualSaveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const wrapper = button.closest(".project-picker__manual");
    if (!wrapper) {
      return;
    }
    const input = wrapper.querySelector(".project-path-input");
    if (input) {
      const value = input.value.trim();
      if (value) {
        setStoredProject(value);
        showMessage(`Проект выбран: ${value}`, "success");
      }
    }
  });
});

const initForm = document.querySelector("#init-form");
if (initForm) {
  initForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const path = form.elements.path.value.trim();
    const title = form.elements.title.value.trim();
    const date = form.elements.date.value;
    if (!path) {
      showMessage("Укажите путь проекта", "error");
      return;
    }
    const result = await postJson("/api/init", { project_path: path, title, date });
    if (result.ok) {
      setStoredProject(path);
      refreshProjects();
      showMessage(`Проект создан: ${result.project_path}`, "success");
    } else {
      showMessage(`Ошибка: ${result.error}`, "error");
    }
  });
}

const timeButtons = Array.from(document.querySelectorAll("button[data-time-action]"));
async function handleTimeAction(action) {
  try {
    const project_path = ensureSelectedProject();
    const payload = { project_path };
    if (action === "start") {
      const form = document.querySelector("#time-action-form");
      if (!form) {
        return;
      }
      const activity = form.elements.activity.value;
      const note = form.elements.note.value.trim();
      payload.activity = activity;
      if (note) {
        payload.note = note;
      }
    } else {
      const form = document.querySelector("#time-action-form");
      if (form) {
        const note = form.elements.note.value.trim();
        if (note) {
          payload.note = note;
        }
      }
    }
    const result = await postJson(`/api/time/${action}`, payload);
    if (result.ok) {
      showMessage(`Время ${action} зафиксировано для ${project_path}`, "success");
    } else {
      showMessage(`Ошибка: ${result.error}`, "error");
    }
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Ошибка действия времени", "error");
  }
}

timeButtons.forEach((button) => {
  const action = button.dataset.timeAction;
  if (action) {
    button.addEventListener("click", () => {
      handleTimeAction(action);
    });
  }
});

const reportForm = document.querySelector("#time-report-form");
if (reportForm) {
  reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const project_path = ensureSelectedProject();
      const date = reportForm.elements.date.value;
      const params = new URLSearchParams();
      params.set("project_path", project_path);
      if (date) {
        params.set("date", date);
      }
      const response = await fetch(`/api/time/report?${params.toString()}`);
      const payload = await response.json();
      if (payload.ok) {
        showMessage(`Отчёт:\n${payload.report}`);
      } else {
        showMessage(`Ошибка: ${payload.error}`, "error");
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Ошибка отчёта", "error");
    }
  });
}

const branchForm = document.querySelector("#branch-form");
if (branchForm) {
  branchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const project = requireSelectedProject();
    if (!project) {
      return;
    }
    const form = event.currentTarget;
    const payload = {
      project_path: project,
      branch_id: form.elements.branch_id.value.trim() || undefined,
      title: form.elements.title.value.trim() || undefined,
      parent: form.elements.parent.value.trim() || undefined,
      from_step: form.elements.from_step.value.trim() || undefined,
      status: form.elements.status.value,
      closed_reason: form.elements.closed_reason.value.trim() || undefined,
      skip_git_check: form.elements.skip_git_check.checked,
    };
    const result = await postJson("/api/create-branch", payload);
    showMessage(result.ok ? `Ветка ${result.branch_id} создана` : `Ошибка: ${result.error}`, result.ok ? "success" : "error");
  });
}

const newStepForm = document.querySelector("#new-step-form");
if (newStepForm) {
  newStepForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const project = requireSelectedProject();
    if (!project) {
      return;
    }
    const form = event.currentTarget;
    const payload = {
      project_path: project,
      branch_id: form.elements.branch_id.value.trim() || undefined,
      step_id: form.elements.step_id.value.trim() || undefined,
      from_step: form.elements.from_step.value.trim() || undefined,
      skip_git_check: form.elements.skip_git_check.checked,
    };
    const result = await postJson("/api/new-step", payload);
    showMessage(result.ok ? `Шаг ${result.step_id} создан` : `Ошибка: ${result.error}`, result.ok ? "success" : "error");
  });
}

const switchForm = document.querySelector("#switch-form");
if (switchForm) {
  switchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const project = requireSelectedProject();
    if (!project) {
      return;
    }
    const form = event.currentTarget;
    const payload = {
      project_path: project,
      branch_id: form.elements.branch_id.value.trim() || undefined,
      step: form.elements.step.value.trim() || undefined,
      skip_git_check: form.elements.skip_git_check.checked,
    };
    const result = await postJson("/api/switch", payload);
    showMessage(result.ok ? `Переключено: ${result.branch}` : `Ошибка: ${result.error}`, result.ok ? "success" : "error");
  });
}

const diagramForm = document.querySelector("#diagram-form");
const diagramResult = document.querySelector("#diagram-result");
if (diagramForm) {
  diagramForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const project = requireSelectedProject();
    if (!project) {
      return;
    }
    const form = event.currentTarget;
    const payload = {
      project_path: project,
      output: form.elements.output.value.trim() || undefined,
    };
    const result = await postJson("/api/diagram", payload);
    if (diagramResult) {
      diagramResult.textContent = result.diagram || "";
    }
    showMessage(result.ok ? "Диаграмма готова" : `Ошибка: ${result.error}`, result.ok ? "success" : "error");
  });
}

if (refreshButton) {
  refreshButton.addEventListener("click", refreshProjects);
}

function updateUrl(opts = {}) {
  const params = new URLSearchParams(window.location.search);
  params.set("screen", currentScreen);
  const project = getStoredProject();
  if (project) {
    params.set("project", project);
  } else {
    params.delete("project");
  }
  if (opts.replace) {
    window.history.replaceState({}, "", `?${params.toString()}`);
  } else {
    window.history.pushState({}, "", `?${params.toString()}`);
  }
}

const urlProject = urlParams.get("project");
if (urlProject) {
  setStoredProject(urlProject);
}

showScreen(currentScreen, false);
updateProjectDisplays();
refreshProjects();
