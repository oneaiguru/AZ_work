const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert");
const test = require("node:test");
const { startWebServer } = require("../dist/web.js");

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  return response.json();
}

test("web UI endpoints create projects and time logs", async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-flow-web-"));
  const server = await startWebServer({ port: 0, baseDir, host: "127.0.0.1" });
  try {
    const address = server.server.address();
    const port = typeof address === "object" ? address.port : address;
    const baseUrl = `http://127.0.0.1:${port}`;
    const initPayload = { project_path: "web-test", title: "Web Test", date: new Date().toISOString().slice(0, 10) };
    const initResponse = await jsonFetch(`${baseUrl}/api/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initPayload),
    });
    assert.strictEqual(initResponse.ok, true);

    const startResponse = await jsonFetch(`${baseUrl}/api/time/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_path: "web-test", activity: "coding", note: "web start" }),
    });
    assert.strictEqual(startResponse.ok, true);

    const stopResponse = await jsonFetch(`${baseUrl}/api/time/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_path: "web-test", note: "web stop" }),
    });
    assert.strictEqual(stopResponse.ok, true);

    const reportResponse = await jsonFetch(`${baseUrl}/api/time/report?project_path=web-test&date=${encodeURIComponent(
      initPayload.date
    )}`);
    assert.strictEqual(reportResponse.ok, true);
    assert.ok(reportResponse.report.includes("| START |"));

    const branchResponse = await jsonFetch(`${baseUrl}/api/create-branch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_path: "web-test",
        branch_id: "B_web",
        title: "Web Branch",
        parent: "A",
        skip_git_check: true,
      }),
    });
    assert.strictEqual(branchResponse.ok, true);

    const newStepResponse = await jsonFetch(`${baseUrl}/api/new-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_path: "web-test",
        branch_id: "B_web",
        from_step: "B_web_001",
        skip_git_check: true,
      }),
    });
    assert.strictEqual(newStepResponse.ok, true);

    const switchResponse = await jsonFetch(`${baseUrl}/api/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_path: "web-test",
        branch_id: "B_web",
        step: "B_web_002",
        skip_git_check: true,
      }),
    });
    assert.strictEqual(switchResponse.ok, true);

    const diagramResponse = await jsonFetch(`${baseUrl}/api/diagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_path: "web-test" }),
    });
    assert.strictEqual(diagramResponse.ok, true);
    assert.ok(typeof diagramResponse.diagram === "string" && diagramResponse.diagram.includes("graph TD"));
  } finally {
    await server.close();
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
