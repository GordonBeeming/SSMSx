using Microsoft.Data.SqlClient;
using Ssmsx.Core.Credentials;
using Ssmsx.Protocol.Models;

namespace Ssmsx.Core.Connections;

public class SqlConnectionFactory
{
    public async Task<SqlConnection> CreateAsync(
        ConnectionInfo info,
        ICredentialStore credentialStore,
        string? inlinePassword = null,
        CancellationToken ct = default)
    {
        return info.AuthType switch
        {
            AuthType.ConnectionString => await OpenConnectionAsync(
                info.ConnectionString ?? throw new ArgumentException("ConnectionString is required for ConnectionString auth type"),
                ct),
            AuthType.SqlAuth => await OpenConnectionAsync(
                BuildSqlAuthConnectionString(info, await ResolvePassword(info, credentialStore, inlinePassword)),
                ct),
            AuthType.EntraMfa => await CreateEntraMfaConnectionAsync(info, ct),
            _ => throw new ArgumentException($"Unknown auth type: {info.AuthType}")
        };
    }

    private static async Task<SqlConnection> OpenConnectionAsync(string connectionString, CancellationToken ct)
    {
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }

    private async Task<SqlConnection> CreateEntraMfaConnectionAsync(ConnectionInfo info, CancellationToken ct)
    {
        var connection = new SqlConnection(BuildEntraMfaConnectionString(info));
        await connection.OpenAsync(ct);
        return connection;
    }

    internal static string BuildEntraMfaConnectionString(ConnectionInfo info)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = info.ServerName,
            Authentication = SqlAuthenticationMethod.ActiveDirectoryInteractive,
            ConnectTimeout = 15,
            Encrypt = MapEncrypt(info.Encrypt),
            TrustServerCertificate = info.TrustServerCertificate
        };

        if (!string.IsNullOrEmpty(info.Username))
            builder.UserID = info.Username;

        if (!string.IsNullOrEmpty(info.Database))
            builder.InitialCatalog = info.Database;

        return builder.ConnectionString;
    }

    private static string BuildSqlAuthConnectionString(ConnectionInfo info, string password)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = info.ServerName,
            UserID = info.Username ?? throw new ArgumentException("Username is required for SQL Auth"),
            Password = password,
            ConnectTimeout = 15,
            Encrypt = MapEncrypt(info.Encrypt),
            TrustServerCertificate = info.TrustServerCertificate
        };

        if (!string.IsNullOrEmpty(info.Database))
            builder.InitialCatalog = info.Database;

        return builder.ConnectionString;
    }

    private static SqlConnectionEncryptOption MapEncrypt(EncryptMode encrypt) =>
        encrypt switch
        {
            EncryptMode.Mandatory => SqlConnectionEncryptOption.Mandatory,
            EncryptMode.Optional => SqlConnectionEncryptOption.Optional,
            EncryptMode.Strict => SqlConnectionEncryptOption.Strict,
            _ => SqlConnectionEncryptOption.Mandatory
        };

    private static async Task<string> ResolvePassword(
        ConnectionInfo info,
        ICredentialStore credentialStore,
        string? inlinePassword)
    {
        if (!string.IsNullOrEmpty(inlinePassword))
            return inlinePassword;

        if (!string.IsNullOrEmpty(info.CredentialRef))
        {
            var stored = await credentialStore.RetrieveAsync(info.CredentialRef);
            if (stored != null)
                return stored;
        }

        throw new InvalidOperationException("No password available: provide inline password or store credentials");
    }
}
