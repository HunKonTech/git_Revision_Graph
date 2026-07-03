/**
 * Lightweight in-webview localization.
 *
 * The UI ships in English by default; the user can switch language from the
 * settings panel. The choice is persisted in localStorage (available in both
 * the VS Code / Visual Studio webviews and the dev browser harness), so it
 * survives reloads without involving the host.
 */

export type Lang = "en" | "hu" | "zh" | "ru";

export const DEFAULT_LANG: Lang = "en";

/** Languages offered in the settings dropdown, in display order. */
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hu", label: "Magyar" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
];

/** All user-facing strings. `{n}` style placeholders are filled by t(). */
type Dict = {
  "toolbar.refresh": string;
  "toolbar.fetch": string;
  "toolbar.pull": string;
  "toolbar.push": string;
  "toolbar.sync": string;
  "toolbar.jumpHead": string;
  "toolbar.reset": string;
  "toolbar.settings": string;
  "details.header": string;
  "details.close": string;
  "details.sha": string;
  "details.shortSha": string;
  "details.message": string;
  "details.author": string;
  "details.date": string;
  "details.labels": string;
  "details.location": string;
  "details.currentHead": string;
  "settings.title": string;
  "settings.language": string;
  "settings.theme": string;
  "settings.themeLight": string;
  "settings.themeDark": string;
  "settings.themeLightHint": string;
  "settings.themeDarkHint": string;
  "settings.mainBranch": string;
  "settings.mainBranchAuto": string;
  "settings.mainBranchSearch": string;
  "settings.mainBranchNoMatch": string;
  "settings.display": string;
  "settings.displayModern": string;
  "settings.displayClassic": string;
  "settings.displayModernHint": string;
  "settings.displayClassicHint": string;
  "settings.sectionGeneral": string;
  "settings.sectionGraph": string;
  "settings.sectionChanges": string;
  "settings.diffMinimap": string;
  "settings.diffMinimapOn": string;
  "settings.diffMinimapOff": string;
  "settings.diffMinimapOnHint": string;
  "settings.diffMinimapOffHint": string;
  "settings.svnBranchDialog": string;
  "settings.svnBranchDialogHint": string;
  "settings.branchDialog": string;
  "settings.branchDialogSvnTitle": string;
  "settings.branchDialogNativeVscode": string;
  "settings.branchDialogNativeVs": string;
  "settings.branchDialogNativeHint": string;
  "settings.close": string;
  "settings.done": string;
  "settings.sectionAdvanced": string;
  "settings.gitSource": string;
  "settings.gitSourceBuiltin": string;
  "settings.gitSourceBuiltinHint": string;
  "settings.gitSourceCustom": string;
  "settings.gitSourceCustomHint": string;
  "settings.gitPath": string;
  "settings.gitPathPlaceholder": string;
  "settings.gitPathBrowse": string;
  "settings.jargon": string;
  "settings.jargonTranslate": string;
  "settings.jargonEnglish": string;
  "settings.jargonTranslateHint": string;
  "settings.jargonEnglishHint": string;
  "legend.title": string;
  "legend.head": string;
  "legend.local": string;
  "legend.remote": string;
  "legend.remoteOnly": string;
  "legend.tag": string;
  "legend.commit": string;
  "legend.stash": string;
  "menu.jumpHead": string;
  "menu.resetView": string;
  "menu.createBranch": string;
  "menu.checkout": string;
  "menu.copySha": string;
  "menu.deleteBranch": string;
  "menu.pushBranch": string;
  "menu.renameBranch": string;
  "menu.renameCommit": string;
  "menu.undoCommit": string;
  "menu.viewChanges": string;
  "menu.mergeBranch": string;
  "changes.title": string;
  "changes.tabChanged": string;
  "changes.tabAll": string;
  "changes.added": string;
  "changes.modified": string;
  "changes.deleted": string;
  "changes.renamed": string;
  "changes.noChanges": string;
  "changes.loading": string;
  "changes.selectFile": string;
  "changes.original": string;
  "changes.changed": string;
  "changes.binary": string;
  "changes.tooLarge": string;
  "changes.renamedFrom": string;
  "changes.close": string;
  "changes.prevChange": string;
  "changes.nextChange": string;
  "changes.collapseAll": string;
  "changes.expandAll": string;
  "changes.searchPlaceholder": string;
  "changes.noSearchResults": string;
  "changes.maximize": string;
  "changes.restore": string;
  "menu.stashApply": string;
  "menu.stashPop": string;
  "menu.stashDrop": string;
  "merge.title": string;
  "merge.route": string;
  "merge.source": string;
  "merge.target": string;
  "merge.loading": string;
  "merge.upToDate": string;
  "merge.fastForward": string;
  "merge.summary": string;
  "merge.conflictsWarning": string;
  "merge.noChanges": string;
  "merge.files": string;
  "merge.added": string;
  "merge.modified": string;
  "merge.deleted": string;
  "merge.conflict": string;
  "merge.message": string;
  "merge.messagePlaceholder": string;
  "merge.messageFfHint": string;
  "merge.noFastForward": string;
  "merge.noFastForwardHint": string;
  "merge.merge": string;
  "merge.cancel": string;
  "merge.previewError": string;
  "newBranch.title": string;
  "newBranch.startPoint": string;
  "newBranch.startPointOn": string;
  "newBranch.location": string;
  "newBranch.locationRoot": string;
  "newBranch.name": string;
  "newBranch.namePlaceholder": string;
  "newBranch.fullName": string;
  "newBranch.invalid": string;
  "newBranch.exists": string;
  "newBranch.checkout": string;
  "newBranch.create": string;
  "newBranch.cancel": string;
  "status.loading": string;
  "status.summary": string;
  "status.branchCreated": string;
  "status.error": string;
  "status.opFailed": string;
  "status.fetching": string;
  "status.pulling": string;
  "status.pushing": string;
  "status.syncing": string;
  "status.noHead": string;
  "status.undoing": string;
  "status.commitUndone": string;
  "status.undoConflict": string;
  "status.stashApplying": string;
  "status.stashPopping": string;
  "status.stashDropping": string;
  "status.stashApplied": string;
  "status.stashPopped": string;
  "status.stashDropped": string;
  "status.stashConflict": string;
  "status.merging": string;
  "status.merged": string;
  "status.mergeConflict": string;
  "search.title": string;
  "search.tooltip": string;
  "search.placeholder": string;
  "search.filter": string;
  "search.highlight": string;
  "search.filterMode": string;
  "search.filterModeFilter": string;
  "search.filterModeHighlight": string;
  "search.filterModeHint": string;
  "search.visibility": string;
  "search.visibilityToolbar": string;
  "search.visibilityAlwaysVisible": string;
  "search.visibilityHint": string;
};

const DICTS: Record<Lang, Dict> = {
  en: {
    "toolbar.refresh": "⟳ Refresh",
    "toolbar.fetch": "⤓ Fetch",
    "toolbar.pull": "⇩ Pull",
    "toolbar.push": "⇧ Push",
    "toolbar.sync": "⇅ Sync",
    "toolbar.jumpHead": "⌖ Go to checkout",
    "toolbar.reset": "⤢ Reset view",
    "toolbar.settings": "⚙ Settings",
    "details.header": "Commit Details",
    "details.close": "Close",
    "details.sha": "SHA",
    "details.shortSha": "Short SHA",
    "details.message": "Message",
    "details.author": "Author",
    "details.date": "Date",
    "details.labels": "Labels",
    "details.location": "Location",
    "details.currentHead": "HEAD — current checkout",
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.themeLightHint": "Light background, dark text.",
    "settings.themeDarkHint": "Dark background, light text.",
    "settings.mainBranch": "Main branch",
    "settings.mainBranchAuto": "Automatic",
    "settings.mainBranchSearch": "Search branches…",
    "settings.mainBranchNoMatch": "No matching branches",
    "settings.display": "Display style",
    "settings.displayModern": "Modern",
    "settings.displayClassic": "Classic",
    "settings.displayModernHint": "Free canvas — drag to pan, scroll to zoom.",
    "settings.displayClassicHint": "Fixed canvas — trunk pinned left, no zoom, scroll only (like the SVN revision graph).",
    "settings.sectionGeneral": "General",
    "settings.sectionGraph": "Graph",
    "settings.sectionChanges": "Changes view",
    "settings.diffMinimap": "Diff minimap",
    "settings.diffMinimapOn": "Shown",
    "settings.diffMinimapOff": "Hidden",
    "settings.diffMinimapOnHint": "Show a VS Code-style overview strip beside the diff — drag it to scroll; change markers included.",
    "settings.diffMinimapOffHint": "No overview strip — scroll the diff normally.",
    "settings.svnBranchDialog": "SVN-style branch dialog",
    "settings.svnBranchDialogHint":
      "Show a folder-tree picker when creating a branch (instead of a simple prompt).",
    "settings.branchDialog": "Branch dialog",
    "settings.branchDialogSvnTitle": "SVN-style",
    "settings.branchDialogNativeVscode": "VS Code style",
    "settings.branchDialogNativeVs": "Visual Studio style",
    "settings.branchDialogNativeHint": "Your IDE's built-in branch prompt.",
    "settings.close": "Close",
    "settings.done": "Done",
    "settings.sectionAdvanced": "Advanced",
    "settings.gitSource": "Git executable",
    "settings.gitSourceBuiltin": "Built-in",
    "settings.gitSourceBuiltinHint": "Use the git binary from the IDE's built-in Git extension.",
    "settings.gitSourceCustom": "Custom path",
    "settings.gitSourceCustomHint": "Specify the path to your own git executable (e.g. /usr/bin/git or C:\\…\\git.exe).",
    "settings.gitPath": "Path to git",
    "settings.gitPathPlaceholder": "/usr/bin/git",
    "settings.gitPathBrowse": "Browse…",
    "settings.jargon": "Git terms",
    "settings.jargonTranslate": "Translate",
    "settings.jargonEnglish": "Keep in English",
    "settings.jargonTranslateHint": "Translate Git terms (pull, push, commit, branch…) into the interface language.",
    "settings.jargonEnglishHint": "Keep Git terms (pull, push, commit, branch…) in English; translate everything else.",
    "legend.title": "Legend",
    "legend.head": "HEAD / current branch",
    "legend.local": "Local branch",
    "legend.remote": "Remote branch",
    "legend.remoteOnly": "Only in the cloud (not pulled)",
    "legend.tag": "Tag (version)",
    "legend.commit": "Commit",
    "legend.stash": "Stash (shelved work)",
    "menu.jumpHead": "⌖ Go to checkout",
    "menu.resetView": "⤢ Reset view",
    "menu.createBranch": "Create branch from here…",
    "menu.checkout": "Checkout this commit",
    "menu.copySha": "Copy commit SHA",
    "menu.pushBranch": 'Push branch "{name}"',
    "menu.renameBranch": 'Rename branch "{name}"…',
    "menu.deleteBranch": 'Delete branch "{name}"…',
    "menu.renameCommit": "Rename commit message…",
    "menu.undoCommit": "Undo commit (keep changes)…",
    "menu.viewChanges": "View changes…",
    "menu.mergeBranch": 'Merge "{source}" into "{target}"…',
    "changes.title": "Changes in {sha}",
    "changes.tabChanged": "Changed",
    "changes.tabAll": "All Files",
    "changes.added": "Added",
    "changes.modified": "Modified",
    "changes.deleted": "Deleted",
    "changes.renamed": "Renamed",
    "changes.noChanges": "This commit changes no files.",
    "changes.loading": "Loading diff…",
    "changes.selectFile": "Select a file to see its changes.",
    "changes.original": "Original",
    "changes.changed": "This commit",
    "changes.binary": "Binary file — no text diff to show.",
    "changes.tooLarge": "File is too large to diff.",
    "changes.renamedFrom": "Renamed from {path}",
    "changes.close": "Close",
    "changes.prevChange": "Previous change",
    "changes.nextChange": "Next change",
    "changes.collapseAll": "Collapse all folders",
    "changes.expandAll": "Expand all folders",
    "changes.searchPlaceholder": "Search files…",
    "changes.noSearchResults": "No files match your search.",
    "changes.maximize": "Maximize",
    "changes.restore": "Restore size",
    "menu.stashApply": "Apply stash",
    "menu.stashPop": "Pop stash (apply & remove)",
    "menu.stashDrop": "Drop stash…",
    "merge.title": "Merge Branch",
    "merge.route": "Merging into the current branch",
    "merge.source": "From (source)",
    "merge.target": "Into (current)",
    "merge.loading": "Analyzing merge…",
    "merge.upToDate": "Already up to date — nothing to merge.",
    "merge.fastForward": "Fast-forward — no merge commit needed (tick “Create a merge commit” to force one).",
    "merge.summary": "{files} file(s) changed, {conflicts} conflict(s).",
    "merge.conflictsWarning": "This merge has conflicts — you can still merge, then resolve them in the editor.",
    "merge.noChanges": "No file changes.",
    "merge.files": "Resulting changes",
    "merge.added": "Added",
    "merge.modified": "Modified",
    "merge.deleted": "Deleted",
    "merge.conflict": "Conflict",
    "merge.message": "Merge commit message",
    "merge.messagePlaceholder": "Merge branch 'source'",
    "merge.messageFfHint": "Ignored on a fast-forward merge (no commit is created).",
    "merge.noFastForward": "Create a merge commit (no fast-forward)",
    "merge.noFastForwardHint": "Always record a merge commit, even when the branch could fast-forward.",
    "merge.merge": "Merge",
    "merge.cancel": "Cancel",
    "merge.previewError": "Couldn't compute a preview: {message}",
    "newBranch.title": "Create Branch",
    "newBranch.startPoint": "New branch starting from {sha}",
    "newBranch.startPointOn": "on {refs}",
    "newBranch.location": "Location",
    "newBranch.locationRoot": "(root)",
    "newBranch.name": "Branch name",
    "newBranch.namePlaceholder": "my-branch",
    "newBranch.fullName": "Full name: {name}",
    "newBranch.invalid": "Invalid branch name",
    "newBranch.exists": "A branch with this name already exists",
    "newBranch.checkout": "Checkout branch after creation",
    "newBranch.create": "Create",
    "newBranch.cancel": "Cancel",
    "status.loading": "Loading graph…",
    "status.summary": "{repo}Showing {commits} commits, {refs} refs",
    "status.branchCreated": 'Created branch "{name}" at {sha}',
    "status.error": "Error: {message}",
    "status.opFailed": "Operation failed",
    "status.fetching": "Fetching…",
    "status.pulling": "Pulling…",
    "status.pushing": "Pushing…",
    "status.syncing": "Syncing…",
    "status.noHead": "No current checkout found in the graph.",
    "status.undoing": "Undoing commit…",
    "status.commitUndone": "Commit undone — changes are back in the working tree.",
    "status.undoConflict": "Undo hit conflicts — resolve them in the editor, then continue.",
    "status.stashApplying": "Applying stash…",
    "status.stashPopping": "Popping stash…",
    "status.stashDropping": "Dropping stash…",
    "status.stashApplied": "Stash applied.",
    "status.stashPopped": "Stash popped.",
    "status.stashDropped": "Stash dropped.",
    "status.stashConflict": "Stash conflicts — resolve them in the editor.",
    "status.merging": "Merging…",
    "status.merged": "Merge completed.",
    "status.mergeConflict": "Merge has conflicts — resolve them in the editor, then commit.",
    "search.title": "Search",
    "search.tooltip": "Search commits",
    "search.placeholder": "Search commits…",
    "search.filter": "Filter mode",
    "search.highlight": "Highlight mode",
    "search.filterMode": "Search display",
    "search.filterModeFilter": "Filter (hide non-matches)",
    "search.filterModeHighlight": "Highlight (show all, mark matches)",
    "search.filterModeHint": "Choose how search results are displayed in the graph.",
    "search.visibility": "Search location",
    "search.visibilityToolbar": "Toolbar button",
    "search.visibilityAlwaysVisible": "Always-visible bar",
    "search.visibilityHint": "Show search as a toolbar icon or persistent bar at the top.",
  },
  hu: {
    "toolbar.refresh": "⟳ Frissítés",
    "toolbar.fetch": "⤓ Fetch",
    "toolbar.pull": "⇩ Pull",
    "toolbar.push": "⇧ Push",
    "toolbar.sync": "⇅ Szinkron",
    "toolbar.jumpHead": "⌖ Ugrás a checkout-ra",
    "toolbar.reset": "⤢ Nézet visszaállítása",
    "toolbar.settings": "⚙ Beállítások",
    "details.header": "Commit részletei",
    "details.close": "Bezárás",
    "details.sha": "SHA",
    "details.shortSha": "Rövid SHA",
    "details.message": "Üzenet",
    "details.author": "Szerző",
    "details.date": "Dátum",
    "details.labels": "Címkék",
    "details.location": "Elhelyezkedés",
    "details.currentHead": "HEAD — itt áll a kód",
    "settings.title": "Beállítások",
    "settings.language": "Nyelv",
    "settings.theme": "Téma",
    "settings.themeLight": "Világos",
    "settings.themeDark": "Sötét",
    "settings.themeLightHint": "Világos háttér, sötét szöveg.",
    "settings.themeDarkHint": "Sötét háttér, világos szöveg.",
    "settings.mainBranch": "Fő ág",
    "settings.mainBranchAuto": "Automatikus",
    "settings.mainBranchSearch": "Ágak keresése…",
    "settings.mainBranchNoMatch": "Nincs találat",
    "settings.display": "Megjelenítés stílusa",
    "settings.displayModern": "Modern",
    "settings.displayClassic": "Klasszikus",
    "settings.displayModernHint": "Szabad vászon — húzással mozgatható, görgővel nagyítható.",
    "settings.displayClassicHint": "Rögzített vászon — a fő ág balra rögzítve, nincs nagyítás, csak görgetés (mint az SVN revision graph).",
    "settings.sectionGeneral": "Általános",
    "settings.sectionGraph": "Gráf",
    "settings.sectionChanges": "Változások nézet",
    "settings.diffMinimap": "Diff minitérkép",
    "settings.diffMinimapOn": "Látható",
    "settings.diffMinimapOff": "Rejtett",
    "settings.diffMinimapOnHint": "VS Code-stílusú áttekintő sáv a diff mellett — húzva görgethető; a változásokat is jelöli.",
    "settings.diffMinimapOffHint": "Nincs áttekintő sáv — a diff hagyományosan görgethető.",
    "settings.svnBranchDialog": "SVN-stílusú branch ablak",
    "settings.svnBranchDialogHint":
      "Branch létrehozásakor mappafa-választó jelenjen meg (egyszerű beírás helyett).",
    "settings.branchDialog": "Branch ablak",
    "settings.branchDialogSvnTitle": "SVN-stílus",
    "settings.branchDialogNativeVscode": "VS Code stílus",
    "settings.branchDialogNativeVs": "Visual Studio stílus",
    "settings.branchDialogNativeHint": "Az IDE beépített branch ablaka.",
    "settings.close": "Bezárás",
    "settings.done": "Kész",
    "settings.sectionAdvanced": "Speciális",
    "settings.gitSource": "Git futtatható fájl",
    "settings.gitSourceBuiltin": "Beépített",
    "settings.gitSourceBuiltinHint": "Az IDE beépített Git bővítményének git binárisát használja.",
    "settings.gitSourceCustom": "Egyéni útvonal",
    "settings.gitSourceCustomHint": "Adja meg a saját git futtatható fájl elérési útját (pl. /usr/bin/git vagy C:\\…\\git.exe).",
    "settings.gitPath": "Git elérési útja",
    "settings.gitPathPlaceholder": "/usr/bin/git",
    "settings.gitPathBrowse": "Tallózás…",
    "settings.jargon": "Git szakkifejezések",
    "settings.jargonTranslate": "Fordítás",
    "settings.jargonEnglish": "Angolul hagyás",
    "settings.jargonTranslateHint": "A git szakszavak (pull, push, commit, branch…) lefordítása a felület nyelvére.",
    "settings.jargonEnglishHint": "A git szakszavak (pull, push, commit, branch…) angolul maradnak; minden más lefordítva.",
    "legend.title": "Jelmagyarázat",
    "legend.head": "HEAD / aktuális branch",
    "legend.local": "Lokális branch",
    "legend.remote": "Távoli branch (remote)",
    "legend.remoteOnly": "Csak a felhőben (nincs pull-olva)",
    "legend.tag": "Tag (verzió)",
    "legend.commit": "Commit",
    "legend.stash": "Stash (félretett munka)",
    "menu.jumpHead": "⌖ Ugrás a checkout-ra",
    "menu.resetView": "⤢ Nézet visszaállítása",
    "menu.createBranch": "Branch létrehozása innen…",
    "menu.checkout": "Checkout erre a commitra",
    "menu.copySha": "Commit SHA másolása",
    "menu.pushBranch": '"{name}" branch pusholása',
    "menu.renameBranch": '"{name}" branch átnevezése…',
    "menu.deleteBranch": '"{name}" branch törlése…',
    "menu.renameCommit": "Commit üzenet átnevezése…",
    "menu.undoCommit": "Commit visszavonása (változások megtartása)…",
    "menu.viewChanges": "Változások megtekintése…",
    "menu.mergeBranch": '"{source}" beolvasztása ide: "{target}"…',
    "changes.title": "Változások — {sha}",
    "changes.tabChanged": "Változott",
    "changes.tabAll": "Összes fájl",
    "changes.added": "Hozzáadva",
    "changes.modified": "Módosítva",
    "changes.deleted": "Törölve",
    "changes.renamed": "Átnevezve",
    "changes.noChanges": "Ez a commit nem módosít fájlokat.",
    "changes.loading": "Diff betöltése…",
    "changes.selectFile": "Válassz egy fájlt a változások megtekintéséhez.",
    "changes.original": "Eredeti",
    "changes.changed": "Ebben a commitban",
    "changes.binary": "Bináris fájl — nincs szöveges diff.",
    "changes.tooLarge": "A fájl túl nagy a diff megjelenítéséhez.",
    "changes.renamedFrom": "Átnevezve innen: {path}",
    "changes.close": "Bezárás",
    "changes.prevChange": "Előző változás",
    "changes.nextChange": "Következő változás",
    "changes.collapseAll": "Minden mappa becsukása",
    "changes.expandAll": "Minden mappa kinyitása",
    "changes.searchPlaceholder": "Fájlok keresése…",
    "changes.noSearchResults": "Nincs a keresésnek megfelelő fájl.",
    "changes.maximize": "Nagyítás",
    "changes.restore": "Eredeti méret",
    "menu.stashApply": "Stash alkalmazása",
    "menu.stashPop": "Stash kivétele (alkalmaz és töröl)",
    "menu.stashDrop": "Stash eldobása…",
    "merge.title": "Branch beolvasztása (merge)",
    "merge.route": "Beolvasztás az aktuális branchbe",
    "merge.source": "Honnan (forrás)",
    "merge.target": "Ide (aktuális)",
    "merge.loading": "Merge elemzése…",
    "merge.upToDate": "Már naprakész — nincs mit beolvasztani.",
    "merge.fastForward": "Fast-forward — nem kell merge commit (pipáld be a „Merge commit létrehozása”-t, ha mégis kell).",
    "merge.summary": "{files} fájl változik, {conflicts} konfliktus.",
    "merge.conflictsWarning": "Ennek a merge-nek vannak konfliktusai — beolvaszthatod, majd a szerkesztőben feloldhatod őket.",
    "merge.noChanges": "Nincs fájlváltozás.",
    "merge.files": "Eredő változások",
    "merge.added": "Hozzáadva",
    "merge.modified": "Módosítva",
    "merge.deleted": "Törölve",
    "merge.conflict": "Konfliktus",
    "merge.message": "Merge commit üzenete",
    "merge.messagePlaceholder": "Merge branch 'forrás'",
    "merge.messageFfHint": "Fast-forward merge esetén nincs hatása (nem jön létre commit).",
    "merge.noFastForward": "Merge commit létrehozása (nincs fast-forward)",
    "merge.noFastForwardHint": "Mindig készüljön merge commit, akkor is, ha lehetne fast-forward.",
    "merge.merge": "Beolvasztás",
    "merge.cancel": "Mégse",
    "merge.previewError": "Az előnézet nem számítható ki: {message}",
    "newBranch.title": "Branch létrehozása",
    "newBranch.startPoint": "Új branch innen indul: {sha}",
    "newBranch.startPointOn": "({refs})",
    "newBranch.location": "Hely",
    "newBranch.locationRoot": "(gyökér)",
    "newBranch.name": "Branch neve",
    "newBranch.namePlaceholder": "uj-branch",
    "newBranch.fullName": "Teljes név: {name}",
    "newBranch.invalid": "Érvénytelen branch név",
    "newBranch.exists": "Már létezik ilyen nevű branch",
    "newBranch.checkout": "Checkout a branch-re létrehozás után",
    "newBranch.create": "Létrehozás",
    "newBranch.cancel": "Mégse",
    "status.loading": "Gráf betöltése…",
    "status.summary": "{repo}{commits} commit, {refs} ref látható",
    "status.branchCreated": '"{name}" branch létrehozva itt: {sha}',
    "status.error": "Hiba: {message}",
    "status.opFailed": "A művelet sikertelen",
    "status.fetching": "Fetch folyamatban…",
    "status.pulling": "Pull folyamatban…",
    "status.pushing": "Push folyamatban…",
    "status.syncing": "Szinkronizálás…",
    "status.noHead": "Nincs aktuális checkout a gráfban.",
    "status.undoing": "Commit visszavonása…",
    "status.commitUndone": "Commit visszavonva — a változások visszakerültek a working tree-be.",
    "status.undoConflict": "A visszavonás konfliktusba ütközött — oldd fel a szerkesztőben, majd folytasd.",
    "status.stashApplying": "Stash alkalmazása…",
    "status.stashPopping": "Stash kivétele…",
    "status.stashDropping": "Stash eldobása…",
    "status.stashApplied": "Stash alkalmazva.",
    "status.stashPopped": "Stash kivéve.",
    "status.stashDropped": "Stash eldobva.",
    "status.stashConflict": "Stash konfliktus — oldd fel a szerkesztőben.",
    "status.merging": "Beolvasztás…",
    "status.merged": "A merge elkészült.",
    "status.mergeConflict": "A merge konfliktusos — oldd fel a szerkesztőben, majd commitold.",
    "search.title": "Keresés",
    "search.tooltip": "Commitok keresése",
    "search.placeholder": "Commitok keresése…",
    "search.filter": "Szűrés mód",
    "search.highlight": "Kiemelés mód",
    "search.filterMode": "Keresési megjelenítés",
    "search.filterModeFilter": "Szűrés (nem egyezők elrejtése)",
    "search.filterModeHighlight": "Kiemelés (összes mutatása, egyezők jelölése)",
    "search.filterModeHint": "Válaszd ki, hogyan jelenjenek meg a keresési eredmények a gráfban.",
    "search.visibility": "Keresés helye",
    "search.visibilityToolbar": "Toolbar gomb",
    "search.visibilityAlwaysVisible": "Mindig látható sáv",
    "search.visibilityHint": "A keresést toolbar ikonként vagy állandó sávként mutasd.",
  },
  zh: {
    "toolbar.refresh": "⟳ 刷新",
    "toolbar.fetch": "⤓ 抓取",
    "toolbar.pull": "⇩ 拉取",
    "toolbar.push": "⇧ 推送",
    "toolbar.sync": "⇅ 同步",
    "toolbar.jumpHead": "⌖ 跳转到检出位置",
    "toolbar.reset": "⤢ 重置视图",
    "toolbar.settings": "⚙ 设置",
    "details.header": "提交详情",
    "details.close": "关闭",
    "details.sha": "SHA",
    "details.shortSha": "短 SHA",
    "details.message": "信息",
    "details.author": "作者",
    "details.date": "日期",
    "details.labels": "标签",
    "details.location": "位置",
    "details.currentHead": "HEAD — 当前检出",
    "settings.title": "设置",
    "settings.language": "语言",
    "settings.theme": "主题",
    "settings.themeLight": "浅色",
    "settings.themeDark": "深色",
    "settings.themeLightHint": "浅色背景，深色文字。",
    "settings.themeDarkHint": "深色背景，浅色文字。",
    "settings.mainBranch": "主分支",
    "settings.mainBranchAuto": "自动",
    "settings.mainBranchSearch": "搜索分支…",
    "settings.mainBranchNoMatch": "没有匹配的分支",
    "settings.display": "显示样式",
    "settings.displayModern": "现代",
    "settings.displayClassic": "经典",
    "settings.displayModernHint": "自由画布 — 拖动平移，滚动缩放。",
    "settings.displayClassicHint": "固定画布 — 主干固定在左侧，无缩放，仅滚动（类似 SVN 修订图）。",
    "settings.sectionGeneral": "常规",
    "settings.sectionGraph": "图形",
    "settings.sectionChanges": "更改视图",
    "settings.diffMinimap": "差异缩略图",
    "settings.diffMinimapOn": "显示",
    "settings.diffMinimapOff": "隐藏",
    "settings.diffMinimapOnHint": "在差异旁显示 VS Code 风格的概览条 — 拖动它可滚动；包含更改标记。",
    "settings.diffMinimapOffHint": "无概览条 — 正常滚动差异。",
    "settings.svnBranchDialog": "SVN 风格分支对话框",
    "settings.svnBranchDialogHint":
      "创建分支时显示文件夹树选择器（而非简单的输入框）。",
    "settings.branchDialog": "分支对话框",
    "settings.branchDialogSvnTitle": "SVN 风格",
    "settings.branchDialogNativeVscode": "VS Code 风格",
    "settings.branchDialogNativeVs": "Visual Studio 风格",
    "settings.branchDialogNativeHint": "您 IDE 内置的分支输入框。",
    "settings.close": "关闭",
    "settings.done": "完成",
    "settings.sectionAdvanced": "高级",
    "settings.gitSource": "Git 可执行文件",
    "settings.gitSourceBuiltin": "内置",
    "settings.gitSourceBuiltinHint": "使用 IDE 内置 Git 扩展的 git 二进制文件。",
    "settings.gitSourceCustom": "自定义路径",
    "settings.gitSourceCustomHint": "指定您自己的 git 可执行文件路径（例如 /usr/bin/git 或 C:\\…\\git.exe）。",
    "settings.gitPath": "Git 路径",
    "settings.gitPathPlaceholder": "/usr/bin/git",
    "settings.gitPathBrowse": "浏览…",
    "settings.jargon": "Git 术语",
    "settings.jargonTranslate": "翻译",
    "settings.jargonEnglish": "保留英文",
    "settings.jargonTranslateHint": "将 Git 术语（pull、push、commit、branch…）翻译成界面语言。",
    "settings.jargonEnglishHint": "Git 术语（pull、push、commit、branch…）保留英文；其余全部翻译。",
    "legend.title": "图例",
    "legend.head": "HEAD / 当前分支",
    "legend.local": "本地分支",
    "legend.remote": "远程分支",
    "legend.remoteOnly": "仅在云端（尚未拉取）",
    "legend.tag": "标签（版本）",
    "legend.commit": "提交",
    "legend.stash": "储藏（暂存的工作）",
    "menu.jumpHead": "⌖ 跳转到检出位置",
    "menu.resetView": "⤢ 重置视图",
    "menu.createBranch": "从此处创建分支…",
    "menu.checkout": "检出此提交",
    "menu.copySha": "复制提交 SHA",
    "menu.pushBranch": '推送分支 “{name}”',
    "menu.renameBranch": '重命名分支 “{name}”…',
    "menu.deleteBranch": '删除分支 “{name}”…',
    "menu.renameCommit": "重命名提交信息…",
    "menu.undoCommit": "撤销提交（保留更改）…",
    "menu.viewChanges": "查看更改…",
    "menu.mergeBranch": '将 “{source}” 合并到 “{target}”…',
    "changes.title": "{sha} 中的更改",
    "changes.tabChanged": "已更改",
    "changes.tabAll": "所有文件",
    "changes.added": "已添加",
    "changes.modified": "已修改",
    "changes.deleted": "已删除",
    "changes.renamed": "已重命名",
    "changes.noChanges": "此提交未更改任何文件。",
    "changes.loading": "正在加载差异…",
    "changes.selectFile": "选择一个文件以查看其更改。",
    "changes.original": "原始",
    "changes.changed": "此提交",
    "changes.binary": "二进制文件 — 无文本差异可显示。",
    "changes.tooLarge": "文件太大，无法显示差异。",
    "changes.renamedFrom": "重命名自 {path}",
    "changes.close": "关闭",
    "changes.prevChange": "上一处更改",
    "changes.nextChange": "下一处更改",
    "changes.collapseAll": "折叠所有文件夹",
    "changes.expandAll": "展开所有文件夹",
    "changes.searchPlaceholder": "搜索文件…",
    "changes.noSearchResults": "没有匹配的文件。",
    "changes.maximize": "最大化",
    "changes.restore": "还原大小",
    "menu.stashApply": "应用储藏",
    "menu.stashPop": "弹出储藏（应用并移除）",
    "menu.stashDrop": "丢弃储藏…",
    "merge.title": "合并分支",
    "merge.route": "合并到当前分支",
    "merge.source": "从（来源）",
    "merge.target": "到（当前）",
    "merge.loading": "正在分析合并…",
    "merge.upToDate": "已是最新 — 无需合并。",
    "merge.fastForward": "快进 — 无需合并提交（勾选“创建合并提交”可强制创建）。",
    "merge.summary": "{files} 个文件更改，{conflicts} 处冲突。",
    "merge.conflictsWarning": "此合并存在冲突 — 您仍可合并，然后在编辑器中解决它们。",
    "merge.noChanges": "无文件更改。",
    "merge.files": "结果更改",
    "merge.added": "已添加",
    "merge.modified": "已修改",
    "merge.deleted": "已删除",
    "merge.conflict": "冲突",
    "merge.message": "合并提交信息",
    "merge.messagePlaceholder": "Merge branch 'source'",
    "merge.messageFfHint": "快进合并时忽略（不会创建提交）。",
    "merge.noFastForward": "创建合并提交（不快进）",
    "merge.noFastForwardHint": "始终记录合并提交，即使分支可以快进。",
    "merge.merge": "合并",
    "merge.cancel": "取消",
    "merge.previewError": "无法计算预览：{message}",
    "newBranch.title": "创建分支",
    "newBranch.startPoint": "从 {sha} 开始的新分支",
    "newBranch.startPointOn": "位于 {refs}",
    "newBranch.location": "位置",
    "newBranch.locationRoot": "（根）",
    "newBranch.name": "分支名称",
    "newBranch.namePlaceholder": "my-branch",
    "newBranch.fullName": "完整名称：{name}",
    "newBranch.invalid": "无效的分支名称",
    "newBranch.exists": "已存在同名分支",
    "newBranch.checkout": "创建后检出分支",
    "newBranch.create": "创建",
    "newBranch.cancel": "取消",
    "status.loading": "正在加载图形…",
    "status.summary": "{repo}显示 {commits} 个提交，{refs} 个引用",
    "status.branchCreated": '已在 {sha} 创建分支 “{name}”',
    "status.error": "错误：{message}",
    "status.opFailed": "操作失败",
    "status.fetching": "正在抓取…",
    "status.pulling": "正在拉取…",
    "status.pushing": "正在推送…",
    "status.syncing": "正在同步…",
    "status.noHead": "在图形中未找到当前检出。",
    "status.undoing": "正在撤销提交…",
    "status.commitUndone": "提交已撤销 — 更改已回到工作树中。",
    "status.undoConflict": "撤销遇到冲突 — 请在编辑器中解决，然后继续。",
    "status.stashApplying": "正在应用储藏…",
    "status.stashPopping": "正在弹出储藏…",
    "status.stashDropping": "正在丢弃储藏…",
    "status.stashApplied": "储藏已应用。",
    "status.stashPopped": "储藏已弹出。",
    "status.stashDropped": "储藏已丢弃。",
    "status.stashConflict": "储藏冲突 — 请在编辑器中解决。",
    "status.merging": "正在合并…",
    "status.merged": "合并完成。",
    "status.mergeConflict": "合并存在冲突 — 请在编辑器中解决，然后提交。",
  },
  ru: {
    "toolbar.refresh": "⟳ Обновить",
    "toolbar.fetch": "⤓ Получить",
    "toolbar.pull": "⇩ Затянуть",
    "toolbar.push": "⇧ Отправить",
    "toolbar.sync": "⇅ Синхр.",
    "toolbar.jumpHead": "⌖ Перейти к checkout",
    "toolbar.reset": "⤢ Сбросить вид",
    "toolbar.settings": "⚙ Настройки",
    "details.header": "Сведения о коммите",
    "details.close": "Закрыть",
    "details.sha": "SHA",
    "details.shortSha": "Короткий SHA",
    "details.message": "Сообщение",
    "details.author": "Автор",
    "details.date": "Дата",
    "details.labels": "Метки",
    "details.location": "Расположение",
    "details.currentHead": "HEAD — текущий checkout",
    "settings.title": "Настройки",
    "settings.language": "Язык",
    "settings.theme": "Тема",
    "settings.themeLight": "Светлая",
    "settings.themeDark": "Тёмная",
    "settings.themeLightHint": "Светлый фон, тёмный текст.",
    "settings.themeDarkHint": "Тёмный фон, светлый текст.",
    "settings.mainBranch": "Основная ветка",
    "settings.mainBranchAuto": "Автоматически",
    "settings.mainBranchSearch": "Поиск веток…",
    "settings.mainBranchNoMatch": "Нет подходящих веток",
    "settings.display": "Стиль отображения",
    "settings.displayModern": "Современный",
    "settings.displayClassic": "Классический",
    "settings.displayModernHint": "Свободный холст — перетаскивайте для панорамирования, прокручивайте для масштабирования.",
    "settings.displayClassicHint": "Фиксированный холст — ствол закреплён слева, без масштабирования, только прокрутка (как в графе ревизий SVN).",
    "settings.sectionGeneral": "Общие",
    "settings.sectionGraph": "Граф",
    "settings.sectionChanges": "Просмотр изменений",
    "settings.diffMinimap": "Мини-карта различий",
    "settings.diffMinimapOn": "Показана",
    "settings.diffMinimapOff": "Скрыта",
    "settings.diffMinimapOnHint": "Показать полосу обзора в стиле VS Code рядом с различиями — перетаскивайте её для прокрутки; включая маркеры изменений.",
    "settings.diffMinimapOffHint": "Без полосы обзора — прокручивайте различия обычным образом.",
    "settings.svnBranchDialog": "Диалог веток в стиле SVN",
    "settings.svnBranchDialogHint":
      "Показывать выбор дерева папок при создании ветки (вместо простого ввода).",
    "settings.branchDialog": "Диалог ветки",
    "settings.branchDialogSvnTitle": "Стиль SVN",
    "settings.branchDialogNativeVscode": "Стиль VS Code",
    "settings.branchDialogNativeVs": "Стиль Visual Studio",
    "settings.branchDialogNativeHint": "Встроенный диалог ветки вашей IDE.",
    "settings.close": "Закрыть",
    "settings.done": "Готово",
    "settings.sectionAdvanced": "Дополнительно",
    "settings.gitSource": "Исполняемый файл Git",
    "settings.gitSourceBuiltin": "Встроенный",
    "settings.gitSourceBuiltinHint": "Использовать бинарный файл git из встроенного расширения Git вашей IDE.",
    "settings.gitSourceCustom": "Свой путь",
    "settings.gitSourceCustomHint": "Укажите путь к собственному исполняемому файлу git (например, /usr/bin/git или C:\\…\\git.exe).",
    "settings.gitPath": "Путь к git",
    "settings.gitPathPlaceholder": "/usr/bin/git",
    "settings.gitPathBrowse": "Обзор…",
    "settings.jargon": "Термины Git",
    "settings.jargonTranslate": "Переводить",
    "settings.jargonEnglish": "Оставить на английском",
    "settings.jargonTranslateHint": "Переводить термины Git (pull, push, commit, branch…) на язык интерфейса.",
    "settings.jargonEnglishHint": "Оставить термины Git (pull, push, commit, branch…) на английском; всё остальное переводить.",
    "legend.title": "Легенда",
    "legend.head": "HEAD / текущая ветка",
    "legend.local": "Локальная ветка",
    "legend.remote": "Удалённая ветка",
    "legend.remoteOnly": "Только в облаке (не затянуто)",
    "legend.tag": "Тег (версия)",
    "legend.commit": "Коммит",
    "legend.stash": "Stash (отложенная работа)",
    "menu.jumpHead": "⌖ Перейти к checkout",
    "menu.resetView": "⤢ Сбросить вид",
    "menu.createBranch": "Создать ветку отсюда…",
    "menu.checkout": "Переключиться на этот коммит",
    "menu.copySha": "Копировать SHA коммита",
    "menu.pushBranch": 'Отправить ветку «{name}»',
    "menu.renameBranch": 'Переименовать ветку «{name}»…',
    "menu.deleteBranch": 'Удалить ветку «{name}»…',
    "menu.renameCommit": "Изменить сообщение коммита…",
    "menu.undoCommit": "Отменить коммит (сохранить изменения)…",
    "menu.viewChanges": "Просмотреть изменения…",
    "menu.mergeBranch": 'Слить «{source}» в «{target}»…',
    "changes.title": "Изменения в {sha}",
    "changes.tabChanged": "Изменённые",
    "changes.tabAll": "Все файлы",
    "changes.added": "Добавлено",
    "changes.modified": "Изменено",
    "changes.deleted": "Удалено",
    "changes.renamed": "Переименовано",
    "changes.noChanges": "Этот коммит не меняет файлы.",
    "changes.loading": "Загрузка различий…",
    "changes.selectFile": "Выберите файл, чтобы увидеть его изменения.",
    "changes.original": "Оригинал",
    "changes.changed": "Этот коммит",
    "changes.binary": "Бинарный файл — нет текстовых различий.",
    "changes.tooLarge": "Файл слишком большой для показа различий.",
    "changes.renamedFrom": "Переименовано из {path}",
    "changes.close": "Закрыть",
    "changes.prevChange": "Предыдущее изменение",
    "changes.nextChange": "Следующее изменение",
    "changes.collapseAll": "Свернуть все папки",
    "changes.expandAll": "Развернуть все папки",
    "changes.searchPlaceholder": "Поиск файлов…",
    "changes.noSearchResults": "Нет файлов, соответствующих поиску.",
    "changes.maximize": "Развернуть",
    "changes.restore": "Восстановить размер",
    "menu.stashApply": "Применить stash",
    "menu.stashPop": "Извлечь stash (применить и удалить)",
    "menu.stashDrop": "Отбросить stash…",
    "merge.title": "Слияние ветки",
    "merge.route": "Слияние в текущую ветку",
    "merge.source": "Из (источник)",
    "merge.target": "В (текущая)",
    "merge.loading": "Анализ слияния…",
    "merge.upToDate": "Уже актуально — сливать нечего.",
    "merge.fastForward": "Перемотка — коммит слияния не нужен (отметьте «Создать коммит слияния», чтобы принудительно создать его).",
    "merge.summary": "Изменено файлов: {files}, конфликтов: {conflicts}.",
    "merge.conflictsWarning": "В этом слиянии есть конфликты — вы всё равно можете слить, а затем разрешить их в редакторе.",
    "merge.noChanges": "Нет изменений файлов.",
    "merge.files": "Итоговые изменения",
    "merge.added": "Добавлено",
    "merge.modified": "Изменено",
    "merge.deleted": "Удалено",
    "merge.conflict": "Конфликт",
    "merge.message": "Сообщение коммита слияния",
    "merge.messagePlaceholder": "Merge branch 'source'",
    "merge.messageFfHint": "Игнорируется при перемотке (коммит не создаётся).",
    "merge.noFastForward": "Создать коммит слияния (без перемотки)",
    "merge.noFastForwardHint": "Всегда создавать коммит слияния, даже если возможна перемотка.",
    "merge.merge": "Слить",
    "merge.cancel": "Отмена",
    "merge.previewError": "Не удалось вычислить предпросмотр: {message}",
    "newBranch.title": "Создать ветку",
    "newBranch.startPoint": "Новая ветка, начиная с {sha}",
    "newBranch.startPointOn": "на {refs}",
    "newBranch.location": "Расположение",
    "newBranch.locationRoot": "(корень)",
    "newBranch.name": "Имя ветки",
    "newBranch.namePlaceholder": "my-branch",
    "newBranch.fullName": "Полное имя: {name}",
    "newBranch.invalid": "Недопустимое имя ветки",
    "newBranch.exists": "Ветка с таким именем уже существует",
    "newBranch.checkout": "Переключиться на ветку после создания",
    "newBranch.create": "Создать",
    "newBranch.cancel": "Отмена",
    "status.loading": "Загрузка графа…",
    "status.summary": "{repo}Показано коммитов: {commits}, ссылок: {refs}",
    "status.branchCreated": 'Создана ветка «{name}» на {sha}',
    "status.error": "Ошибка: {message}",
    "status.opFailed": "Операция не удалась",
    "status.fetching": "Получение…",
    "status.pulling": "Затягивание…",
    "status.pushing": "Отправка…",
    "status.syncing": "Синхронизация…",
    "status.noHead": "Текущий checkout не найден в графе.",
    "status.undoing": "Отмена коммита…",
    "status.commitUndone": "Коммит отменён — изменения вернулись в рабочее дерево.",
    "status.undoConflict": "При отмене возникли конфликты — разрешите их в редакторе, затем продолжите.",
    "status.stashApplying": "Применение stash…",
    "status.stashPopping": "Извлечение stash…",
    "status.stashDropping": "Отбрасывание stash…",
    "status.stashApplied": "Stash применён.",
    "status.stashPopped": "Stash извлечён.",
    "status.stashDropped": "Stash отброшен.",
    "status.stashConflict": "Конфликты stash — разрешите их в редакторе.",
    "status.merging": "Слияние…",
    "status.merged": "Слияние завершено.",
    "status.mergeConflict": "В слиянии есть конфликты — разрешите их в редакторе, затем сделайте коммит.",
  },
};

export type MsgKey = keyof Dict;

/**
 * Git-jargon overrides. The "keep Git terms in English" setting decides whether
 * words like *pull*, *push*, *commit*, *branch*, *merge*, *stash*, *checkout* are
 * translated (the default) or kept in English while the rest of the sentence
 * stays in the active language.
 *
 * Rather than tokenize every string (which breaks on the inflection of Slavic /
 * agglutinative languages), each affected key carries up to two hand-authored
 * renderings:
 *   - `tr` — the fully translated form (used when the setting is OFF).
 *   - `en` — the same sentence with the Git term(s) left in English (used ON).
 * Whichever side is omitted falls back to the base string in {@link DICTS}, so a
 * key only lists the variant that differs from its base. English needs no
 * overrides — its base is already all-English.
 */
type JargonEntry = { en?: string; tr?: string };

const JARGON: Partial<Record<Lang, Partial<Record<MsgKey, JargonEntry>>>> = {
  hu: {
    "toolbar.fetch": { tr: "⤓ Lekérés" },
    "toolbar.pull": { tr: "⇩ Lehúzás" },
    "toolbar.push": { tr: "⇧ Feltöltés" },
    "toolbar.sync": { en: "⇅ Sync" },
    "toolbar.jumpHead": { tr: "⌖ Ugrás a váltásra" },
    "details.header": { tr: "Beküldés részletei" },
    "legend.head": { tr: "HEAD / aktuális ág" },
    "legend.local": { tr: "Lokális ág" },
    "legend.remote": { tr: "Távoli ág" },
    "legend.remoteOnly": { tr: "Csak a felhőben (nincs lehúzva)" },
    "legend.stash": { tr: "Félretett munka" },
    "menu.checkout": { tr: "Váltás erre a beküldésre" },
    "menu.copySha": { tr: "Beküldés SHA másolása" },
    "menu.pushBranch": { tr: '"{name}" ág feltöltése' },
    "menu.renameBranch": { tr: '"{name}" ág átnevezése…' },
    "menu.deleteBranch": { tr: '"{name}" ág törlése…' },
    "menu.renameCommit": { tr: "Beküldés üzenet átnevezése…" },
    "menu.undoCommit": { tr: "Beküldés visszavonása (változások megtartása)…" },
    "menu.mergeBranch": { en: '"{source}" merge ebbe: "{target}"…' },
    "menu.stashApply": { tr: "Félretett munka alkalmazása" },
    "menu.stashPop": { tr: "Félretett munka kivétele (alkalmaz és töröl)" },
    "menu.stashDrop": { tr: "Félretett munka eldobása…" },
    "changes.changed": { tr: "Ebben a beküldésben" },
    "merge.title": { en: "Branch merge", tr: "Ág összeolvasztása" },
    "merge.route": { tr: "Összeolvasztás az aktuális ágba" },
    "merge.merge": { en: "Merge" },
    "newBranch.checkout": { tr: "Váltás az ágra létrehozás után" },
    "status.fetching": { tr: "Lekérés folyamatban…" },
    "status.pulling": { tr: "Lehúzás folyamatban…" },
    "status.pushing": { tr: "Feltöltés folyamatban…" },
    "status.syncing": { en: "Sync folyamatban…" },
    "status.commitUndone": { tr: "Beküldés visszavonva — a változások visszakerültek a working tree-be." },
    "status.stashApplying": { tr: "Félretett munka alkalmazása…" },
    "status.stashPopping": { tr: "Félretett munka kivétele…" },
    "status.stashDropping": { tr: "Félretett munka eldobása…" },
    "status.stashApplied": { tr: "Félretett munka alkalmazva." },
    "status.stashPopped": { tr: "Félretett munka kivéve." },
    "status.stashDropped": { tr: "Félretett munka eldobva." },
    "status.merging": { en: "Merge folyamatban…" },
    "status.merged": { tr: "Az összeolvasztás elkészült." },
    "status.mergeConflict": { tr: "Az összeolvasztás konfliktusos — oldd fel a szerkesztőben, majd commitold." },
  },
  zh: {
    "toolbar.fetch": { en: "⤓ Fetch" },
    "toolbar.pull": { en: "⇩ Pull" },
    "toolbar.push": { en: "⇧ Push" },
    "toolbar.sync": { en: "⇅ Sync" },
    "toolbar.jumpHead": { en: "⌖ 跳转到 checkout 位置" },
    "details.header": { en: "Commit 详情" },
    "legend.head": { en: "HEAD / 当前 branch" },
    "legend.local": { en: "本地 branch" },
    "legend.remote": { en: "远程 branch" },
    "legend.remoteOnly": { en: "仅在云端（尚未 pull）" },
    "legend.stash": { en: "Stash（暂存的工作）" },
    "menu.checkout": { en: "Checkout 此 commit" },
    "menu.copySha": { en: "复制 commit SHA" },
    "menu.pushBranch": { en: 'Push branch “{name}”' },
    "menu.renameBranch": { en: '重命名 branch “{name}”…' },
    "menu.deleteBranch": { en: '删除 branch “{name}”…' },
    "menu.renameCommit": { en: "重命名 commit 信息…" },
    "menu.undoCommit": { en: "撤销 commit（保留更改）…" },
    "menu.mergeBranch": { en: '将 “{source}” merge 到 “{target}”…' },
    "menu.stashApply": { en: "应用 stash" },
    "menu.stashPop": { en: "弹出 stash（应用并移除）" },
    "menu.stashDrop": { en: "丢弃 stash…" },
    "changes.changed": { en: "此 commit" },
    "merge.title": { en: "Merge branch" },
    "merge.route": { en: "Merge 到当前 branch" },
    "merge.merge": { en: "Merge" },
    "newBranch.checkout": { en: "创建后 checkout branch" },
    "status.fetching": { en: "正在 Fetch…" },
    "status.pulling": { en: "正在 Pull…" },
    "status.pushing": { en: "正在 Push…" },
    "status.syncing": { en: "正在 Sync…" },
    "status.commitUndone": { en: "Commit 已撤销 — 更改已回到工作树中。" },
    "status.stashApplying": { en: "正在应用 stash…" },
    "status.stashPopping": { en: "正在弹出 stash…" },
    "status.stashDropping": { en: "正在丢弃 stash…" },
    "status.stashApplied": { en: "Stash 已应用。" },
    "status.stashPopped": { en: "Stash 已弹出。" },
    "status.stashDropped": { en: "Stash 已丢弃。" },
    "status.merging": { en: "正在 Merge…" },
    "status.merged": { en: "Merge 完成。" },
    "status.mergeConflict": { en: "Merge 存在冲突 — 请在编辑器中解决，然后 commit。" },
  },
  ru: {
    "toolbar.fetch": { en: "⤓ Fetch" },
    "toolbar.pull": { en: "⇩ Pull" },
    "toolbar.push": { en: "⇧ Push" },
    "toolbar.sync": { en: "⇅ Sync" },
    "toolbar.jumpHead": { tr: "⌖ Перейти к переключению" },
    "details.header": { en: "Сведения о commit’е" },
    "legend.head": { en: "HEAD / текущий branch" },
    "legend.local": { en: "Локальный branch" },
    "legend.remote": { en: "Удалённый branch" },
    "legend.remoteOnly": { en: "Только в облаке (не сделан pull)" },
    "legend.stash": { tr: "Спрятанное (отложенная работа)" },
    "menu.checkout": { en: "Checkout на этот commit" },
    "menu.copySha": { en: "Копировать SHA commit’а" },
    "menu.pushBranch": { en: 'Push branch «{name}»' },
    "menu.renameBranch": { en: 'Переименовать branch «{name}»…' },
    "menu.deleteBranch": { en: 'Удалить branch «{name}»…' },
    "menu.renameCommit": { en: "Изменить сообщение commit’а…" },
    "menu.undoCommit": { en: "Отменить commit (сохранить изменения)…" },
    "menu.mergeBranch": { en: 'Merge «{source}» в «{target}»…' },
    "menu.stashApply": { tr: "Применить спрятанное" },
    "menu.stashPop": { tr: "Извлечь спрятанное (применить и удалить)" },
    "menu.stashDrop": { tr: "Отбросить спрятанное…" },
    "changes.changed": { en: "Этот commit" },
    "merge.title": { en: "Merge branch" },
    "merge.route": { en: "Merge в текущий branch" },
    "merge.merge": { en: "Merge" },
    "newBranch.checkout": { en: "Checkout branch после создания" },
    "status.fetching": { en: "Fetch…" },
    "status.pulling": { en: "Pull…" },
    "status.pushing": { en: "Push…" },
    "status.syncing": { en: "Sync…" },
    "status.commitUndone": { en: "Commit отменён — изменения вернулись в рабочее дерево." },
    "status.stashApplying": { tr: "Применение спрятанного…" },
    "status.stashPopping": { tr: "Извлечение спрятанного…" },
    "status.stashDropping": { tr: "Отбрасывание спрятанного…" },
    "status.stashApplied": { tr: "Спрятанное применено." },
    "status.stashPopped": { tr: "Спрятанное извлечено." },
    "status.stashDropped": { tr: "Спрятанное отброшено." },
    "status.merging": { en: "Merge…" },
    "status.merged": { en: "Merge завершён." },
    "status.mergeConflict": { en: "В merge есть конфликты — разрешите их в редакторе, затем сделайте commit." },
  },
};

const STORAGE_KEY = "revGraph.lang";

function isLang(v: unknown): v is Lang {
  return v === "en" || v === "hu" || v === "zh" || v === "ru";
}

/**
 * The default language when the user hasn't picked one yet. A host may override
 * it by defining `window.__REV_GRAPH_DEFAULT_LANG__` before the bundle loads
 * (the DevEco Studio flavor sets it to "zh"); otherwise it's English. An
 * explicit stored choice always wins over this — see load().
 */
function hostDefaultLang(): Lang {
  try {
    const v = (globalThis as { __REV_GRAPH_DEFAULT_LANG__?: unknown }).__REV_GRAPH_DEFAULT_LANG__;
    if (isLang(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

function load(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isLang(v)) return v;
  } catch {
    /* localStorage may be unavailable; fall back to the host/default. */
  }
  return hostDefaultLang();
}

let current: Lang = load();
const listeners = new Set<() => void>();

// ---- Keep-Git-terms-in-English setting ------------------------------------
// A separate localStorage-backed toggle (like the display-mode / theme settings)
// that reuses this module's listener set, so switching it re-renders everything
// that already reacts to a language change. Off by default → jargon is translated.
const JARGON_STORAGE_KEY = "revGraph.keepJargonEnglish";

function loadJargon(): boolean {
  try {
    return localStorage.getItem(JARGON_STORAGE_KEY) === "en";
  } catch {
    return false;
  }
}

let keepJargonEnglish = loadJargon();

/** Whether Git terms (pull/push/commit/…) are kept in English. */
export function getKeepJargonEnglish(): boolean {
  return keepJargonEnglish;
}

/** Toggle keep-jargon-English, persist it, and notify subscribers to re-render. */
export function setKeepJargonEnglish(on: boolean): void {
  if (on === keepJargonEnglish) return;
  keepJargonEnglish = on;
  try {
    localStorage.setItem(JARGON_STORAGE_KEY, on ? "en" : "tr");
  } catch {
    /* ignore persistence failures */
  }
  listeners.forEach((l) => l());
}

/** The active language. */
export function getLang(): Lang {
  return current;
}

/** Switch language, persist it, and notify subscribers so the UI re-renders. */
export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore persistence failures */
  }
  listeners.forEach((l) => l());
}

/** Subscribe to language changes; returns an unsubscribe function. */
export function onLangChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Translate a key in the active language, interpolating `{placeholders}`. */
export function t(key: MsgKey, params?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? DICTS[DEFAULT_LANG][key] ?? key;
  // Apply the Git-jargon override for this key/mode, if one exists. A missing
  // side (en when translating, tr when keeping English) falls back to `s`.
  const jo = JARGON[current]?.[key];
  if (jo) {
    const alt = keepJargonEnglish ? jo.en : jo.tr;
    if (alt != null) s = alt;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
