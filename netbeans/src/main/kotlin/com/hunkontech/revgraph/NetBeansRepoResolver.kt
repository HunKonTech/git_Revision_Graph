package com.hunkontech.revgraph

import com.hunkontech.revgraph.git.GitService
import org.netbeans.api.project.Project
import org.netbeans.api.project.ui.OpenProjects
import org.openide.filesystems.FileUtil
import java.io.File

/**
 * Collects candidate directories that may sit inside the active repository,
 * most-specific first — any directory inside the work tree is enough, since
 * [GitService.findRepoRoot] walks up to the root with `git rev-parse`. This is
 * the NetBeans counterpart of jetbrains/common/.../RepoResolver.kt (which uses
 * IntelliJ's ProjectRootManager) and vs/RevisionGraphToolWindow.cs's
 * ResolveStartDirectories.
 */
object NetBeansRepoResolver {

    fun resolveStartDirectories(): List<String> {
        val dirs = LinkedHashSet<String>()

        fun add(path: String?) {
            val dir = toExistingDirectory(path) ?: return
            dirs.add(dir)
        }

        // Every open project's directory (main project first).
        val open = OpenProjects.getDefault()
        add(projectDir(open.mainProject))
        for (p in open.openProjects) add(projectDir(p))

        // Fall back to the process working directory (matches RepoResolver.kt).
        add(System.getProperty("user.dir"))

        return dirs.toList()
    }

    private fun projectDir(project: Project?): String? {
        val fo = project?.projectDirectory ?: return null
        return FileUtil.toFile(fo)?.path
    }

    private fun toExistingDirectory(path: String?): String? {
        if (path.isNullOrEmpty()) return null
        return try {
            val f = File(path)
            when {
                f.isDirectory -> f.canonicalPath
                f.parentFile?.isDirectory == true -> f.parentFile.canonicalPath
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }
}
