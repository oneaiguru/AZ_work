document.addEventListener("DOMContentLoaded", () => {
  const storageKey = "ai_flow_web:selectedProject";
  const fields = Array.from(document.querySelectorAll(".project-path-field"));
  if (!fields.length) {
    return;
  }

  const inputs = fields
    .map((field) => field.querySelector(".project-path-input"))
    .filter(Boolean);
  const toggles = fields
    .map((field) => field.querySelector("[data-project-picker-toggle]"))
    .filter(Boolean);
  const dropdowns = fields
    .map((field) => field.querySelector("[data-project-picker-dropdown]"))
    .filter(Boolean);
  const lists = fields
    .map((field) => field.querySelector("[data-project-picker-list]"))
    .filter(Boolean);
  const datalists = fields
    .map((field) => field.querySelector(".project-path-options"))
    .filter(Boolean);

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

  toggles.forEach((toggle, index) => {
    const dropdown = dropdowns[index];
    if (!dropdown) {
      return;
    }
    toggle.addEventListener("click", () => {
      dropdowns.forEach((d) => d.setAttribute("hidden", "true"));
      dropdown.removeAttribute("hidden");
    });
  });

  document.addEventListener("click", (event) => {
    dropdowns.forEach((dropdown) => {
      if (dropdown.contains(event.target) || dropdown.hasAttribute("hidden")) {
        return;
      }
      dropdown.setAttribute("hidden", "true");
    });
  });

  lists.forEach((list) => {
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
      dropdowns.forEach((dropdown) => dropdown.setAttribute("hidden", "true"));
    });
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
    lists.forEach((list) => {
      list.innerHTML = "";
      if (!items.length) {
        list.innerHTML =
          '<p class="is-size-7 has-text-grey">No projects found under the base root.</p>';
        return;
      }
      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        fragment.appendChild(formatRow(item));
      });
      list.appendChild(fragment);
    });

    datalists.forEach((datalist) => {
      datalist.innerHTML = "";
      items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.path;
        datalist.appendChild(option);
      });
    });
  };

  fetch("/projects")
    .then((response) => (response.ok ? response.json() : { projects: [] }))
    .then((data) => {
      const projects = Array.isArray(data.projects) ? data.projects : [];
      renderProjects(projects);
    })
    .catch(() => {
      lists.forEach((list) => {
        list.innerHTML =
          '<p class="is-size-7 has-text-danger">Unable to load projects.</p>';
      });
    });
});
