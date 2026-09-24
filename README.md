# Instapp - Job Application Autofiller (Ashby & Workday)

Lightning-fast, highly accurate Chrome extension that automatically populates job applications on **Ashby** and **Workday** portals, including custom questionnaires, multi-page workflows, work experience cards, education, voluntary self-identifications (EEO), and resume uploads.

---

## Quick Install (Plug & Play - No Node.js / Build Required)

The repository includes a pre-built production bundle in the `dist` directory, so you do **not** need to install Node.js or run any terminal commands to use it.

1. **Clone or Download the Repository**:
   ```bash
   git clone https://github.com/sajyra/j_b_autofiller.git
   ```
   *(Or click Code -> Download ZIP on GitHub and extract it).*

2. **Open Extensions in Chrome**:
   - In Google Chrome, go to: `chrome://extensions`
   - Turn **ON** the **Developer mode** toggle in the top-right corner.

3. **Load the Extension**:
   - Click the **"Load unpacked"** button in the top-left corner.
   - ⚠️ **IMPORTANT**: Select the **`dist`** folder inside the downloaded project:
     - On Windows: `...\j_b_autofiller\dist`
     - On Mac/Linux: `.../j_b_autofiller/dist`
   - **Do NOT select the top-level `j_b_autofiller` folder.** If you select the root folder, Chrome will look for `content.js` at root and show:  
     `"Could not load javascript 'content.js' for content script."`

4. **Configure Profile**:
   - Pin the Instapp extension in Chrome.
   - Click the extension icon and select **Open Dashboard** to configure your personal info, education, work experience, EEO answers, and upload your resume.

---

## Troubleshooting

### "Could not load javascript 'content.js' for content script"
This error occurs when you select the root `j_b_autofiller` folder in Chrome's **Load unpacked** dialog instead of the **`dist`** folder.  
**Fix**: Click "Load unpacked" again and select `j_b_autofiller/dist`.

### PowerShell / Windows: `'npm' is not recognized as an internal or external command`
You do **not** need `npm` to run this extension—just select the pre-built `dist` folder in Chrome!  
If you are developing or modifying the source code and just installed Node.js from [nodejs.org](https://nodejs.org/), **close and reopen PowerShell / Command Prompt** so your system updates your `PATH` environment variable.

---

## Developer Guide (Modifying Source Code)

If you wish to edit TypeScript source files and rebuild:

```bash
# 1. Install dependencies
npm install

# 2. Build the extension bundle (outputs to dist/)
npm run build

# 3. Run the automated test suite (49 unit & integration tests)
npm test
```

---

## Features
- **Ashby Support**: Single-page and multi-page Ashby forms, custom questions, dropdowns, and file upload.
- **Workday Support**:
  - Step 1: Personal info, legal name, address, state normalization (`TX` -> `Texas`), phone device type fallback (`Home` / `Mobile`).
  - Step 2: Multi-card work experience and education without date collision.
  - Step 3: Application questionnaire radio buttons and text areas.
  - Step 4: Voluntary self-identification (disability, veteran, race, gender) with electronic signature.
- **Smart Matching**: Country disambiguation (prevents selecting Minor Outlying Islands), phone country code matching, and custom QA pattern matching.
