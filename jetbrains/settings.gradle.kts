// The JetBrains-family host is a Gradle multi-project that produces THREE plugin
// distributions from ONE shared codebase (common/):
//   :deveco        — targeted at Huawei DevEco Studio (sideloaded ZIP)
//   :intellij      — targeted at mainstream JetBrains IDEs / IntelliJ IDEA
//                    (sideloaded ZIP + optional JetBrains Marketplace publish)
//   :androidstudio — targeted at Google Android Studio (sideloaded ZIP +
//                    optional JetBrains Marketplace publish)
// All flavors compile the exact same Kotlin sources in common/src/main/kotlin
// and bundle the same shared web renderer (common/src/main/resources/webview).
rootProject.name = "revision-graph-jetbrains"

include(":deveco", ":intellij", ":androidstudio")
