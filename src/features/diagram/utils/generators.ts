import type {
  DatabaseDiagramInfo,
  DiagramColumnInfo,
  DiagramRelationshipInfo,
  DiagramTableInfo,
} from "../../explorer/types";

export interface EfGenerationOptions {
  namespace: string;
  dbContextName: string;
}

function quoteSqlName(name: string): string {
  return `[${name.replaceAll("]", "]]")}]`;
}

function toPascalCase(value: string): string {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  const result = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  return result || "Entity";
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function tableTypeName(table: DiagramTableInfo): string {
  return toPascalCase(table.name);
}

function propertyName(column: DiagramColumnInfo): string {
  return toPascalCase(column.name);
}

function sqlColumnDefinition(column: DiagramColumnInfo): string {
  const identity = column.isIdentity ? " IDENTITY(1,1)" : "";
  const defaultValue = column.defaultDefinition ? ` DEFAULT ${column.defaultDefinition}` : "";
  const nullable = column.isNullable && !column.isPrimaryKey ? " NULL" : " NOT NULL";
  return `    ${quoteSqlName(column.name)} ${column.dataType}${identity}${defaultValue}${nullable}`;
}

export function generateSqlDiagramScript(diagram: DatabaseDiagramInfo): string {
  const createTables = diagram.tables.map((table) => {
    const columns = table.columns.map(sqlColumnDefinition);
    if (table.primaryKey.length > 0) {
      columns.push(
        `    CONSTRAINT ${quoteSqlName(`PK_${table.name}`)} PRIMARY KEY (${table.primaryKey
          .map(quoteSqlName)
          .join(", ")})`
      );
    }

    return `CREATE TABLE ${quoteSqlName(table.schema)}.${quoteSqlName(table.name)}\n(\n${columns.join(
      ",\n"
    )}\n);`;
  });

  const relationships = diagram.relationships.map(
    (relationship) =>
      `ALTER TABLE ${quoteSqlName(relationship.fromSchema)}.${quoteSqlName(
        relationship.fromTable
      )}\nADD CONSTRAINT ${quoteSqlName(relationship.name)} FOREIGN KEY (${relationship.fromColumns
        .map(quoteSqlName)
        .join(", ")})\nREFERENCES ${quoteSqlName(relationship.toSchema)}.${quoteSqlName(
        relationship.toTable
      )} (${relationship.toColumns.map(quoteSqlName).join(", ")});`
  );

  return [...createTables, ...relationships].join("\n\n");
}

function csharpType(column: DiagramColumnInfo): string {
  const normalized = column.dataType.toLowerCase().replace(/\(.+\)/, "");
  const nullable = column.isNullable && !column.isPrimaryKey;

  const type = (() => {
    switch (normalized) {
      case "bigint":
        return "long";
      case "int":
        return "int";
      case "smallint":
        return "short";
      case "tinyint":
        return "byte";
      case "bit":
        return "bool";
      case "decimal":
      case "numeric":
      case "money":
      case "smallmoney":
        return "decimal";
      case "float":
        return "double";
      case "real":
        return "float";
      case "date":
      case "datetime":
      case "datetime2":
      case "smalldatetime":
        return "DateTime";
      case "datetimeoffset":
        return "DateTimeOffset";
      case "time":
        return "TimeSpan";
      case "uniqueidentifier":
        return "Guid";
      case "binary":
      case "varbinary":
      case "image":
      case "rowversion":
      case "timestamp":
        return "byte[]";
      default:
        return "string";
    }
  })();

  if (type === "string" || type.endsWith("[]")) {
    return nullable ? `${type}?` : type;
  }

  return nullable ? `${type}?` : type;
}

function navigationName(relationship: DiagramRelationshipInfo): string {
  return tableTypeName({
    schema: relationship.toSchema,
    name: relationship.toTable,
    rowCount: 0,
    columns: [],
    primaryKey: [],
  });
}

function collectionName(table: string): string {
  const pascal = toPascalCase(table);
  return pascal.endsWith("s") ? pascal : `${pascal}s`;
}

export function generateEfCoreScaffold(
  diagram: DatabaseDiagramInfo,
  options: EfGenerationOptions
): string {
  const namespace = options.namespace.trim() || "Ssmsx.Domain";
  const dbContextName = options.dbContextName.trim() || `${toPascalCase(diagram.database)}DbContext`;

  const relationshipsByFrom = new Map<string, DiagramRelationshipInfo[]>();
  for (const relationship of diagram.relationships) {
    const key = `${relationship.fromSchema}.${relationship.fromTable}`;
    relationshipsByFrom.set(key, [...(relationshipsByFrom.get(key) ?? []), relationship]);
  }

  const entities = diagram.tables.map((table) => {
    const className = tableTypeName(table);
    const lines = [
      `public sealed class ${className}`,
      "{",
      ...table.columns.map(
        (column) => `    public ${csharpType(column)} ${propertyName(column)} { get; set; }`
      ),
    ];

    for (const relationship of relationshipsByFrom.get(`${table.schema}.${table.name}`) ?? []) {
      lines.push(
        `    public ${navigationName(relationship)}? ${navigationName(relationship)} { get; set; }`
      );
    }

    lines.push("}");
    return lines.join("\n");
  });

  const configurations = diagram.tables.map((table) => {
    const className = tableTypeName(table);
    const entity = toCamelCase(className);
    const lines = [
      `public sealed class ${className}Configuration : IEntityTypeConfiguration<${className}>`,
      "{",
      `    public void Configure(EntityTypeBuilder<${className}> ${entity})`,
      "    {",
      `        ${entity}.ToTable("${table.name}", "${table.schema}");`,
    ];

    if (table.primaryKey.length > 0) {
      const keyExpression =
        table.primaryKey.length === 1
          ? `x.${propertyName({ name: table.primaryKey[0], dataType: "", isNullable: false, isIdentity: false, isPrimaryKey: true, isForeignKey: false })}`
          : `new { ${table.primaryKey
              .map((column) => `x.${propertyName({ name: column, dataType: "", isNullable: false, isIdentity: false, isPrimaryKey: true, isForeignKey: false })}`)
              .join(", ")} }`;
      lines.push(`        ${entity}.HasKey(x => ${keyExpression});`);
    }

    for (const column of table.columns) {
      const prop = propertyName(column);
      lines.push(`        ${entity}.Property(x => x.${prop}).HasColumnName("${column.name}");`);
      if (column.isIdentity) {
        lines.push(`        ${entity}.Property(x => x.${prop}).ValueGeneratedOnAdd();`);
      }
    }

    for (const relationship of relationshipsByFrom.get(`${table.schema}.${table.name}`) ?? []) {
      if (relationship.fromColumns.length === 1) {
        lines.push(
          `        ${entity}.HasOne(x => x.${navigationName(relationship)})`,
          "            .WithMany()",
          `            .HasForeignKey(x => x.${toPascalCase(relationship.fromColumns[0])})`,
          `            .HasConstraintName("${relationship.name}");`
        );
      }
    }

    lines.push("    }", "}");
    return lines.join("\n");
  });

  const dbSets = diagram.tables
    .map((table) => `    public DbSet<${tableTypeName(table)}> ${collectionName(table.name)} => Set<${tableTypeName(table)}>();`)
    .join("\n");

  const configRegistrations = diagram.tables
    .map((table) => `        modelBuilder.ApplyConfiguration(new ${tableTypeName(table)}Configuration());`)
    .join("\n");

  const context = [
    `public sealed class ${dbContextName} : DbContext`,
    "{",
    `    public ${dbContextName}(DbContextOptions<${dbContextName}> options) : base(options)`,
    "    {",
    "    }",
    "",
    dbSets,
    "",
    "    protected override void OnModelCreating(ModelBuilder modelBuilder)",
    "    {",
    "        base.OnModelCreating(modelBuilder);",
    configRegistrations,
    "    }",
    "}",
  ].join("\n");

  return [
    "using Microsoft.EntityFrameworkCore;",
    "using Microsoft.EntityFrameworkCore.Metadata.Builders;",
    "",
    `namespace ${namespace};`,
    "",
    "// Domain entities",
    ...entities,
    "",
    "// Split entity configurations",
    ...configurations,
    "",
    "// DbContext and DbSets",
    context,
  ].join("\n\n");
}
