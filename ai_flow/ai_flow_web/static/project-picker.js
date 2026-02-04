document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector("[data-project-picker-toggle]");
  const dropdown = document.querySelector("[data-project-picker-dropdown]");
  const list = document.querySelector("[data-project-picker-list]");
  const datalist = document.getElementById("project-path-options");
  const inputs = Array.from(document.querySelectorAll(".project-path-input"));
  const storageKey = "ai_flow_web:selectedProject";

  if (!toggle || !dropdown || !list || !inputs.length) {
    return;
  }

  const storedPath = localStorage.getItem(storageKey);
  inputs.forEach((input) => {
    if (!input.value && storedPath) {
      input.value = storedPath;
    }
    input.addEventListener("input", () => {
      const value = input.value.trim();
      if (value) {
        localStorage.setItem(storageKey, value);
      } else {
        localStorage.removeItem(storageKey);
      }
    });
  });

  const closeDropdown = () => {
    dropdown.setAttribute("hidden", "true");
  };

  toggle.addEventListener("click", () => {
    if (dropdown.hasAttribute("hidden")) {
      dropdown.removeAttribute("hidden");
    } else {
      closeDropdown();
    }
  });

  document.addEventListener("click", (event) => {
    if (
      dropdown.hasAttribute("hidden") ||
      dropdown.contains(event.target) ||
      event.target === toggle
    ) {
      return;
    }
    closeDropdown();
  });

  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-project-picker-row]");
    if (!option) {
      return;
    }
    const path = option.dataset.projectPath;
    if (!path) {
      return;
    }
    inputs.forEach((input) => {
      input.value = path;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    closeDropdown();
  });

  const formatRow = (project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button is-white is-fullwidth project-picker-row";
    button.setAttribute("data-project-picker-row", "true");
    button.dataset.projectPath = project.path;
    button.innerHTML = [
      `<strong>${project.name}</strong>`,
      `<span class="is-size-7 has-text-grey">${project.path}</span>`,
    ].join("<br>");
    return button;
  };

  const renderProjects = (items) => {
    list.innerHTML = "";
    if (datalist) {
      datalist.innerHTML = "";
    }
    if (!items.length) {
      list.innerHTML =
        '<p class="is-size-7 has-text-grey">No projects found under the base root.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      fragment.appendChild(formatRow(item));
      if (datalist) {
        const option = document.createElement("option");
        option.value = item.path;
        datalist.appendChild(option);
      }
    });
    list.appendChild(fragment);
  };

  fetch("/projects")
    .then((response) => (response.ok ? response.json() : { projects: [] }))
    .then((data) => {
      const projects = Array.isArray(data.projects) ? data.projects : [];
      renderProjects(projects);
    })
    .catch(() => {
      list.innerHTML =
        '<p class="is-size-7 has-text-danger">Unable to load projects.</p>';
    });
});
