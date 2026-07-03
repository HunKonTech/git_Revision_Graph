package com.hunkontech.revgraph;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PartInitException;
import org.eclipse.ui.handlers.HandlerUtil;

/**
 * Opens (or focuses) the {@link RevisionGraphView}. Wired to the
 * {@code com.hunkontech.revgraph.open} command, which plugin.xml contributes to
 * the main menu. Counterpart of OpenRevisionGraphAction.kt (JetBrains) and the
 * VS Code {@code revGraph.show} command.
 */
public final class OpenRevisionGraphHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        IWorkbenchWindow window = HandlerUtil.getActiveWorkbenchWindowChecked(event);
        try {
            window.getActivePage().showView(RevisionGraphView.ID);
        } catch (PartInitException e) {
            throw new ExecutionException("Could not open the Revision Graph view", e);
        }
        return null;
    }
}
