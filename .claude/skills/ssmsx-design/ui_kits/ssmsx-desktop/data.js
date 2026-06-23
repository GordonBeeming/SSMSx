// Fake schema + result data for the SSMSX desktop UI kit. Not real — for visual recreation only.
window.SSMSX_DATA = {
  connections: [
    { id: "c1", name: "Prod — Reporting", serverName: "sql-prod-01.db", database: "Sales", username: "reader", authType: "EntraMfa", color: "var(--conn-red)" },
    { id: "c2", name: "Local Dev", serverName: "localhost,1433", database: "Northwind", username: "sa", authType: "SqlAuth", color: "var(--conn-green)" },
    { id: "c3", name: "Staging", serverName: "staging.internal", database: "App", authType: "ConnectionString", color: "var(--conn-amber)" },
  ],

  // Object Explorer tree, flattened with depth. `id` used for expand toggling.
  tree: [
    { id: "srv", type: "server", label: "sql-prod-01", depth: 0, hasChildren: true, color: "var(--conn-red)" },
    { id: "db-sales", type: "database", label: "Sales", depth: 1, hasChildren: true },
    { id: "f-tables", type: "folder", label: "Tables", depth: 2, hasChildren: true },
    { id: "t-customer", type: "table", label: "dbo.Customer", depth: 3, hasChildren: true },
    { id: "c-id", type: "column", label: "CustomerId  int  (PK, identity)", depth: 4 },
    { id: "c-name", type: "column", label: "Name  nvarchar(120)", depth: 4 },
    { id: "c-city", type: "column", label: "City  nvarchar(80)  null", depth: 4 },
    { id: "k-pk", type: "key", label: "PK_Customer", depth: 4 },
    { id: "ix-name", type: "index", label: "IX_Customer_Name", depth: 4 },
    { id: "t-orders", type: "table", label: "dbo.Orders", depth: 3, hasChildren: true },
    { id: "t-orderline", type: "table", label: "dbo.OrderLine", depth: 3, hasChildren: true },
    { id: "t-product", type: "table", label: "dbo.Product", depth: 3, hasChildren: true },
    { id: "f-views", type: "folder", label: "Views", depth: 2, hasChildren: true },
    { id: "v-sales", type: "view", label: "dbo.vMonthlySales", depth: 3 },
    { id: "f-prog", type: "folder", label: "Programmability", depth: 2, hasChildren: true, folderKind: "programmability" },
    { id: "p-orders", type: "procedure", label: "usp_GetOrders", depth: 3 },
    { id: "fn-tax", type: "function", label: "fn_CalcTax", depth: 3 },
    { id: "f-sec", type: "folder", label: "Security", depth: 2, hasChildren: true, folderKind: "security" },
    { id: "u-reader", type: "user", label: "reader", depth: 3 },
    { id: "f-diagrams", type: "folder", label: "Database Diagrams", depth: 2, hasChildren: true },
    { id: "dg-1", type: "diagram", label: "Sales overview", depth: 3 },
  ],
  // ids visible when collapsed to just server>db>folders (initial expanded set)
  expanded: ["srv", "db-sales", "f-tables"],

  sql: "SELECT TOP 100 c.CustomerId, c.Name, c.City, c.Country,\n       c.IsActive, c.CreatedAt\nFROM   dbo.Customer AS c\nWHERE  c.IsActive = 1\nORDER  BY c.Name;",

  columns: ["CustomerId", "Name", "City", "Country", "IsActive", "CreatedAt"],
  rows: [
    [1042, "Aurora Logistics", "Sydney", "AU", 1, "2023-02-11 09:14"],
    [1088, "Beacon Foods", "Melbourne", "AU", 1, "2023-03-02 14:51"],
    [1120, "Cobalt Systems", "Auckland", "NZ", 1, "2023-05-19 08:03"],
    [1153, "Delta Press", "Brisbane", "AU", 1, "2023-06-22 11:38"],
    [1201, "Evergreen Co", "Perth", "AU", 1, "2023-08-01 16:20"],
    [1247, "Forge Metals", "Hamilton", "NZ", 1, "2023-09-14 10:09"],
    [1290, "Granite Bank", "Sydney", "AU", 1, "2023-10-30 13:45"],
    [1334, "Harbor Freight", "Wellington", "NZ", 1, "2023-12-05 07:52"],
    [1378, "Ionic Labs", "Canberra", "AU", 1, "2024-01-18 09:31"],
    [1405, "Juniper Retail", "Adelaide", "AU", 1, "2024-02-27 15:14"],
    [1450, "Kelvin Cold Storage", "Christchurch", "NZ", 1, "2024-04-09 12:00"],
    [1492, "Lumen Energy", "Darwin", "AU", 1, "2024-05-21 08:47"],
  ],
  rowsAffected: 12,
  elapsed: "00:00:00.214",
};
