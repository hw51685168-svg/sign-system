type NamedRow = { id: string; name: string };
type UnitType = "department" | "store";

export type UnitOption = NamedRow & {
  type: UnitType;
  value: `${UnitType}:${string}`;
};

const departmentOrder = [
  "自媒體部門",
  "會計部門",
  "行政部門",
  "人事部門",
  "美工部門",
  "建設部門",
  "總公司"
];

const activeDepartmentNames = new Set(departmentOrder);

const departmentAliases: Record<string, string> = {
  自媒體部: "自媒體部門",
  會計部: "會計部門",
  行政部: "行政部門",
  人事部: "人事部門",
  美工部: "美工部門",
  建設部: "建設部門",
  總經理室: "總公司",
  倉管或採購單位: "行政部門",
  採購部: "行政部門",
  倉管部: "行政部門"
};

const storeLikeDepartmentKeywords = [
  "好腳舍",
  "EFS",
  "館",
  "門市",
  "服飾店",
  "瑞光",
  "仁武",
  "屏東",
  "中華",
  "台東"
];

const storeOrder = [
  "好腳舍屏東館",
  "好腳舍仁武館",
  "EFS中華館",
  "EFS屏東館"
];

const activeStoreNames = new Set(storeOrder);
const nonStoreNames = new Set(["總公司", "好腳舍足體養身會館"]);

const storeAliases: Record<string, string> = {
  屏東瑞光館: "好腳舍屏東館",
  好腳舍瑞光館: "好腳舍屏東館",
  好腳舍屏東瑞光館: "好腳舍屏東館",
  高雄仁武館: "好腳舍仁武館",
  好腳舍高雄仁武館: "好腳舍仁武館",
  EFS服飾店: "EFS中華館",
  EFS中華店: "EFS中華館",
  EFS屏東店: "EFS屏東館"
};

export function canonicalDepartmentName(name?: string | null) {
  const cleanName = name?.trim();
  if (!cleanName) return "未指定部門";
  return departmentAliases[cleanName] ?? cleanName;
}

export function isStoreLikeDepartmentName(name?: string | null) {
  const cleanName = canonicalDepartmentName(name);
  if (activeDepartmentNames.has(cleanName)) return false;
  return storeLikeDepartmentKeywords.some((keyword) => cleanName.includes(keyword));
}

export function canonicalStoreName(name?: string | null) {
  const cleanName = name?.trim();
  if (!cleanName) return "未指定館別";
  return storeAliases[cleanName] ?? cleanName;
}

export function visibleDepartmentOptions(departments: readonly NamedRow[]) {
  const byName = new Map<string, NamedRow>();

  for (const department of departments) {
    const label = canonicalDepartmentName(department.name);
    if (isStoreLikeDepartmentName(label)) continue;
    if (!activeDepartmentNames.has(label)) continue;
    if (!byName.has(label)) {
      byName.set(label, { ...department, name: label });
    }
  }

  return Array.from(byName.values()).sort((a, b) => {
    const orderA = departmentOrder.indexOf(a.name);
    const orderB = departmentOrder.indexOf(b.name);
    if (orderA !== -1 || orderB !== -1) {
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    }
    return a.name.localeCompare(b.name, "zh-Hant-TW");
  });
}

export function visibleStoreOptions(stores: readonly NamedRow[]) {
  const byName = new Map<string, NamedRow>();

  for (const store of stores) {
    const label = canonicalStoreName(store.name);
    if (!label || nonStoreNames.has(label)) continue;
    if (!activeStoreNames.has(label)) continue;
    if (!byName.has(label)) {
      byName.set(label, { ...store, name: label });
    }
  }

  return Array.from(byName.values()).sort((a, b) => {
    const orderA = storeOrder.indexOf(a.name);
    const orderB = storeOrder.indexOf(b.name);
    if (orderA !== -1 || orderB !== -1) {
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    }
    return a.name.localeCompare(b.name, "zh-Hant-TW");
  });
}

export function unitValue(type: UnitType, id: string): UnitOption["value"] {
  return `${type}:${id}`;
}

export function parseUnitValue(value?: string | null): { type: UnitType; id: string } | null {
  const [type, id] = String(value ?? "").split(":");
  if ((type === "department" || type === "store") && id) return { type, id };
  return null;
}

export function visibleUnitOptions(
  departments: readonly NamedRow[],
  stores: readonly NamedRow[]
): UnitOption[] {
  const departmentOptions = visibleDepartmentOptions(departments).map((department) => ({
    ...department,
    type: "department" as const,
    value: unitValue("department", department.id)
  }));
  const storeOptions = visibleStoreOptions(stores).map((store) => ({
    ...store,
    type: "store" as const,
    value: unitValue("store", store.id)
  }));

  return [...departmentOptions, ...storeOptions];
}
