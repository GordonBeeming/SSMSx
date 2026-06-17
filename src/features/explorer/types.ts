export type ExplorerNodeType =
  | "server"
  | "database"
  | "folder"
  | "schema"
  | "table"
  | "view"
  | "column"
  | "key"
  | "index"
  | "procedure"
  | "function"
  | "user"
  | "diagram";

export interface ExplorerNode {
  id: string;
  connectionId: string;
  type: ExplorerNodeType;
  name: string;
  label?: string;
  schema?: string;
  database?: string;
  tableName?: string;
  diagramViewId?: string;
  expanded: boolean;
  loading: boolean;
  loaded: boolean;
  children: string[];
  parentId: string | null;
  color?: string;
  hasChildren: boolean;
  folderKind?: string;
}

export interface DatabaseInfo {
  name: string;
  state: string;
  compatibilityLevel: number;
  collationName?: string;
  recoveryModel?: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  rowCount: number;
  createDate?: string;
}

export interface ViewInfo {
  schema: string;
  name: string;
  createDate?: string;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  maxLength: number;
  precision: number;
  scale: number;
  isNullable: boolean;
  defaultValue?: string;
  isIdentity: boolean;
  isComputed: boolean;
}

export interface KeyInfo {
  name: string;
  type: string;
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

export interface IndexInfo {
  name: string;
  type: string;
  isUnique: boolean;
  columns: string[];
  includedColumns?: string[];
}

export interface StoredProcedureInfo {
  schema: string;
  name: string;
  createDate?: string;
  modifyDate?: string;
}

export interface FunctionInfo {
  schema: string;
  name: string;
  type: string;
  createDate?: string;
  modifyDate?: string;
}

export interface DatabaseUserInfo {
  name: string;
  type: string;
  defaultSchema?: string;
  loginName?: string;
}

export interface ObjectScriptResult {
  definition?: string;
}

export interface DatabaseDiagramInfo {
  database: string;
  tables: DiagramTableInfo[];
  relationships: DiagramRelationshipInfo[];
}

export interface DiagramTableInfo {
  schema: string;
  name: string;
  rowCount: number;
  columns: DiagramColumnInfo[];
  primaryKey: string[];
}

export interface DiagramColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isIdentity: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultDefinition?: string;
}

export interface DiagramRelationshipInfo {
  name: string;
  fromSchema: string;
  fromTable: string;
  fromColumns: string[];
  toSchema: string;
  toTable: string;
  toColumns: string[];
}
