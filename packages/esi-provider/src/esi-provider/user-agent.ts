/**
 *
 * @param appName Application name
 * @param appVersion Application version
 * @param appContact Means of contacting the application owner
 * @returns User-Agent string
 */
export const buildUserAgent = (
  appName: string,
  appVersion: string,
  appContact: string | Array<string>,
) => {
  if (!appName) {
    throw new Error("appName is required");
  }
  if (!appVersion) {
    throw new Error("appVersion is required");
  }
  if (!appContact) {
    throw new Error("appContact is required");
  }

  const appContactString = Array.isArray(appContact)
    ? appContact.join("; ")
    : appContact;
  const userAgent = `${appName}/${appVersion} (${appContactString})`;

  return userAgent;
};
