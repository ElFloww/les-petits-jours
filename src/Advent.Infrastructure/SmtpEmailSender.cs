using System.Net;
using System.Net.Mail;
using System.Net.Sockets;
using System.Text.Encodings.Web;
using Advent.Application;
using Microsoft.Extensions.Configuration;

namespace Advent.Infrastructure;

public sealed class SmtpEmailSender(IConfiguration configuration) : IEmailSender
{
    private string? Host => configuration["Smtp:Host"];
    private string? FromAddress => configuration["Smtp:FromAddress"];
    public string? PasswordResetBaseUrl => configuration["PasswordReset:BaseUrl"];
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host) &&
        !string.IsNullOrWhiteSpace(FromAddress) &&
        Uri.TryCreate(PasswordResetBaseUrl, UriKind.Absolute, out var uri) &&
        uri.Scheme is "https" or "http";

    public async Task SendPasswordReset(string email, string displayName, string link, CancellationToken ct)
    {
        var host = Host;
        var fromAddress = FromAddress;
        if (!IsConfigured || host is null || fromAddress is null)
            throw new InvalidOperationException("Le service SMTP et PasswordReset:BaseUrl doivent être configurés.");

        try
        {
            var escapedName = HtmlEncoder.Default.Encode(displayName);
            var escapedLink = HtmlEncoder.Default.Encode(link);
            using var message = new MailMessage
            {
                From = new MailAddress(fromAddress, configuration["Smtp:FromName"] ?? "Les petits jours"),
                Subject = "Réinitialisation de votre mot de passe — Les petits jours",
                Body = $"<p>Bonjour {escapedName},</p><p>Pour choisir un nouveau mot de passe, utilisez le lien ci-dessous. Il expire dans 30 minutes et ne peut être utilisé qu’une fois.</p><p><a href=\"{escapedLink}\">Réinitialiser mon mot de passe</a></p><p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>",
                IsBodyHtml = true
            };
            message.To.Add(new MailAddress(email));
            message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
                $"Bonjour {displayName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :\n{link}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet email.",
                null, "text/plain"));

            var port = int.TryParse(configuration["Smtp:Port"], out var configuredPort) ? configuredPort : 587;
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = !bool.TryParse(configuration["Smtp:EnableSsl"], out var enableSsl) || enableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network
            };
            var username = configuration["Smtp:Username"];
            var password = configuration["Smtp:Password"];
            if (!string.IsNullOrEmpty(username))
                client.Credentials = new NetworkCredential(username, password);
            await client.SendMailAsync(message, ct);
        }
        catch (Exception exception) when (exception is SmtpException or FormatException or InvalidOperationException or IOException or SocketException)
        {
            throw new EmailDeliveryException("L’email de réinitialisation n’a pas pu être envoyé.", exception);
        }
    }
}
