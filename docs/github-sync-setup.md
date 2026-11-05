# Cloud sync of saved projects (GitHub): setup

This copies the projects you save in the tools to a **private** GitHub repository, so the same projects are on every computer and phone you use. The browser's own list stays the working copy. The tools work offline exactly as before, and changes are sent to GitHub when it can be reached.

You do this once per GitHub account (steps 1 and 2) and once per device and browser (step 3).

Tools with sync (2026-11-05): Abutment Calculator (Projects… dialog), ASCE7-16 Load Generator, Base Plate & Anchor Designer, Bridge Geometry (Library panel), Bridge Substructure Loading, Concrete Beam Capacity (Development & Splice tab, the rebar calculator), Elastomeric Bearing Design (Projects… dialog), Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design, Steel Bridge Design (GirderDetail, Project tab → Saved projects…; the modules' part of a project), Steel Bridge Design (new app, Saved projects…), Stone Masonry Arch Load Rating, Timber Beam Check. Not yet: tools with their own project dialogs (Pile Designer, MIDAS MCT generator (index.html), LL & DL Distribution, Prestressed Bridge Design). The list is kept in `shared/README.md` (row `github-sync.js`).

## What is synced, and what is not

- **Synced:** named projects in a tool's **Saved projects** list. Each one becomes a file `projects/<tool>/<project name>.json` in the repository. The file is the same as the tool's **Export JSON**, so you can also download it from github.com and use **Import JSON**.
- **Not synced:** autosave (the inputs open now, kept while you work), undo history, and anything else in the browser.
- **Nothing is deleted on GitHub unless you say so.** Deleting a project in the Saved projects dialog asks whether to delete the GitHub copy too. Deleting with a tool's own Delete button deletes only the browser copy.
- **Nothing is overwritten silently.** If a project was changed on two devices, both are kept: your version is saved as `<name> (conflict <device> <date>)`, here and on GitHub, and a notice says so. In Saved projects, the project shows **conflict** with two buttons: **Use GitHub version** or **Keep mine**.

## 1. Create the private repository (once)

1. Sign in at https://github.com.
2. Top right, click **+**, then **New repository**.
3. **Owner:** your account (`mlococo88`). **Repository name:** `structural-projects`. You can use another name; enter the same name in step 3.
4. Choose **Private**. This matters: a public repository can be read by anyone.
5. Tick **Add a README file**. A new repository needs a first file before the tools can write to it.
6. Click **Create repository**.

## 2. Create the access token (once, and again when it expires)

A fine-grained personal access token lets the tools write to that one repository, and to nothing else.

1. On github.com, click your picture (top right), then **Settings**.
2. In the left column, at the bottom, click **Developer settings**.
3. Click **Personal access tokens**, then **Fine-grained tokens**, then **Generate new token**.
4. **Token name:** for example `Structural tools sync`.
5. **Expiration:** pick a date, for example 90 days or 1 year. When it expires, sync stops and the dialog says the token was refused. Make a new token and paste it in again (step 3).
6. **Resource owner:** your account.
7. **Repository access:** choose **Only select repositories**, then pick `structural-projects` only.
8. **Permissions** (Repository permissions): find **Contents** and set it to **Read and write**. Leave everything else at **No access**. GitHub adds **Metadata: Read-only** by itself; that is expected.
9. Click **Generate token**.
10. Copy the token (it starts with `github_pat_`). GitHub shows it **only once**. Keep it in your password manager if you want to use it on another device; otherwise make a new token for each device.

## 3. Paste it into the tools (once per device and browser)

1. Open a tool with sync (for example `Spread Footing.html`).
2. Click **Saved projects…**, then **Cloud sync (GitHub)…** at the top of the dialog.
3. Check **GitHub account** (`mlococo88`), **Repository** (`structural-projects`) and **Branch** (`main`).
4. Paste the token into **Fine-grained access token**.
5. Optional: give **This device's name**, for example `Work laptop`. It is used in the name of conflict copies.
6. Click **Test connection**. It should say:
   - "Connected to mlococo88/structural-projects."
   - "The repository is private."
   - "Branch "main" found."

   If it says the repository is **PUBLIC**, make it private first (repository **Settings**, bottom of the page, **Change visibility**).
7. Click **Close**. The setting is shared by every tool opened from the same folder in the same browser, so you do this once per browser.
8. The first time each tool's Saved projects dialog is opened with sync on, it offers **Upload all** for the projects already in that browser. Nothing in the browser is deleted or changed. **Not now** leaves them local; each one then has its own **Upload** button.

## Day to day

- Save projects as usual. Within a few seconds each one is copied to GitHub.
- Saved projects shows a **GitHub** column:

  | Status | Meaning |
  |---|---|
  | synced | Same in this browser and on GitHub. |
  | waiting to upload | Saved here and not yet on GitHub (offline, or GitHub was busy). It is sent automatically. **Sync now** tries at once. |
  | this browser only | Never uploaded (from before sync was on). **Upload** sends it. |
  | GitHub newer | Changed on another device. **Get GitHub version** brings it here. |
  | conflict | Changed both here and on another device. Your version is already kept as a conflict copy. Choose **Use GitHub version** or **Keep mine**. |
  | on GitHub only | Listed under "On GitHub only". **Open** loads it into the tool, **Download to this browser** adds it to the list, **Delete from GitHub** deletes it (asks first). |

- On a phone or another computer: set up step 3 there, open the tool, click **Saved projects…**. Projects from other devices are under "On GitHub only". Click **Open**.
- Problems are shown in the bar at the top of Saved projects (offline, token refused, rate limit). Saves wait and are retried. Nothing is lost locally.

## From the home page (tools.html)

- **Saved projects** (the panel above the engineer checks, or `tools.html#projects`) lists the projects saved in this browser by every app, grouped by app, with a search box and an app filter. With sync set up, opening it reads the list of files on GitHub (one request) and shows the same statuses as the apps' dialogs (table above), plus the projects that are on GitHub only. Nothing is written while you only look.
- **Sync all to GitHub…** (it asks first) does each app's **Upload all** in one go: every project that is not on GitHub yet, or changed in this browser, is uploaded, with the same file as the app makes (its Export JSON). A project also changed on another device is not overwritten: both are kept, as in the apps. Nothing is deleted, here or on GitHub. Afterwards each app shows its projects as **synced** and does not upload them again.
- Getting a GitHub version, choosing after a conflict, opening a GitHub-only project and deleting are done in the app: click the project (or the app's name) to open the app, then **Saved projects…**. Clicking does not load the project.
- With sync off, the panel only reads this browser's lists: no request to GitHub and nothing written.
- Apps on the home page list: those in `shared/project-registry.js`. An app whose sync is added later appears there once it has an entry. An entry marked list-only shows the projects and their status but leaves uploading to the app ("open the app to sync").

## Removing the token

- **From one device:** Saved projects… → Cloud sync (GitHub)… → **Forget token on this device**. Sync stops on that device; the projects stay in the browser and on GitHub.
- **Everywhere (revoke):** github.com → your picture → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → click the token → **Delete** (at the bottom). Every device using it stops syncing at once. Do this at once if a device is lost or the token may have been seen by someone else.

## Security notes

- The token is stored in **this browser's storage** on this device, in plain form (the browser has no safer place for a page opened from a file). Anyone who can use this browser profile could read it. Use **Forget token on this device** on shared or borrowed computers.
- The token is sent only to `api.github.com`, only in the request header, never in a web address. It is never shown again after you paste it (only its last four characters), never written to the console, and never part of a project file or an Export JSON.
- Limit the damage if it leaks: a token limited to the one repository with Contents only cannot reach your other repositories or your account settings. Use an expiry date.

## Limits

- Not yet tested against the real GitHub service from a page opened as a file (`file://`). GitHub's API allows browser requests from any page, including file pages, so it is expected to work. It was tested here against a stand-in GitHub that answers the same way. If **Test connection** says GitHub could not be reached on the work laptop while github.com opens in the browser, the company network may block `api.github.com`.
- GitHub limits requests to 5,000 per hour per token. The tools use a few per save, so this is reached only in unusual cases. When it is, sync waits and resumes by itself.
- Very large repositories (over 100,000 files) are not supported for listing.
