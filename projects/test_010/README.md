# test_010

Chrome extension that processes Markdown documents in a chosen folder. When a folder is selected the extension:

- Reads all `*.md` files (or only the first one when debug mode is enabled).
- Adds/updates a `lastOpened` attribute in the document's front matter with the current timestamp.
- Renders the Markdown content to HTML inside the popup window.
- Logs each operation in debug mode.
- Bundles the Work Sans font locally to comply with Chrome's content security policy.
- Includes a local copy of the Marked parser so no external scripts are required (see `MARKED_LICENSE.md`).

## Usage

1. Load the extension via `chrome://extensions` using *Load unpacked* and selecting this folder.
2. Click the extension icon and choose a folder containing Markdown files.
3. The processed documents and their HTML output appear in the popup.

Debug mode can be toggled by changing the `DEBUG` constant in `popup.js`.
