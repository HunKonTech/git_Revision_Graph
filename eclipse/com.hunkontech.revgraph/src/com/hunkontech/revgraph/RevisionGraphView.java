package com.hunkontech.revgraph;

import org.eclipse.swt.widgets.Composite;
import org.eclipse.ui.part.ViewPart;

/**
 * The Eclipse surface for the revision graph: a {@link ViewPart} that hosts the
 * shared web renderer through a {@link WebViewHost}. The JetBrains host opens
 * the graph as a full center editor tab; Eclipse's idiomatic home for a
 * history-style graph is a view (the built-in Git "History" is likewise a
 * view), so we use one here. Same shared renderer, same protocol, same
 * behaviour as every other host.
 */
public final class RevisionGraphView extends ViewPart {

    public static final String ID = "com.hunkontech.revgraph.view";

    private WebViewHost host;

    @Override
    public void createPartControl(Composite parent) {
        host = new WebViewHost(parent);
        host.setRepository(RepoResolver.resolveStartDirectories());
    }

    @Override
    public void setFocus() {
        if (host != null) {
            host.setFocus();
        }
    }

    @Override
    public void dispose() {
        if (host != null) {
            host.dispose();
            host = null;
        }
        super.dispose();
    }
}
