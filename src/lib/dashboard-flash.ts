export type DashboardFlashSearchParams = Record<string, string | string[] | undefined>;

export function hasSettingsSavedFlash(searchParams: DashboardFlashSearchParams) {
  const value = searchParams.settingsSaved;
  return (Array.isArray(value) ? value[0] : value) === "1";
}
