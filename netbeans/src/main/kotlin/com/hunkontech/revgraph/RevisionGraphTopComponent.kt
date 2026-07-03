package com.hunkontech.revgraph

import org.openide.windows.TopComponent
import java.awt.BorderLayout

/**
 * The revision-graph window. Opens in the `editor` mode so it lands as a full
 * center tab (largest possible surface), matching the JetBrains host's
 * RevisionGraphFileEditor and the VS tool window. Registered with
 * PERSISTENCE_NEVER — it is a transient view of live git state, never restored
 * across restarts.
 *
 * A single shared instance is reused (see [getInstance]) so re-invoking the
 * Tools ▸ Revision Graph action focuses the existing tab instead of stacking
 * new ones, mirroring RevisionGraphVirtualFile's equals-based reuse on the
 * JetBrains side.
 */
class RevisionGraphTopComponent private constructor() : TopComponent() {

    private val host = NetBeansWebViewHost()

    init {
        setName("Revision Graph")
        setDisplayName("Revision Graph")
        toolTipText = "TortoiseSVN-style revision graph for Git"
        layout = BorderLayout()
        add(host.component, BorderLayout.CENTER)
    }

    override fun getPersistenceType(): Int = TopComponent.PERSISTENCE_NEVER

    override fun componentOpened() {
        host.setRepository(NetBeansRepoResolver.resolveStartDirectories())
    }

    override fun componentClosed() {
        host.dispose()
    }

    companion object {
        @Volatile
        private var instance: RevisionGraphTopComponent? = null

        /** Lazily create (once) and return the shared singleton window. */
        @Synchronized
        fun getInstance(): RevisionGraphTopComponent =
            instance ?: RevisionGraphTopComponent().also { instance = it }
    }
}
