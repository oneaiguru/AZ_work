# job_meta

Chrome extension for enriching job markdown files with structured metadata via ChatGPT.

## Features
- Select a folder containing `.md` files tagged with `job`.
- Recursively processes files, skipping ones already handled.
- Optional debug mode to process only a single file.
- Opens ChatGPT web interface with a parsing prompt and job description.
- Adds returned attributes (PublicationDate, Company, Position, DescriptionChecksum) to the file's front matter.
- Stores processed file information in `chrome.storage.local`.

## Usage
1. Build or load the extension in Chrome via `chrome://extensions` (Developer mode).
2. Make sure you are logged into [chat.openai.com](https://chat.openai.com).
3. Open the popup and choose a folder with markdown files.
4. Click **Обработать** to run. Enable debug mode to handle a single file.

The project also contains prompt descriptions in the [`prompt`](prompt) directory.
