import { PermissionBuilder } from "@rise-bot/shared/contracts";

// Build default permissions using the shared permission builder
const defaultPermissions = PermissionBuilder.createDefaultPermissions().build();

// Use the built permissions as PERMISSION_ITEMS
export const PERMISSION_ITEMS = defaultPermissions;

// Default selections (all enabled)
export const DEFAULT_SELECTIONS = {
  calls: PERMISSION_ITEMS.calls.map(item => item.id),
  spend: PERMISSION_ITEMS.spend.map(item => item.id),
};

// Helper function to build permissions based on selections
export function buildPermissionsFromSelections(selections: {
  calls: string[];
  spend: string[];
}) {
  const calls = PERMISSION_ITEMS.calls
    .filter(item => selections.calls.includes(item.id))
    .map(item => item.call)
    .filter((call): call is NonNullable<typeof call> => call !== undefined);

  const spend = PERMISSION_ITEMS.spend
    .filter(item => selections.spend.includes(item.id))
    .map(item => item.spend)
    .filter((spendItem): spendItem is NonNullable<typeof spendItem> => spendItem !== undefined);

  return {
    calls,
    spend,
  };
}