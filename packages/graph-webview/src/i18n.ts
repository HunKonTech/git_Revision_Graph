/**
 * Lightweight in-webview localization.
 *
 * The UI ships in English by default; the user can switch language from the
 * settings panel. The choice is persisted in localStorage (available in both
 * the VS Code / Visual Studio webviews and the dev browser harness), so it
 * survives reloads without involving the host.
 */

/**
 * A language key inside {@link DICTS}. `en` and `hu` are hand-maintained; every
 * other key is filled in automatically by `KO_language_translator/main.py`
 * (Google Translate) — see the "Translate i18n" workflow. Any key present in
 * {@link LANGUAGES} is valid; unknown keys fall back to English via {@link t}.
 */
export type Lang = string;

/** Literal `"en"` so `DICTS[DEFAULT_LANG]` narrows to the complete dictionary. */
export const DEFAULT_LANG = "en";

/** Keys that need a right-to-left interface. */
const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug", "ckb", "yi", "dv"]);

/** Whether `lang` is written right-to-left. */
export function isRTL(lang: Lang): boolean {
  return RTL_LANGS.has(lang);
}

/**
 * Languages offered in the settings dropdown, in display order: the two
 * hand-maintained languages first, then every language the translator supports,
 * sorted by native name. Labels are endonyms (the language's own name).
 */
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hu", label: "Magyar" },
  { code: "om", label: "Afaan Oromoo" },
  { code: "af", label: "Afrikaans" },
  { code: "gn", label: "Avañe'ẽ" },
  { code: "ay", label: "Aymar aru" },
  { code: "az", label: "Azərbaycanca" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "bm", label: "Bamanankan" },
  { code: "jv", label: "Basa Jawa" },
  { code: "su", label: "Basa Sunda" },
  { code: "bs", label: "Bosanski" },
  { code: "ca", label: "Català" },
  { code: "ceb", label: "Cebuano" },
  { code: "ny", label: "Chichewa" },
  { code: "sn", label: "ChiShona" },
  { code: "co", label: "Corsu" },
  { code: "cy", label: "Cymraeg" },
  { code: "da", label: "Dansk" },
  { code: "de", label: "Deutsch" },
  { code: "et", label: "Eesti" },
  { code: "es", label: "Español" },
  { code: "eo", label: "Esperanto" },
  { code: "eu", label: "Euskara" },
  { code: "ee", label: "Eʋegbe" },
  { code: "tl", label: "Filipino" },
  { code: "fr", label: "Français" },
  { code: "fy", label: "Frysk" },
  { code: "ga", label: "Gaeilge" },
  { code: "sm", label: "Gagana Samoa" },
  { code: "gl", label: "Galego" },
  { code: "gd", label: "Gàidhlig" },
  { code: "ha", label: "Hausa" },
  { code: "hmn", label: "Hmoob" },
  { code: "hr", label: "Hrvatski" },
  { code: "ig", label: "Igbo" },
  { code: "rw", label: "Ikinyarwanda" },
  { code: "ilo", label: "Ilokano" },
  { code: "xh", label: "isiXhosa" },
  { code: "zu", label: "isiZulu" },
  { code: "it", label: "Italiano" },
  { code: "sw", label: "Kiswahili" },
  { code: "ht", label: "Kreyòl ayisyen" },
  { code: "kri", label: "Krio" },
  { code: "ku", label: "Kurdî" },
  { code: "la", label: "Latina" },
  { code: "lv", label: "Latviešu" },
  { code: "lt", label: "Lietuvių" },
  { code: "ln", label: "Lingála" },
  { code: "lg", label: "Luganda" },
  { code: "lb", label: "Lëtzebuergesch" },
  { code: "mg", label: "Malagasy" },
  { code: "mt", label: "Malti" },
  { code: "lus", label: "Mizo ṭawng" },
  { code: "mi", label: "Māori" },
  { code: "nl", label: "Nederlands" },
  { code: "no", label: "Norsk" },
  { code: "uz", label: "Oʻzbekcha" },
  { code: "pl", label: "Polski" },
  { code: "pt", label: "Português" },
  { code: "ro", label: "Română" },
  { code: "qu", label: "Runa Simi" },
  { code: "nso", label: "Sepedi" },
  { code: "st", label: "Sesotho" },
  { code: "sq", label: "Shqip" },
  { code: "sk", label: "Slovenčina" },
  { code: "sl", label: "Slovenščina" },
  { code: "so", label: "Soomaali" },
  { code: "fi", label: "Suomi" },
  { code: "sv", label: "Svenska" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "ak", label: "Twi" },
  { code: "tk", label: "Türkmençe" },
  { code: "tr", label: "Türkçe" },
  { code: "ts", label: "Xitsonga" },
  { code: "yo", label: "Yorùbá" },
  { code: "is", label: "Íslenska" },
  { code: "cs", label: "Čeština" },
  { code: "haw", label: "ʻŌlelo Hawaiʻi" },
  { code: "el", label: "Ελληνικά" },
  { code: "be", label: "Беларуская" },
  { code: "bg", label: "Български" },
  { code: "ky", label: "Кыргызча" },
  { code: "mk", label: "Македонски" },
  { code: "mn", label: "Монгол" },
  { code: "ru", label: "Русский" },
  { code: "sr", label: "Српски" },
  { code: "tt", label: "Татарча" },
  { code: "tg", label: "Тоҷикӣ" },
  { code: "uk", label: "Українська" },
  { code: "kk", label: "Қазақ тілі" },
  { code: "hy", label: "Հայերեն" },
  { code: "yi", label: "ייִדיש" },
  { code: "he", label: "עברית" },
  { code: "ug", label: "ئۇيغۇرچە" },
  { code: "ur", label: "اردو" },
  { code: "ar", label: "العربية" },
  { code: "sd", label: "سنڌي" },
  { code: "fa", label: "فارسی" },
  { code: "ps", label: "پښتو" },
  { code: "ckb", label: "کوردیی ناوەندی" },
  { code: "dv", label: "ދިވެހި" },
  { code: "gom", label: "कोंकणी" },
  { code: "doi", label: "डोगरी" },
  { code: "ne", label: "नेपाली" },
  { code: "bho", label: "भोजपुरी" },
  { code: "mr", label: "मराठी" },
  { code: "mai", label: "मैथिली" },
  { code: "sa", label: "संस्कृतम्" },
  { code: "hi", label: "हिन्दी" },
  { code: "as", label: "অসমীয়া" },
  { code: "bn", label: "বাংলা" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "or", label: "ଓଡ଼ିଆ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "si", label: "සිංහල" },
  { code: "th", label: "ไทย" },
  { code: "lo", label: "ລາວ" },
  { code: "my", label: "မြန်မာ" },
  { code: "ka", label: "ქართული" },
  { code: "ti", label: "ትግርኛ" },
  { code: "am", label: "አማርኛ" },
  { code: "km", label: "ខ្មែរ" },
  { code: "zh", label: "中文（简体）" },
  { code: "zh-tw", label: "中文（繁體）" },
  { code: "ja", label: "日本語" },
  { code: "mni-mtei", label: "ꯃꯤꯇꯩ ꯂꯣꯟ" },
  { code: "ko", label: "한국어" },
];

/** Fast membership test for {@link isLang}. */
const LANG_CODES = new Set(LANGUAGES.map((l) => l.code));

/** All user-facing strings. `{n}` style placeholders are filled by t(). */
type Dict = {
  "toolbar.refresh": string;
  "toolbar.fetch": string;
  "toolbar.pull": string;
  "toolbar.push": string;
  "toolbar.commit": string;
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
  "settings.commitReview": string;
  "settings.commitReviewOn": string;
  "settings.commitReviewOff": string;
  "settings.commitReviewOnHint": string;
  "settings.commitReviewOffHint": string;
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
  "settings.sectionMerge": string;
  "settings.mergeMode": string;
  "settings.mergeModeMerge": string;
  "settings.mergeModeSquash": string;
  "settings.mergeModeMergeHint": string;
  "settings.mergeModeSquashHint": string;
  "settings.mergedView": string;
  "settings.mergedViewBranch": string;
  "settings.mergedViewTarget": string;
  "settings.mergedViewBranchHint": string;
  "settings.mergedViewTargetHint": string;
  "legend.title": string;
  "legend.head": string;
  "legend.local": string;
  "legend.remote": string;
  "legend.remoteOnly": string;
  "legend.tag": string;
  "legend.commit": string;
  "legend.stash": string;
  "legend.mergedIn": string;
  "legend.nodes": string;
  "legend.lines": string;
  "legend.edgeParent": string;
  "legend.edgeMerge": string;
  "legend.edgeBranch": string;
  "legend.edgeStash": string;
  "legend.edgeMergedChain": string;
  "legend.edgeMergedTie": string;
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
  "menu.jumpToOriginal": string;
  "node.mergedInTooltip": string;
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
  "find.open": string;
  "find.placeholder": string;
  "find.prev": string;
  "find.next": string;
  "find.close": string;
  "find.noResults": string;
  "commit.title": string;
  "commit.close": string;
  "commit.loading": string;
  "commit.noChanges": string;
  "commit.selectFile": string;
  "commit.selectAll": string;
  "commit.selectNone": string;
  "commit.message": string;
  "commit.messagePlaceholder": string;
  "commit.selectedCount": string;
  "commit.review": string;
  "commit.reviewTitle": string;
  "commit.reviewSummary": string;
  "commit.back": string;
  "commit.commit": string;
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
  "merge.squashBadge": string;
  "merge.squashNote": string;
  "merge.messageSquash": string;
  "merge.squashMessagePlaceholder": string;
  "newBranch.title": string;
  "newBranch.startPoint": string;
  "newBranch.startPointOn": string;
  "newBranch.location": string;
  "newBranch.locationRoot": string;
  "newBranch.expandAll": string;
  "newBranch.collapseAll": string;
  "newBranch.expandFolder": string;
  "newBranch.collapseFolder": string;
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
  "status.committing": string;
  "status.commitCreated": string;
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
  "search.previous": string;
  "search.next": string;
  "search.noResults": string;
  "search.resultCount": string;
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
  "footer.github": string;
};

// `en` is the complete reference dictionary; `hu` is hand-maintained. Every
// other language is a (possibly empty) machine-filled partial — `t()` falls back
// to English for any key a translation is still missing.
const DICTS: Record<string, Partial<Dict>> & { en: Dict } = {
  en: {
    "toolbar.refresh": "⟳ Refresh",
    "toolbar.fetch": "⤓ Fetch",
    "toolbar.pull": "⇩ Pull",
    "toolbar.push": "⇧ Push",
    "toolbar.commit": "✓ Commit",
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
    "settings.commitReview": "Commit review",
    "settings.commitReviewOn": "Ask before commit",
    "settings.commitReviewOff": "Commit directly",
    "settings.commitReviewOnHint": "Show a final file list and message check before creating the local commit.",
    "settings.commitReviewOffHint": "The Commit button creates the local commit immediately.",
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
    "settings.sectionMerge": "Merge",
    "settings.mergeMode": "Merge style",
    "settings.mergeModeMerge": "Normal merge",
    "settings.mergeModeSquash": "Squash merge",
    "settings.mergeModeMergeHint":
      "Merges the branch as it is: its commits become part of the current branch's history, joined by a merge commit (or fast-forwarded when possible).",
    "settings.mergeModeSquashHint":
      "Collapses the whole branch into a single commit on the current branch (git merge --squash). The branch's own commits never enter the current branch's history — you only see one commit there. The branch itself is left untouched, so its commits stay visible in its own lane.",
    "settings.mergedView": "Merged commits in the graph",
    "settings.mergedViewBranch": "Only on their own branch",
    "settings.mergedViewTarget": "Also in the branch they were merged into",
    "settings.mergedViewBranchHint":
      "A merged branch's commits are drawn only in their own lane; the merge shows up as a connector. The classic view.",
    "settings.mergedViewTargetHint":
      "The commits a merge brought in are drawn in the receiving branch's lane as well, stacked under the merge commit and level with the originals — because that branch really does contain them now. The copies are pale and headed with the branch they were written on, so it stays clear they were not made there. Squash merges are unaffected: a squash writes one ordinary commit, so only that commit ever appears.",
    "legend.title": "Legend",
    "legend.head": "HEAD / current branch",
    "legend.local": "Local branch",
    "legend.remote": "Remote branch",
    "legend.remoteOnly": "Only in the cloud (not pulled)",
    "legend.tag": "Tag (version)",
    "legend.commit": "Commit",
    "legend.stash": "Stash (shelved work)",
    "legend.mergedIn": "Came in with a merge (written on another branch)",
    "legend.nodes": "Boxes",
    "legend.lines": "Lines",
    "legend.edgeParent": "Previous commit on the same line",
    "legend.edgeMerge": "Merged-in branch — the arrow points at the merge commit",
    "legend.edgeBranch": "A branch forked off here",
    "legend.edgeStash": "Stash and the commit it was shelved on",
    "legend.edgeMergedChain": "This branch's line running through the merged-in commits",
    "legend.edgeMergedTie": "The same commit on the branch it was written on",
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
    "menu.jumpToOriginal": "Go to the original commit",
    "node.mergedInTooltip":
      "Merge {merge} brought this commit into \"{target}\" — it was written on \"{origin}\".",
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
    "find.open": "Search in this diff (Ctrl+F)",
    "find.placeholder": "Find in diff…",
    "find.prev": "Previous match",
    "find.next": "Next match",
    "find.close": "Close search",
    "find.noResults": "No results",
    "commit.title": "Commit Changes",
    "commit.close": "Close",
    "commit.loading": "Reading working tree…",
    "commit.noChanges": "There are no local changes to commit.",
    "commit.selectFile": "Select a file to see its diff.",
    "commit.selectAll": "Select all",
    "commit.selectNone": "Clear all",
    "commit.message": "Commit message",
    "commit.messagePlaceholder": "Describe the change",
    "commit.selectedCount": "{count} file(s) selected",
    "commit.review": "Review",
    "commit.reviewTitle": "Final check before commit",
    "commit.reviewSummary": "Commit {count} file(s) with message: {message}",
    "commit.back": "Back",
    "commit.commit": "Create local commit",
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
    "merge.squashBadge": "Squash",
    "merge.squashNote":
      "Squash merge — every change lands as ONE commit on “{target}”; “{source}”'s own commits stay out of its history. Switch back in Settings › Merge.",
    "merge.messageSquash": "Commit message",
    "merge.squashMessagePlaceholder": "Squashed changes from 'source'",
    "newBranch.title": "Create Branch",
    "newBranch.startPoint": "New branch starting from {sha}",
    "newBranch.startPointOn": "on {refs}",
    "newBranch.location": "Location",
    "newBranch.locationRoot": "(root)",
    "newBranch.expandAll": "Expand all",
    "newBranch.collapseAll": "Collapse all",
    "newBranch.expandFolder": "Expand folder",
    "newBranch.collapseFolder": "Collapse folder",
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
    "status.committing": "Creating local commit…",
    "status.commitCreated": "Created local commit {sha}: {message}",
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
    "search.previous": "Previous result",
    "search.next": "Next result",
    "search.noResults": "No results",
    "search.resultCount": "{index}/{count}",
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
    "footer.github": "GitHub",
  },
  hu: {
    "toolbar.refresh": "⟳ Frissítés",
    "toolbar.fetch": "⤓ Fetch",
    "toolbar.pull": "⇩ Pull",
    "toolbar.push": "⇧ Push",
    "toolbar.commit": "✓ Commit",
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
    "settings.commitReview": "Commit előtti ellenőrzés",
    "settings.commitReviewOn": "Rákérdezés",
    "settings.commitReviewOff": "Azonnali commit",
    "settings.commitReviewOnHint": "Commit előtt még egyszer megjelenik a fájllista és az üzenet ellenőrzésre.",
    "settings.commitReviewOffHint": "A Commit gomb rögtön létrehozza a lokális commitot.",
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
    "settings.sectionMerge": "Beolvasztás (merge)",
    "settings.mergeMode": "Merge módja",
    "settings.mergeModeMerge": "Normál merge",
    "settings.mergeModeSquash": "Squash merge",
    "settings.mergeModeMergeHint":
      "Az ágat úgy olvasztja be, ahogy van: a commitjai bekerülnek az aktuális ág történetébe, egy merge commit köti őket össze (vagy fast-forward, ha lehet).",
    "settings.mergeModeSquashHint":
      "Az egész ágat egyetlen commitba vonja össze az aktuális ágon (git merge --squash). Az ág saját commitjai nem kerülnek be az aktuális ág történetébe — ott csak egy commit látszik. Magát az ágat nem bántja, így annak commitjai a saját oszlopukban továbbra is látszanak.",
    "settings.mergedView": "Beolvasztott commitok a gráfon",
    "settings.mergedViewBranch": "Csak a saját águkon",
    "settings.mergedViewTarget": "Abban az ágban is, amelybe beolvadtak",
    "settings.mergedViewBranchHint":
      "A beolvasztott ág commitjai csak a saját sávjukban látszanak, a merge pedig összekötő vonalként. A megszokott nézet.",
    "settings.mergedViewTargetHint":
      "A merge-csel behozott commitok a fogadó ág sávjában is megjelennek, a merge commit alatt, az eredetivel egy sorban — mert az az ág valóban tartalmazza őket. A másolatok halvány hátterűek, és annak az ágnak a nevét viselik, amelyen készültek, így egyértelmű marad, hogy nem ott jöttek létre. A squash merge-re nincs hatással: a squash egyetlen közönséges commitot ír, tehát csak az az egy commit látszik.",
    "legend.title": "Jelmagyarázat",
    "legend.head": "HEAD / aktuális branch",
    "legend.local": "Lokális branch",
    "legend.remote": "Távoli branch (remote)",
    "legend.remoteOnly": "Csak a felhőben (nincs pull-olva)",
    "legend.tag": "Tag (verzió)",
    "legend.commit": "Commit",
    "legend.stash": "Stash (félretett munka)",
    "legend.mergedIn": "Merge-csel került ide (másik ágon készült)",
    "legend.nodes": "Dobozok",
    "legend.lines": "Vonalak",
    "legend.edgeParent": "Előző commit ugyanazon a vonalon",
    "legend.edgeMerge": "Beolvasztott branch — a nyíl a merge-commitra mutat",
    "legend.edgeBranch": "Innen ágazik le egy branch",
    "legend.edgeStash": "Stash és a commit, amire félre lett téve",
    "legend.edgeMergedChain": "Ennek a branchnek a vonala a beolvasztott commitokon át",
    "legend.edgeMergedTie": "Ugyanaz a commit azon a branchen, ahol készült",
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
    "menu.jumpToOriginal": "Ugrás az eredeti commitra",
    "node.mergedInTooltip":
      "Ezt a commitot a(z) {merge} merge hozta be a(z) „{target}” ágba — eredetileg a(z) „{origin}” ágon készült.",
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
    "find.open": "Keresés ebben a diffben (Ctrl+F)",
    "find.placeholder": "Keresés a diffben…",
    "find.prev": "Előző találat",
    "find.next": "Következő találat",
    "find.close": "Keresés bezárása",
    "find.noResults": "Nincs találat",
    "commit.title": "Változások commitolása",
    "commit.close": "Bezárás",
    "commit.loading": "Working tree beolvasása…",
    "commit.noChanges": "Nincs lokális változás, amit commitolni lehetne.",
    "commit.selectFile": "Válassz egy fájlt a diff megtekintéséhez.",
    "commit.selectAll": "Összes kijelölése",
    "commit.selectNone": "Kijelölés törlése",
    "commit.message": "Commit üzenet",
    "commit.messagePlaceholder": "Írd le a változást",
    "commit.selectedCount": "{count} fájl kijelölve",
    "commit.review": "Ellenőrzés",
    "commit.reviewTitle": "Utolsó ellenőrzés commit előtt",
    "commit.reviewSummary": "{count} fájl commitolása ezzel az üzenettel: {message}",
    "commit.back": "Vissza",
    "commit.commit": "Lokális commit létrehozása",
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
    "merge.squashBadge": "Squash",
    "merge.squashNote":
      "Squash merge — minden változás EGYETLEN commitként kerül a(z) „{target}” ágra; a(z) „{source}” saját commitjai nem kerülnek be annak történetébe. A Beállítások › Beolvasztás (merge) alatt állítható vissza.",
    "merge.messageSquash": "Commit üzenet",
    "merge.squashMessagePlaceholder": "A 'source' ág változásai egy commitban",
    "newBranch.title": "Branch létrehozása",
    "newBranch.startPoint": "Új branch innen indul: {sha}",
    "newBranch.startPointOn": "({refs})",
    "newBranch.location": "Hely",
    "newBranch.locationRoot": "(gyökér)",
    "newBranch.expandAll": "Mind kinyit",
    "newBranch.collapseAll": "Mind becsuk",
    "newBranch.expandFolder": "Mappa kinyitása",
    "newBranch.collapseFolder": "Mappa becsukása",
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
    "status.committing": "Lokális commit létrehozása…",
    "status.commitCreated": "Lokális commit létrejött {sha}: {message}",
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
    "search.previous": "Előző találat",
    "search.next": "Következő találat",
    "search.noResults": "Nincs találat",
    "search.resultCount": "{index}/{count}",
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
    "footer.github": "GitHub",
  },
  zh: {
    "toolbar.refresh": "⟳ 刷新",
    "toolbar.fetch": "⤓ 抓取",
    "toolbar.pull": "⇩ 拉取",
    "toolbar.push": "⇧ 推送",
    "toolbar.commit": "✓ 提交",
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
    "settings.commitReview": "提交前检查",
    "settings.commitReviewOn": "提交前询问",
    "settings.commitReviewOff": "直接提交",
    "settings.commitReviewOnHint": "创建本地提交前显示最终文件列表和提交信息。",
    "settings.commitReviewOffHint": "Commit 按钮会立即创建本地提交。",
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
    "settings.sectionMerge": "合并",
    "settings.mergeMode": "合并方式",
    "settings.mergeModeMerge": "普通合并",
    "settings.mergeModeSquash": "压缩合并（squash）",
    "settings.mergeModeMergeHint":
      "按原样合并分支：它的提交会成为当前分支历史的一部分，由一个合并提交连接（可以快进时则快进）。",
    "settings.mergeModeSquashHint":
      "把整个分支压缩成当前分支上的一个提交（git merge --squash）。分支自己的提交不会进入当前分支的历史——那里只看到一个提交。分支本身保持不变，它的提交仍显示在自己的列中。",
    "settings.mergedView": "图中的已合并提交",
    "settings.mergedViewBranch": "仅显示在各自的分支上",
    "settings.mergedViewTarget": "也显示在被合入的分支中",
    "settings.mergedViewBranchHint":
      "被合并分支的提交只画在自己的泳道里，合并本身显示为一条连接线。这是经典视图。",
    "settings.mergedViewTargetHint":
      "合并带入的提交同时画在接收分支的泳道中，堆叠在合并提交下方，与原始提交同一行——因为该分支确实已经包含它们。副本使用浅色底并标注它们真正被写入的分支，因此不会被误认为是在此处创建的。Squash 合并不受影响：squash 只写入一个普通提交，因此只会出现那一个提交。",
    "legend.title": "图例",
    "legend.head": "HEAD / 当前分支",
    "legend.local": "本地分支",
    "legend.remote": "远程分支",
    "legend.remoteOnly": "仅在云端（尚未拉取）",
    "legend.tag": "标签（版本）",
    "legend.commit": "提交",
    "legend.stash": "储藏（暂存的工作）",
    "legend.mergedIn": "随合并进入（在其他分支上创建）",
    "legend.nodes": "方框",
    "legend.lines": "连线",
    "legend.edgeParent": "同一条线上的上一个提交",
    "legend.edgeMerge": "被合并进来的分支——箭头指向合并提交",
    "legend.edgeBranch": "从这里分出了一个分支",
    "legend.edgeStash": "储藏及其所基于的提交",
    "legend.edgeMergedChain": "本分支的线穿过被合并进来的提交",
    "legend.edgeMergedTie": "同一个提交在它实际创建的分支上",
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
    "menu.jumpToOriginal": "跳转到原始提交",
    "node.mergedInTooltip":
      "合并 {merge} 将此提交带入 “{target}” — 它是在 “{origin}” 上创建的。",
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
    "find.open": "在此差异中搜索 (Ctrl+F)",
    "find.placeholder": "在差异中查找…",
    "find.prev": "上一个匹配",
    "find.next": "下一个匹配",
    "find.close": "关闭搜索",
    "find.noResults": "无结果",
    "commit.title": "提交更改",
    "commit.close": "关闭",
    "commit.loading": "正在读取工作区…",
    "commit.noChanges": "没有可提交的本地更改。",
    "commit.selectFile": "选择文件以查看差异。",
    "commit.selectAll": "全选",
    "commit.selectNone": "清除选择",
    "commit.message": "提交信息",
    "commit.messagePlaceholder": "描述此更改",
    "commit.selectedCount": "已选择 {count} 个文件",
    "commit.review": "检查",
    "commit.reviewTitle": "提交前最终检查",
    "commit.reviewSummary": "使用信息“{message}”提交 {count} 个文件",
    "commit.back": "返回",
    "commit.commit": "创建本地提交",
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
    "merge.squashBadge": "压缩",
    "merge.squashNote":
      "压缩合并 —— 所有改动作为“一个”提交落在“{target}”上；“{source}”自己的提交不会进入它的历史。可在“设置 › 合并”中改回。",
    "merge.messageSquash": "提交信息",
    "merge.squashMessagePlaceholder": "来自 'source' 的压缩改动",
    "newBranch.title": "创建分支",
    "newBranch.startPoint": "从 {sha} 开始的新分支",
    "newBranch.startPointOn": "位于 {refs}",
    "newBranch.location": "位置",
    "newBranch.locationRoot": "（根）",
    "newBranch.expandAll": "全部展开",
    "newBranch.collapseAll": "全部折叠",
    "newBranch.expandFolder": "展开文件夹",
    "newBranch.collapseFolder": "折叠文件夹",
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
    "status.committing": "正在创建本地提交…",
    "status.commitCreated": "已创建本地提交 {sha}: {message}",
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
    "search.title": "搜索",
    "search.tooltip": "搜索提交",
    "search.placeholder": "搜索提交…",
    "search.previous": "上一个结果",
    "search.next": "下一个结果",
    "search.noResults": "无结果",
    "search.resultCount": "{index}/{count}",
    "search.filter": "筛选模式",
    "search.highlight": "高亮模式",
    "search.filterMode": "搜索显示",
    "search.filterModeFilter": "筛选（隐藏不匹配项）",
    "search.filterModeHighlight": "高亮（显示全部并标记匹配项）",
    "search.filterModeHint": "选择搜索结果在图中的显示方式。",
    "search.visibility": "搜索位置",
    "search.visibilityToolbar": "工具栏按钮",
    "search.visibilityAlwaysVisible": "始终可见的栏",
    "search.visibilityHint": "将搜索显示为工具栏图标或顶部固定栏。",
    "footer.github": "GitHub",
  },
  ru: {
    "toolbar.refresh": "⟳ Обновить",
    "toolbar.fetch": "⤓ Получить",
    "toolbar.pull": "⇩ Затянуть",
    "toolbar.push": "⇧ Отправить",
    "toolbar.commit": "✓ Commit",
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
    "settings.commitReview": "Проверка перед commit",
    "settings.commitReviewOn": "Спрашивать перед commit",
    "settings.commitReviewOff": "Commit сразу",
    "settings.commitReviewOnHint": "Перед локальным commit показать итоговый список файлов и сообщение.",
    "settings.commitReviewOffHint": "Кнопка Commit сразу создает локальный commit.",
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
    "settings.sectionMerge": "Слияние",
    "settings.mergeMode": "Способ слияния",
    "settings.mergeModeMerge": "Обычное слияние",
    "settings.mergeModeSquash": "Squash-слияние",
    "settings.mergeModeMergeHint":
      "Сливает ветку как есть: её коммиты входят в историю текущей ветки и связываются коммитом слияния (или выполняется fast-forward, если возможно).",
    "settings.mergeModeSquashHint":
      "Схлопывает всю ветку в один коммит в текущей ветке (git merge --squash). Собственные коммиты ветки не попадают в историю текущей ветки — там виден только один коммит. Сама ветка не изменяется, поэтому её коммиты остаются видны в своей колонке.",
    "settings.mergedView": "Влитые коммиты на графе",
    "settings.mergedViewBranch": "Только в своей ветке",
    "settings.mergedViewTarget": "Также в ветке, в которую их влили",
    "settings.mergedViewBranchHint":
      "Коммиты влитой ветки рисуются только в её собственной дорожке, а слияние — соединительной линией. Классический вид.",
    "settings.mergedViewTargetHint":
      "Коммиты, которые принесло слияние, рисуются и в дорожке принимающей ветки — под коммитом слияния, на одной строке с оригиналами, ведь эта ветка действительно их содержит. Копии показаны на светлом фоне и подписаны веткой, в которой были написаны, так что видно: созданы они не здесь. На squash-слияние это не влияет: squash пишет один обычный коммит, поэтому виден только он.",
    "legend.title": "Легенда",
    "legend.head": "HEAD / текущая ветка",
    "legend.local": "Локальная ветка",
    "legend.remote": "Удалённая ветка",
    "legend.remoteOnly": "Только в облаке (не затянуто)",
    "legend.tag": "Тег (версия)",
    "legend.commit": "Коммит",
    "legend.stash": "Stash (отложенная работа)",
    "legend.mergedIn": "Попал сюда со слиянием (создан в другой ветке)",
    "legend.nodes": "Блоки",
    "legend.lines": "Линии",
    "legend.edgeParent": "Предыдущий коммит на той же линии",
    "legend.edgeMerge": "Влитая ветка — стрелка указывает на коммит слияния",
    "legend.edgeBranch": "Отсюда ответвилась ветка",
    "legend.edgeStash": "Stash и коммит, на котором он отложен",
    "legend.edgeMergedChain": "Линия этой ветки, проходящая через влитые коммиты",
    "legend.edgeMergedTie": "Тот же коммит на ветке, где он был создан",
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
    "menu.jumpToOriginal": "Перейти к исходному коммиту",
    "node.mergedInTooltip":
      "Слияние {merge} принесло этот коммит в «{target}» — он был написан в «{origin}».",
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
    "find.open": "Поиск в этом diff (Ctrl+F)",
    "find.placeholder": "Поиск в diff…",
    "find.prev": "Предыдущее совпадение",
    "find.next": "Следующее совпадение",
    "find.close": "Закрыть поиск",
    "find.noResults": "Ничего не найдено",
    "commit.title": "Commit Changes",
    "commit.close": "Закрыть",
    "commit.loading": "Чтение working tree…",
    "commit.noChanges": "Нет локальных изменений для commit.",
    "commit.selectFile": "Выберите файл, чтобы увидеть diff.",
    "commit.selectAll": "Выбрать все",
    "commit.selectNone": "Снять выбор",
    "commit.message": "Commit message",
    "commit.messagePlaceholder": "Опишите изменение",
    "commit.selectedCount": "Выбрано файлов: {count}",
    "commit.review": "Проверить",
    "commit.reviewTitle": "Финальная проверка перед commit",
    "commit.reviewSummary": "Commit {count} file(s) with message: {message}",
    "commit.back": "Назад",
    "commit.commit": "Создать локальный commit",
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
    "merge.squashBadge": "Squash",
    "merge.squashNote":
      "Squash-слияние — все изменения попадут в ветку «{target}» ОДНИМ коммитом; собственные коммиты «{source}» не войдут в её историю. Вернуть обычное слияние можно в «Настройки › Слияние».",
    "merge.messageSquash": "Сообщение коммита",
    "merge.squashMessagePlaceholder": "Изменения ветки 'source' одним коммитом",
    "newBranch.title": "Создать ветку",
    "newBranch.startPoint": "Новая ветка, начиная с {sha}",
    "newBranch.startPointOn": "на {refs}",
    "newBranch.location": "Расположение",
    "newBranch.locationRoot": "(корень)",
    "newBranch.expandAll": "Развернуть все",
    "newBranch.collapseAll": "Свернуть все",
    "newBranch.expandFolder": "Развернуть папку",
    "newBranch.collapseFolder": "Свернуть папку",
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
    "status.committing": "Создание локального commit…",
    "status.commitCreated": "Создан локальный commit {sha}: {message}",
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
    "search.title": "Поиск",
    "search.tooltip": "Искать коммиты",
    "search.placeholder": "Искать коммиты…",
    "search.previous": "Предыдущий результат",
    "search.next": "Следующий результат",
    "search.noResults": "Нет результатов",
    "search.resultCount": "{index}/{count}",
    "search.filter": "Режим фильтра",
    "search.highlight": "Режим подсветки",
    "search.filterMode": "Отображение поиска",
    "search.filterModeFilter": "Фильтр (скрыть несовпадения)",
    "search.filterModeHighlight": "Подсветка (показать всё и отметить совпадения)",
    "search.filterModeHint": "Выберите, как показывать результаты поиска на графе.",
    "search.visibility": "Расположение поиска",
    "search.visibilityToolbar": "Кнопка панели",
    "search.visibilityAlwaysVisible": "Всегда видимая строка",
    "search.visibilityHint": "Показывать поиск кнопкой на панели или постоянной строкой сверху.",
    "footer.github": "GitHub",
  },

  // ---------------------------------------------------------------------------
  // Machine-translated languages. Each starts empty and is filled in by
  // KO_language_translator/main.py on push (see the "Translate i18n" workflow);
  // until then `t()` serves the English string. Order matches LANGUAGES.
  // ---------------------------------------------------------------------------
  "om": {}, "af": {}, "gn": {}, "ay": {}, "az": {}, "id": {}, "ms": {}, "bm": {},
  "jv": {}, "su": {}, "bs": {}, "ca": {}, "ceb": {}, "ny": {}, "sn": {}, "co": {},
  "cy": {}, "da": {}, "de": {}, "et": {}, "es": {}, "eo": {}, "eu": {}, "ee": {},
  "tl": {}, "fr": {}, "fy": {}, "ga": {}, "sm": {}, "gl": {}, "gd": {}, "ha": {},
  "hmn": {}, "hr": {}, "ig": {}, "rw": {}, "ilo": {}, "xh": {}, "zu": {}, "it": {},
  "sw": {}, "ht": {}, "kri": {}, "ku": {}, "la": {}, "lv": {}, "lt": {}, "ln": {},
  "lg": {}, "lb": {}, "mg": {}, "mt": {}, "lus": {}, "mi": {}, "nl": {}, "no": {},
  "uz": {}, "pl": {}, "pt": {}, "ro": {}, "qu": {}, "nso": {}, "st": {}, "sq": {},
  "sk": {}, "sl": {}, "so": {}, "fi": {}, "sv": {}, "vi": {}, "ak": {}, "tk": {},
  "tr": {}, "ts": {}, "yo": {}, "is": {}, "cs": {}, "haw": {}, "el": {}, "be": {},
  "bg": {}, "ky": {}, "mk": {}, "mn": {}, "sr": {}, "tt": {}, "tg": {}, "uk": {},
  "kk": {}, "hy": {}, "yi": {}, "he": {}, "ug": {}, "ur": {}, "ar": {}, "sd": {},
  "fa": {}, "ps": {}, "ckb": {}, "dv": {}, "gom": {}, "doi": {}, "ne": {},
  "bho": {}, "mr": {}, "mai": {}, "sa": {}, "hi": {}, "as": {}, "bn": {}, "pa": {},
  "gu": {}, "or": {}, "ta": {}, "te": {}, "kn": {}, "ml": {}, "si": {}, "th": {},
  "lo": {}, "my": {}, "ka": {}, "ti": {}, "am": {}, "km": {}, "zh-tw": {},
  "ja": {}, "mni-mtei": {}, "ko": {},
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
    "toolbar.commit": { tr: "✓ Beküldés" },
    "toolbar.sync": { en: "⇅ Sync" },
    "toolbar.jumpHead": { tr: "⌖ Ugrás a váltásra" },
    "details.header": { tr: "Beküldés részletei" },
    "legend.head": { tr: "HEAD / aktuális ág" },
    "legend.local": { tr: "Lokális ág" },
    "legend.remote": { tr: "Távoli ág" },
    "legend.remoteOnly": { tr: "Csak a felhőben (nincs lehúzva)" },
    "legend.stash": { tr: "Félretett munka" },
    "legend.edgeMerge": { tr: "Beolvasztott ág — a nyíl az összefésülő commitra mutat" },
    "legend.edgeBranch": { tr: "Innen ágazik le egy ág" },
    "legend.edgeStash": { tr: "Félretett munka és a commit, amire félre lett téve" },
    "legend.edgeMergedChain": { tr: "Ennek az ágnak a vonala a beolvasztott commitokon át" },
    "legend.edgeMergedTie": { tr: "Ugyanaz a commit azon az ágon, ahol készült" },
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
    "commit.title": { tr: "Változások beküldése" },
    "commit.message": { tr: "Beküldés üzenet" },
    "commit.commit": { tr: "Lokális beküldés létrehozása" },
    "merge.title": { en: "Branch merge", tr: "Ág összeolvasztása" },
    "merge.route": { tr: "Összeolvasztás az aktuális ágba" },
    "merge.merge": { en: "Merge" },
    "newBranch.checkout": { tr: "Váltás az ágra létrehozás után" },
    "status.fetching": { tr: "Lekérés folyamatban…" },
    "status.pulling": { tr: "Lehúzás folyamatban…" },
    "status.pushing": { tr: "Feltöltés folyamatban…" },
    "status.committing": { tr: "Lokális beküldés létrehozása…" },
    "status.commitCreated": { tr: "Lokális beküldés létrejött {sha}: {message}" },
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
    "toolbar.commit": { en: "✓ Commit" },
    "toolbar.sync": { en: "⇅ Sync" },
    "toolbar.jumpHead": { en: "⌖ 跳转到 checkout 位置" },
    "details.header": { en: "Commit 详情" },
    "legend.head": { en: "HEAD / 当前 branch" },
    "legend.local": { en: "本地 branch" },
    "legend.remote": { en: "远程 branch" },
    "legend.remoteOnly": { en: "仅在云端（尚未 pull）" },
    "legend.stash": { en: "Stash（暂存的工作）" },
    "legend.edgeMerge": { en: "被 merge 进来的 branch——箭头指向 merge commit" },
    "legend.edgeBranch": { en: "从这里分出了一个 branch" },
    "legend.edgeStash": { en: "Stash 及其所基于的 commit" },
    "legend.edgeMergedChain": { en: "本 branch 的线穿过被 merge 进来的 commit" },
    "legend.edgeMergedTie": { en: "同一个 commit 在它实际创建的 branch 上" },
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
    "commit.title": { en: "Commit Changes" },
    "commit.message": { en: "Commit message" },
    "commit.commit": { en: "Create local commit" },
    "merge.title": { en: "Merge branch" },
    "merge.route": { en: "Merge 到当前 branch" },
    "merge.merge": { en: "Merge" },
    "newBranch.checkout": { en: "创建后 checkout branch" },
    "status.fetching": { en: "正在 Fetch…" },
    "status.pulling": { en: "正在 Pull…" },
    "status.pushing": { en: "正在 Push…" },
    "status.committing": { en: "正在创建本地 commit…" },
    "status.commitCreated": { en: "已创建本地 commit {sha}: {message}" },
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
    "toolbar.commit": { en: "✓ Commit" },
    "toolbar.sync": { en: "⇅ Sync" },
    "toolbar.jumpHead": { tr: "⌖ Перейти к переключению" },
    "details.header": { en: "Сведения о commit’е" },
    "legend.head": { en: "HEAD / текущий branch" },
    "legend.local": { en: "Локальный branch" },
    "legend.remote": { en: "Удалённый branch" },
    "legend.remoteOnly": { en: "Только в облаке (не сделан pull)" },
    "legend.stash": { tr: "Спрятанное (отложенная работа)" },
    "legend.edgeMerge": { en: "Влитый branch — стрелка указывает на merge commit" },
    "legend.edgeBranch": { en: "Отсюда ответвился branch" },
    "legend.edgeStash": { en: "Stash и commit, на котором он отложен" },
    "legend.edgeMergedChain": { en: "Линия этого branch, проходящая через влитые commit-ы" },
    "legend.edgeMergedTie": { en: "Тот же commit на branch, где он был создан" },
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
    "commit.title": { en: "Commit Changes" },
    "commit.message": { en: "Commit message" },
    "commit.commit": { en: "Создать локальный commit" },
    "merge.title": { en: "Merge branch" },
    "merge.route": { en: "Merge в текущий branch" },
    "merge.merge": { en: "Merge" },
    "newBranch.checkout": { en: "Checkout branch после создания" },
    "status.fetching": { en: "Fetch…" },
    "status.pulling": { en: "Pull…" },
    "status.pushing": { en: "Push…" },
    "status.committing": { en: "Создание локального commit…" },
    "status.commitCreated": { en: "Создан локальный commit {sha}: {message}" },
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
  return typeof v === "string" && LANG_CODES.has(v);
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

/** Reflect the active language's writing direction on the document root. */
function applyDir(lang: Lang): void {
  try {
    document.documentElement.setAttribute("dir", isRTL(lang) ? "rtl" : "ltr");
  } catch {
    /* no document (e.g. unit tests) */
  }
}
applyDir(current);

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
  applyDir(current);
  listeners.forEach((l) => l());
}

/** Subscribe to language changes; returns an unsubscribe function. */
export function onLangChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Translate a key in the active language, interpolating `{placeholders}`. */
export function t(key: MsgKey, params?: Record<string, string | number>): string {
  let s = DICTS[current]?.[key] ?? DICTS[DEFAULT_LANG][key] ?? key;
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
