using System.Security.Cryptography;
using System.Text;
using Advent.Application;

namespace Advent.Infrastructure;

public sealed class PasswordService : IPasswordService
{
    private const int Iterations = 600_000;
    private readonly string dummyHash = CreateHash(Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));

    public string Hash(string password) => CreateHash(password);

    private static string CreateHash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2-sha256${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string? hash, string password)
    {
        var parts = (hash ?? dummyHash).Split('$');
        var derived = Rfc2898DeriveBytes.Pbkdf2(password, Convert.FromBase64String(parts[2]),
            int.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture), HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(derived, Convert.FromBase64String(parts[3])) && hash is not null;
    }
}

public sealed class SessionTokens : ISessionTokens
{
    public string Create() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
