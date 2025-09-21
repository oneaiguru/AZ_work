# test_020

Chrome extension that lets you choose a folder of Markdown files,
shows the folder path and lists up to the first ten file names.
Files are processed one at a time to avoid freezes when large
directories are selected. Every operation logs its parameters and
results to a `log.txt` file saved in the chosen folder. The debug
checkbox limits processing to a single file.

## Features
- Choose a directory containing Markdown files.
- Display the selected folder in the popup.
- List first ten `.md` files (or one in debug mode).
- Debug mode logs to the console and only processes one file.
- `log.txt` captures each operation's parameters and results.

## Usage
1. Load the extension in Chrome via `chrome://extensions` with Developer mode enabled.
2. Click the extension icon to open the popup.
3. Optionally enable **Debug** to log to the console and only process one file.
4. Click **Pick Folder** and choose a directory of Markdown documents.
   A `log.txt` file is created in the folder and updated after each step.
   The file names will appear in the list.

