document.addEventListener("DOMContentLoaded", () => {
  const statusLabel = document.getElementById("time-session-status");
  const statusNote = document.getElementById("time-session-note");
  const actionButtons = Array.from(
    document.querySelectorAll("[data-time-action-button]")
  );
  const formInputs = document.querySelectorAll(".project-path-input");

  if (!statusLabel || !actionButtons.length) {
    return;
  }

  const stateRules = {
    idle: { start: false, pause: true, resume: true, switch: true, stop: true },
    active: { start: true, pause: false, resume: true, switch: false, stop: false },
    paused: { start: true, pause: true, resume: false, switch: true, stop: false },
    stopped: { start: false, pause: true, resume: true, switch: true, stop: true },
  };

  const updateButtons = (state) => {
    actionButtons.forEach((button) => {
      const action = button.closest("[data-time-action]")?.dataset.timeAction;
      if (!action || !stateRules[state]) {
        return;
      }
      button.disabled = stateRules[state][action] ?? false;
    });
  };

  const updateStatus = (payload) => {
    const state = payload.state || "idle";
    statusLabel.textContent = state === "idle" ? "Нет активной сессии" : state;
    const noteParts = [];
    if (payload.activity) {
      noteParts.push(`activity: ${payload.activity}`);
    }
    if (payload.branch) {
      noteParts.push(`branch: ${payload.branch}`);
    }
    if (payload.step) {
      noteParts.push(`step: ${payload.step}`);
    }
    if (payload.note) {
      noteParts.push(`note: ${payload.note}`);
    }
    statusNote.textContent = noteParts.join(" • ") || "нет деталей";
    updateButtons(state);
  };

  const fetchStatus = () => {
    const projectPath =
      formInputs[0]?.value.trim() || formInputs[1]?.value.trim() || "";
    const params = new URLSearchParams();
    if (projectPath) {
      params.set("project_path", projectPath);
    }
    fetch(`/time/status?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : { state: "idle" }))
      .then((data) => updateStatus(data))
      .catch(() => updateStatus({ state: "idle" }));
  };

  formInputs.forEach((input) => {
    input.addEventListener("change", () => fetchStatus());
  });

  fetchStatus();
});
