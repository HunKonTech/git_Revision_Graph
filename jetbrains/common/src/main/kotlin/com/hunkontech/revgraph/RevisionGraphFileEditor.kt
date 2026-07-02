package com.hunkontech.revgraph

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorLocation
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.fileEditor.FileEditorStateLevel
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.UserDataHolderBase
import com.intellij.openapi.vfs.VirtualFile
import java.beans.PropertyChangeListener
import javax.swing.JComponent

/**
 * Hosts the shared web renderer in the center editor area as a full tab, giving
 * the graph the largest possible surface. This is the editor-tab counterpart of
 * the former docked tool window; it wraps the same [WebViewHostPanel] the tool
 * window used, so the git bridge and rendering are unchanged.
 */
class RevisionGraphFileEditor(
    project: Project,
    private val file: VirtualFile,
) : UserDataHolderBase(), FileEditor {

    private val panel = WebViewHostPanel(project)

    init {
        Disposer.register(this, panel)
        // Resolving the repo + reading git history are blocking I/O — run off the EDT.
        ApplicationManager.getApplication().executeOnPooledThread {
            val startDirs = RepoResolver.resolveStartDirectories(project)
            panel.setRepository(startDirs)
        }
    }

    override fun getComponent(): JComponent = panel.component
    override fun getPreferredFocusedComponent(): JComponent = panel.component
    override fun getName(): String = "Revision Graph"
    override fun getFile(): VirtualFile = file

    override fun setState(state: FileEditorState) {}
    override fun getState(level: FileEditorStateLevel): FileEditorState = FileEditorState.INSTANCE

    override fun isModified(): Boolean = false
    override fun isValid(): Boolean = true

    override fun addPropertyChangeListener(listener: PropertyChangeListener) {}
    override fun removePropertyChangeListener(listener: PropertyChangeListener) {}

    override fun getCurrentLocation(): FileEditorLocation? = null

    override fun dispose() {
        // panel is disposed via Disposer.register above.
    }
}
