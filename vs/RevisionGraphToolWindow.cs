using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using EnvDTE;
using EnvDTE80;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace RevisionGraph
{
    /// <summary>
    /// The dockable tool window that hosts the revision graph. Resolves the
    /// active solution's directory and points the WebView2 host at its repo.
    /// </summary>
    [Guid("3f5b2d10-9c1a-4f7e-bf2a-7a1d2c3e4b50")]
    public sealed class RevisionGraphToolWindow : ToolWindowPane
    {
        private readonly WebViewHostControl _control;

        // Keyboard messages Visual Studio would otherwise turn into IDE commands
        // before the WebView2 ever sees them (see PreProcessMessage).
        private const int WM_KEYDOWN = 0x0100;
        private const int VK_F = 0x46;
        private const int VK_G = 0x47;
        private const int VK_F3 = 0x72;
        private const int VK_CONTROL = 0x11;

        [DllImport("user32.dll")]
        private static extern IntPtr GetFocus();

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern short GetKeyState(int nVirtKey);

        public RevisionGraphToolWindow() : base(null)
        {
            Caption = "Revision Graph";
            _control = new WebViewHostControl();
            Content = _control;
        }

        /// <summary>
        /// Called by the shell once the tool window's frame exists — both when a
        /// user opens it via the command AND when Visual Studio auto-restores a
        /// previously docked window on startup. Binding here (rather than only from
        /// the command handler) ensures the graph loads either way; relying solely
        /// on the command handler left the auto-restored window blank until the
        /// user closed and reopened it manually.
        /// </summary>
        public override void OnToolWindowCreated()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            base.OnToolWindowCreated();
            Initialize((IServiceProvider)Package);
        }

        /// <summary>
        /// Hand the webview's own search shortcuts to the WebView2 instead of
        /// letting Visual Studio turn them into IDE commands.
        ///
        /// VS pre-translates key chords for the active tool window: Ctrl+F would
        /// become Edit.Find (and F3 Edit.FindNext) and the message would never be
        /// dispatched to the browser control, so the webview's "find in this diff"
        /// box never opened — the shortcut simply did nothing on Windows. This
        /// runs BEFORE that translation (see WindowPane.PreProcessMessage), sends
        /// the key straight to the focused browser window, and reports the message
        /// as handled so the shell stops routing it.
        ///
        /// SendMessage (not PostMessage) on purpose: it goes directly to the
        /// window procedure, so the key cannot come back around through the
        /// message pump and into this method again.
        ///
        /// Only the search chords are taken, and only while the keyboard focus is
        /// inside our WebView2 — every other key keeps VS's normal behaviour.
        /// </summary>
        protected override bool PreProcessMessage(ref System.Windows.Forms.Message m)
        {
            if (m.Msg == WM_KEYDOWN && IsWebviewSearchKey(m.WParam.ToInt32()) && _control.IsWebViewKeyboardFocused)
            {
                IntPtr focused = GetFocus();
                if (focused != IntPtr.Zero)
                {
                    SendMessage(focused, m.Msg, m.WParam, m.LParam);
                    return true;
                }
            }
            return base.PreProcessMessage(ref m);
        }

        /// <summary>Ctrl+F / Ctrl+G / F3 — the shortcuts the webview itself implements.</summary>
        private static bool IsWebviewSearchKey(int virtualKey)
        {
            if (virtualKey == VK_F3) return true;
            bool ctrl = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
            return ctrl && (virtualKey == VK_F || virtualKey == VK_G);
        }

        /// <summary>Bind the window to the repository of the current solution.</summary>
        public void Initialize(IServiceProvider serviceProvider)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            var startDirs = ResolveStartDirectories(serviceProvider);
            _ = _control.SetRepositoryAsync(startDirs);
        }

        /// <summary>
        /// Collect candidate directories that may sit inside the active
        /// repository, most-specific first. Any directory inside the work tree
        /// is enough — <see cref="GitService.FindRepoRootAsync"/> walks up to the
        /// root with <c>git rev-parse</c>. We gather from several sources because
        /// no single API covers both classic solutions and Open Folder mode.
        /// </summary>
        private static IReadOnlyList<string> ResolveStartDirectories(IServiceProvider serviceProvider)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            var dirs = new List<string>();
            void Add(string path)
            {
                var d = ToExistingDirectory(path);
                if (d != null && !dirs.Contains(d)) dirs.Add(d);
            }

            // 1. IVsSolution reports the solution/workspace directory in BOTH
            //    classic-solution and Open Folder modes.
            try
            {
                if (serviceProvider.GetService(typeof(SVsSolution)) is IVsSolution sol &&
                    sol.GetSolutionInfo(out string slnDir, out string slnFile, out _) == VSConstants.S_OK)
                {
                    Add(slnDir);
                    Add(slnFile);
                }
            }
            catch { /* fall through to DTE */ }

            // 2. DTE fallbacks: solution file, loaded projects, active document.
            try
            {
                if (serviceProvider.GetService(typeof(DTE)) is DTE2 dte)
                {
                    Add(dte.Solution?.FullName);
                    if (dte.Solution?.Projects?.Count > 0)
                    {
                        for (int i = 1; i <= dte.Solution.Projects.Count && i <= 5; i++)
                        {
                            try { Add(dte.Solution.Projects.Item(i)?.FullName); } catch { }
                        }
                    }
                    try { Add(dte.ActiveDocument?.FullName); } catch { }
                }
            }
            catch { /* fall through */ }

            Add(Environment.CurrentDirectory);
            return dirs;
        }

        /// <summary>Resolve a file or directory path to an existing directory.</summary>
        private static string ToExistingDirectory(string path)
        {
            if (string.IsNullOrEmpty(path)) return null;
            try
            {
                if (Directory.Exists(path)) return path;
                var dir = Path.GetDirectoryName(path);
                return (!string.IsNullOrEmpty(dir) && Directory.Exists(dir)) ? dir : null;
            }
            catch
            {
                return null;
            }
        }
    }
}
