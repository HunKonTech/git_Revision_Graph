package com.hunkontech.revgraph

import com.intellij.testFramework.LightVirtualFile

/**
 * The lightweight, in-memory "file" that stands in for the revision graph so it
 * can be opened as a tab in the center editor area (instead of a docked tool
 * window). All instances compare equal so [com.intellij.openapi.fileEditor.FileEditorManager]
 * reuses the already-open tab rather than stacking duplicates; a single shared
 * [INSTANCE] is enough since it holds no per-project state.
 */
class RevisionGraphVirtualFile private constructor() :
    LightVirtualFile("Revision Graph", RevisionGraphFileType, "") {

    override fun equals(other: Any?): Boolean = other is RevisionGraphVirtualFile
    override fun hashCode(): Int = javaClass.hashCode()

    companion object {
        val INSTANCE: RevisionGraphVirtualFile = RevisionGraphVirtualFile()
    }
}
