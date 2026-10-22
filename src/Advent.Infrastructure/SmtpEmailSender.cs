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

    public Task SendPasswordReset(string email, string displayName, string link, CancellationToken ct) =>
        Send(email, displayName, link,
            "Réinitialisation de votre mot de passe — Les petits jours",
            "Pour choisir un nouveau mot de passe, utilisez le lien ci-dessous.",
            "Réinitialiser mon mot de passe",
            "Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.",
            ct);

    public Task SendCalendarInvitation(string email, string displayName, string link, CancellationToken ct) =>
        Send(email, displayName, link,
            "Votre calendrier de l’Avent vous attend — Les petits jours",
            "Votre calendrier de l’Avent vous attend ! Cliquez ci-dessous pour définir le mot de passe qui vous permettra d’accéder à l’application.",
            "Définir mon mot de passe",
            "Ce lien expire dans 30 minutes et ne peut être utilisé qu’une seule fois.",
            ct);

    private async Task Send(string email, string displayName, string link, string subject,
        string introduction, string action, string note, CancellationToken ct)
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
                Subject = subject,
                Body = $"<p>Bonjour {escapedName},</p><p>{HtmlEncoder.Default.Encode(introduction)}</p><p><a href=\"{escapedLink}\">{HtmlEncoder.Default.Encode(action)}</a></p><p>{HtmlEncoder.Default.Encode(note)}</p>",
                IsBodyHtml = true
            };
            message.To.Add(new MailAddress(email));
            message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
                $"Bonjour {displayName},\n\n{introduction}\n\n{action} :\n{link}\n\n{note}",
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
            throw new EmailDeliveryException("L’email n’a pas pu être envoyé.", exception);
        }
    }
}
