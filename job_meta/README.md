# Job Meta Chrome Extension

This Chrome extension processes Markdown documents in a chosen directory.

- Select a folder containing `.md` documents.
- Each document receives or updates a `lastOpened` attribute in its front matter.
- Documents are converted to HTML files in the same folder.
- When debug mode is enabled, detailed logs are printed to the console and only the first document is processed.

## Usage
1. Load the extension in Chrome via `chrome://extensions` and enable Developer Mode.
2. Click **Load unpacked** and choose this `job_meta` folder.
3. Open the extension popup, optionally enable **Debug**, and select a folder of Markdown documents.

## Development
No build step is required; the extension uses standard web APIs.
