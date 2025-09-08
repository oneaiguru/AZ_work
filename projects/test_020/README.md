# test_020

Chrome extension that lets you choose a folder of Markdown files,
shows the folder path and lists up to the first ten file names.
Files are processed one at a time to avoid freezes when large
directories are selected. A debug checkbox limits processing to a
single file and logs detailed operations to the console.

## Features
- Choose a directory containing Markdown files.
- Display the selected folder in the popup.
- List first ten `.md` files (or one in debug mode).
- Debug mode logs each operation and result.

## Usage
1. Load the extension in Chrome via `chrome://extensions` with Developer mode enabled.
2. Click the extension icon to open the popup.
3. Optionally enable **Debug** to log operations and only process one file.
4. Use the folder picker to select a directory of Markdown documents. The file names will appear in the list.
