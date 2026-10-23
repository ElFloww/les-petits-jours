using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Net.Sockets;
using Advent.Application;
using Microsoft.Extensions.Configuration;

namespace Advent.Infrastructure;

public sealed class SmtpEmailSender(IConfiguration configuration) : IEmailSender
{
    private string? Host => configuration["Smtp:Host"];
    private string? FromAddress => configuration["Smtp:FromAddress"];
    private string SenderName => configuration["Email:SenderName"] is { Length: > 0 } name ? name : "Florent";
    public string? PasswordResetBaseUrl => configuration["PasswordReset:BaseUrl"];
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host) &&
        !string.IsNullOrWhiteSpace(FromAddress) &&
        Uri.TryCreate(PasswordResetBaseUrl, UriKind.Absolute, out var uri) &&
        uri.Scheme is "https" or "http";

    public Task SendPasswordReset(string email, string displayName, string link, CancellationToken ct) =>
        Send(email, displayName, link, EmailTemplates.PasswordReset(displayName), ct);

    public Task SendCalendarInvitation(string email, string displayName, string link, CancellationToken ct) =>
        Send(email, displayName, link, EmailTemplates.Invitation(displayName, SenderName), ct);

    private async Task Send(string email, string displayName, string link, EmailContent content, CancellationToken ct)
    {
        var host = Host;
        var fromAddress = FromAddress;
        if (!IsConfigured || host is null || fromAddress is null)
            throw new InvalidOperationException("Le service SMTP et PasswordReset:BaseUrl doivent être configurés.");

        try
        {
            var hero = ReadImage(EmailTemplates.HeroImage);
            var footer = ReadImage(EmailTemplates.FooterImage);
            var withImages = hero is not null && footer is not null;

            using var message = new MailMessage
            {
                From = new MailAddress(fromAddress, configuration["Smtp:FromName"] ?? "Les petits jours"),
                Subject = content.Subject
            };
            message.To.Add(new MailAddress(email));

            // The last alternative is the preferred one: plain text first, then the decorated HTML.
            message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
                EmailTemplates.Text(content, displayName, link), null, MediaTypeNames.Text.Plain));
            var htmlView = AlternateView.CreateAlternateViewFromString(
                EmailTemplates.Html(content, displayName, link, withImages), null, MediaTypeNames.Text.Html);
            if (withImages)
            {
                htmlView.LinkedResources.Add(Image(hero!, EmailTemplates.HeroImage));
                htmlView.LinkedResources.Add(Image(footer!, EmailTemplates.FooterImage));
            }
            message.AlternateViews.Add(htmlView);

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

    private static byte[]? ReadImage(string name)
    {
        using var stream = typeof(SmtpEmailSender).Assembly.GetManifestResourceStream($"Emails.{name}.png");
        if (stream is null) return null;
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        return memory.ToArray();
    }

    private static LinkedResource Image(byte[] bytes, string contentId) =>
        new(new MemoryStream(bytes), MediaTypeNames.Image.Png)
        {
            ContentId = contentId,
            TransferEncoding = TransferEncoding.Base64
        };
}
