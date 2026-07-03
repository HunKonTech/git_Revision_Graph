package com.hunkontech.revgraph

import org.openide.awt.ActionID
import org.openide.awt.ActionReference
import org.openide.awt.ActionRegistration
import org.openide.windows.WindowManager
import java.awt.event.ActionEvent
import java.awt.event.ActionListener

/**
 * Opens the revision graph as a center editor tab. Registered under the Tools
 * menu via NetBeans action annotations (the module's generated layer wires it
 * in — no hand-written layer.xml). Reopening focuses the existing tab because
 * [RevisionGraphTopComponent.getInstance] returns the same shared instance.
 *
 * NetBeans counterpart of jetbrains/common/.../OpenRevisionGraphAction.kt
 * (an IntelliJ AnAction) and vs/'s command-registered tool window.
 */
// iconBase intentionally omitted: NetBeans' iconBase resolves PNG resources,
// and this module ships only SVG branding; a text-only Tools-menu entry avoids
// bundling a raster icon just for the menu.
@ActionID(category = "Tools", id = "com.hunkontech.revgraph.OpenRevisionGraphAction")
@ActionRegistration(displayName = "Revision Graph")
@ActionReference(path = "Menu/Tools", position = 3333)
class OpenRevisionGraphAction : ActionListener {

    override fun actionPerformed(e: ActionEvent) {
        val tc = RevisionGraphTopComponent.getInstance()
        // Dock into the center editor area (largest surface), matching the
        // JetBrains host's editor-tab presentation, rather than a side dock.
        WindowManager.getDefault().findMode("editor")?.dockInto(tc)
        tc.open()
        tc.requestActive()
    }
}
