package com.hunkontech.revgraph

import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.FileEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile

/**
 * Binds [RevisionGraphVirtualFile] to [RevisionGraphFileEditor] so opening that
 * file lands a full editor tab in the center area. [FileEditorPolicy.HIDE_DEFAULT_EDITOR]
 * keeps the platform from also offering a text editor for the synthetic file.
 */
class RevisionGraphFileEditorProvider : FileEditorProvider, DumbAware {

    override fun accept(project: Project, file: VirtualFile): Boolean =
        file is RevisionGraphVirtualFile

    override fun createEditor(project: Project, file: VirtualFile): FileEditor =
        RevisionGraphFileEditor(project, file)

    override fun getEditorTypeId(): String = "revision-graph-editor"

    override fun getPolicy(): FileEditorPolicy = FileEditorPolicy.HIDE_DEFAULT_EDITOR
}
