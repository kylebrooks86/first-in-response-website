/** Scope the legacy FIRE marketing website audit to its actual site files.
 *
 * Business App Parity fixture HTML and calculator source fixtures are stored
 * in this monorepo but are NOT pages deployed under firstinresponseexteriors.com.
 * Keep every other HTML file subject to the website verifier: a newly added
 * marketing page must not be silently excluded just because it wasn't in the
 * previous 14-page inventory.
 */
export function isWebsiteHtml(relativePath) {
  return typeof relativePath === "string" &&
    relativePath.endsWith(".html") &&
    !relativePath.startsWith("calculator/") &&
    !relativePath.startsWith("business-app-parity/");
}

export function websiteHtmlFiles(allPaths) {
  return allPaths.filter(isWebsiteHtml);
}
