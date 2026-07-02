package com.hunkontech.revgraph

import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.util.IconLoader
import javax.swing.Icon

/**
 * A synthetic, binary file type carried by [RevisionGraphVirtualFile] so the
 * platform routes the file only to [RevisionGraphFileEditorProvider] and never
 * attaches the default text editor. Marked binary for exactly that reason —
 * there is no real file content behind it.
 */
object RevisionGraphFileType : FileType {
    override fun getName(): String = "RevisionGraph"
    override fun getDescription(): String = "SVN-style Git revision graph"
    override fun getDefaultExtension(): String = ""
    override fun getIcon(): Icon? = IconLoader.findIcon("/icons/revisionGraph.svg", javaClass)
    override fun isBinary(): Boolean = true
    override fun isReadOnly(): Boolean = true
}
