package com.hunkontech.revgraph;

import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

/**
 * OSGi bundle activator. Exists mainly to expose the bundle to
 * {@link WebViewHost} so it can read the plugin version (to cache-bust the
 * extracted webview bundle) and the per-user state location (where JCEF-style
 * hosts can't, but SWT's {@code Browser} likewise needs a real file:// URL to
 * load the bundle from). The bundle symbolic name is the Eclipse counterpart
 * of the JetBrains {@code pluginGroup} / VS Code extension id.
 */
public final class Activator extends AbstractUIPlugin {

    public static final String PLUGIN_ID = "com.hunkontech.revgraph";

    private static Activator instance;

    @Override
    public void start(BundleContext context) throws Exception {
        super.start(context);
        instance = this;
    }

    @Override
    public void stop(BundleContext context) throws Exception {
        instance = null;
        super.stop(context);
    }

    public static Activator getDefault() {
        return instance;
    }
}
