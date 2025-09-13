# test_030

Simple HTML page that lets you choose a folder of Markdown files,
shows the folder path and lists up to the first ten file names.
A debug checkbox limits processing to a single file. All operations
and their results are logged to a `log.txt` file inside the selected
folder.

## Features
- Choose a directory containing Markdown files.
- Display the selected folder in the page.
- List first ten `.md` files (or one in debug mode).
- Log every operation with parameters and results to `log.txt`.

## Usage
1. Open `index.html` in a modern browser.
2. Optionally enable **Debug** to limit processing to one file.
3. Click **Pick Folder** and select a directory of Markdown documents. A `log.txt` file is created in that folder with a log entry for each operation.
4. The file names will appear in the list.
