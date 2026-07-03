package com.hunkontech.revgraph;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.IAdaptable;
import org.eclipse.jface.viewers.IStructuredSelection;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;

/**
 * Collects candidate directories that may sit inside the active repository,
 * most-specific first — any directory inside the work tree is enough, since
 * {@link com.hunkontech.revgraph.git.GitService#findRepoRoot} walks up to the
 * root with {@code git rev-parse}. Mirrors RepoResolver.kt (JetBrains) and
 * ResolveStartDirectories in vs/RevisionGraphToolWindow.cs.
 */
public final class RepoResolver {

    private RepoResolver() {
    }

    public static List<String> resolveStartDirectories() {
        LinkedHashSet<String> dirs = new LinkedHashSet<>();

        // 1. The project of the current workbench selection wins (most specific).
        IProject selected = selectedProject();
        if (selected != null) {
            addProject(dirs, selected);
        }

        // 2. Every other open project in the workspace.
        for (IProject p : ResourcesPlugin.getWorkspace().getRoot().getProjects()) {
            addProject(dirs, p);
        }

        // 3. Fall back to the process working directory.
        add(dirs, System.getProperty("user.dir"));

        return new ArrayList<>(dirs);
    }

    private static void addProject(LinkedHashSet<String> dirs, IProject project) {
        if (project == null || !project.isOpen() || project.getLocation() == null) {
            return;
        }
        add(dirs, project.getLocation().toOSString());
    }

    private static void add(LinkedHashSet<String> dirs, String path) {
        String dir = toExistingDirectory(path);
        if (dir != null) {
            dirs.add(dir);
        }
    }

    private static String toExistingDirectory(String path) {
        if (path == null || path.isEmpty()) {
            return null;
        }
        try {
            File f = new File(path);
            if (f.isDirectory()) {
                return f.getCanonicalPath();
            }
            File parent = f.getParentFile();
            if (parent != null && parent.isDirectory()) {
                return parent.getCanonicalPath();
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    /** The project owning whatever is selected in the active workbench window, if any. */
    private static IProject selectedProject() {
        try {
            IWorkbenchWindow win = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
            if (win == null) {
                return null;
            }
            Object sel = win.getSelectionService().getSelection();
            if (sel instanceof IStructuredSelection) {
                Object first = ((IStructuredSelection) sel).getFirstElement();
                IResource resource = adaptToResource(first);
                if (resource != null) {
                    return resource.getProject();
                }
            }
        } catch (Exception e) {
            // PlatformUI may be unavailable (headless) — fall through to null.
        }
        return null;
    }

    private static IResource adaptToResource(Object element) {
        if (element instanceof IResource) {
            return (IResource) element;
        }
        if (element instanceof IAdaptable) {
            return ((IAdaptable) element).getAdapter(IResource.class);
        }
        return null;
    }
}
