package com.hunkontech.revgraph

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.DumbAware

/**
 * Opens the revision graph as a center editor tab. Registered under Tools and
 * the Git menu; reopening focuses the existing tab because all
 * [RevisionGraphVirtualFile] instances compare equal.
 */
class OpenRevisionGraphAction : AnAction(), DumbAware {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        FileEditorManager.getInstance(project).openFile(RevisionGraphVirtualFile.INSTANCE, true)
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
