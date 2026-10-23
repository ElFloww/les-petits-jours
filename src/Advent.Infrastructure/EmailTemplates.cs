using System.Text;
using System.Text.Encodings.Web;

namespace Advent.Infrastructure;

/// <summary>
/// The "Les petits jours" emails: a table-based, inline-styled layout (the only thing mail clients agree on)
/// that mirrors the site — green header with a string of lights, cream card, fir bough, candles on the mantel.
/// </summary>
internal sealed record EmailContent(string Subject, string Preheader, string Eyebrow, string TitleHtml,
    IReadOnlyList<string> Paragraphs, IReadOnlyList<string> Highlights, string Lead, string Action,
    string Note, string[] SignOff);

internal static class EmailTemplates
{
    public const string HeroImage = "hero";
    public const string FooterImage = "footer";

    private const string Cream = "#fffdf7";
    private const string Page = "#f3ecd9";
    private const string Forest = "#17402f";
    private const string Green = "#234a40";
    private const string Gold = "#e9c77e";
    private const string Red = "#a5293b";
    private const string Brick = "#aa523f";
    private const string Ink = "#4a554c";
    private const string Serif = "Georgia, 'Times New Roman', serif";
    private const string Sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

    private static readonly string[] BulbColors = ["#e8404f", "#f4c542", "#4fb3ff", "#58c27d", "#ff7fb0", "#f4c542", "#e8404f", "#4fb3ff", "#58c27d", "#ff7fb0", "#f4c542", "#e8404f", "#4fb3ff", "#58c27d"];

    public static EmailContent Invitation(string displayName, string senderName) => new(
        Subject: $"{senderName} t’a préparé un calendrier de l’Avent — Les petits jours",
        Preheader: $"{senderName} t’a préparé 24 petites surprises, une par jour du 1er au 24 décembre.",
        Eyebrow: $"UNE INVITATION DE {senderName.ToUpperInvariant()}",
        TitleHtml: $"Un peu de magie,<br><em style=\"color:{Brick};font-weight:400;\">rien que pour toi, {HtmlEncoder.Default.Encode(displayName)}.</em>",
        Paragraphs:
        [
            $"{senderName} t’a préparé un petit cadeau un peu particulier : un calendrier de l’Avent rien qu’à toi.",
            "Du 1er au 24 décembre, une case s’ouvre chaque jour sur une petite surprise : un mot doux, une blague, un souvenir, une photo, une vidéo… 24 petites attentions accrochées à une guirlande, pensées pour te faire sourire."
        ],
        Highlights:
        [
            "24 cadeaux à déballer, un par jour, du 1er au 24 décembre",
            "Un coin de Noël privé : il n’existe que pour toi",
            "Les jours manqués t’attendent sagement, rien ne se perd"
        ],
        Lead: "Pour entrer, il te suffit de choisir ton mot de passe :",
        Action: "Définir mon mot de passe",
        Note: $"Ce lien expire dans 30 minutes et ne peut être utilisé qu’une seule fois. S’il a expiré, demande simplement à {senderName} de t’en renvoyer un.",
        SignOff: ["À très vite sous le sapin,", senderName]);

    public static EmailContent PasswordReset(string displayName) => new(
        Subject: "Choisis un nouveau mot de passe — Les petits jours",
        Preheader: "Un petit coup de main pour retrouver ton calendrier.",
        Eyebrow: "UN PETIT COUP DE MAIN",
        TitleHtml: $"Un nouveau mot de passe,<br><em style=\"color:{Brick};font-weight:400;\">{HtmlEncoder.Default.Encode(displayName)}.</em>",
        Paragraphs:
        [
            "Tu as demandé à réinitialiser ton mot de passe pour retrouver ton calendrier des petits jours. Rien de plus simple : il suffit d’en choisir un nouveau."
        ],
        Highlights: [],
        Lead: "",
        Action: "Choisir un nouveau mot de passe",
        Note: "Ce lien expire dans 30 minutes et ne peut être utilisé qu’une seule fois. Si tu n’es pas à l’origine de cette demande, ignore simplement cet email : ton mot de passe actuel reste valable.",
        SignOff: ["Les petits jours"]);

    public static string Html(EmailContent content, string displayName, string link, bool withImages)
    {
        var enc = HtmlEncoder.Default;
        var safeLink = enc.Encode(link);
        var html = new StringBuilder(8192);

        html.Append($"""
<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>{enc.Encode(content.Subject)}</title></head>
<body style="margin:0;padding:0;background:{Page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{Page};">{enc.Encode(content.Preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{Page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
""");

        // Header — the site's green banner and its string of lights.
        html.Append($"""
<tr><td align="center" bgcolor="{Forest}" style="background:{Forest};border-radius:18px 18px 0 0;padding:30px 20px 20px;">
<div style="font-family:{Serif};font-size:32px;line-height:1.1;color:#fff4d2;letter-spacing:.3px;">les petits jours</div>
<div style="font-family:{Sans};font-size:10px;letter-spacing:3px;color:{Gold};margin-top:8px;">LE CALENDRIER DES GENS QU’ON AIME</div>
</td></tr>
<tr><td bgcolor="{Forest}" style="background:{Forest};padding:0 10px 14px;line-height:0;font-size:0;" align="center">
""");
        foreach (var color in BulbColors)
            html.Append($"<span style=\"display:inline-block;width:13px;height:17px;margin:0 7px;border-radius:50% 50% 45% 45%;background:{color};box-shadow:0 0 9px 2px {color}88;\">&nbsp;</span>");
        html.Append("</td></tr>");

        // Card.
        html.Append($"""
<tr><td bgcolor="{Cream}" style="background:{Cream};border-top:3px solid {Red};">
""");
        if (withImages)
            html.Append($"<img src=\"cid:{HeroImage}\" width=\"600\" alt=\"\" style=\"display:block;width:100%;max-width:600px;height:auto;border:0;\">");

        html.Append($"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 44px 8px;" align="center">
<div style="font-family:{Sans};font-size:11px;letter-spacing:3px;color:#967535;">{enc.Encode(content.Eyebrow)}</div>
<h1 style="margin:14px 0 18px;font-family:{Serif};font-weight:400;font-size:34px;line-height:1.2;color:{Green};">{content.TitleHtml}</h1>
</td></tr>
<tr><td style="padding:0 44px;font-family:{Sans};font-size:16px;line-height:1.7;color:{Ink};">
<p style="margin:0 0 16px;">Coucou {enc.Encode(displayName)},</p>
""");
        foreach (var paragraph in content.Paragraphs)
            html.Append($"<p style=\"margin:0 0 16px;\">{enc.Encode(paragraph)}</p>");
        html.Append("</td></tr>");

        if (content.Highlights.Count > 0)
        {
            html.Append($"<tr><td style=\"padding:6px 44px 8px;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#faf3e0\" style=\"background:#faf3e0;border:1px solid #eadcb4;border-radius:14px;\"><tr><td style=\"padding:14px 20px;\">");
            string[] dots = [Red, "#2e7a5a", "#d9a431"];
            for (var i = 0; i < content.Highlights.Count; i++)
                html.Append($"<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:7px 0;\"><tr><td valign=\"top\" style=\"padding:5px 12px 0 0;\"><span style=\"display:block;width:11px;height:11px;border-radius:50%;background:{dots[i % dots.Length]};\">&nbsp;</span></td><td style=\"font-family:{Sans};font-size:14.5px;line-height:1.5;color:{Green};\">{enc.Encode(content.Highlights[i])}</td></tr></table>");
            html.Append("</td></tr></table></td></tr>");
        }

        html.Append($"""
<tr><td align="center" style="padding:22px 44px 6px;">
""");
        if (content.Lead.Length > 0)
            html.Append($"<p style=\"margin:0 0 18px;font-family:{Serif};font-style:italic;font-size:18px;color:{Green};\">{enc.Encode(content.Lead)}</p>");
        html.Append($"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="{Green}" style="background:{Green};border-radius:999px;">
<a href="{safeLink}" style="display:inline-block;padding:16px 36px;font-family:{Sans};font-size:16px;font-weight:700;color:#fffdf7;text-decoration:none;border-radius:999px;border:1px solid {Forest};">{enc.Encode(content.Action)} &rarr;</a>
</td></tr></table>
<p style="margin:18px 0 0;font-family:{Sans};font-size:12px;line-height:1.6;color:#7a806f;">Le bouton ne fonctionne pas ? Copie ce lien dans ton navigateur :<br><a href="{safeLink}" style="color:{Brick};word-break:break-all;">{safeLink}</a></p>
</td></tr>
<tr><td style="padding:22px 44px 8px;font-family:{Sans};font-size:13px;line-height:1.6;color:#7a806f;">{enc.Encode(content.Note)}</td></tr>
<tr><td align="left" style="padding:12px 44px 26px;font-family:{Serif};color:{Green};">
""");
        for (var i = 0; i < content.SignOff.Length; i++)
        {
            var size = i == content.SignOff.Length - 1 ? 26 : 16;
            var style = i == content.SignOff.Length - 1 ? $"font-style:italic;color:{Red};" : "";
            html.Append($"<div style=\"font-size:{size}px;line-height:1.4;{style}\">{enc.Encode(content.SignOff[i])}</div>");
        }
        html.Append("</td></tr></table>");   // inner table of the card
        if (withImages)
            html.Append($"<img src=\"cid:{FooterImage}\" width=\"600\" alt=\"\" style=\"display:block;width:100%;max-width:600px;height:auto;border:0;\">");
        html.Append("</td></tr>");

        // Footer.
        html.Append($"""
<tr><td align="center" bgcolor="{Forest}" style="background:{Forest};border-radius:0 0 18px 18px;padding:20px 24px;font-family:{Sans};font-size:12px;line-height:1.6;color:{Gold};">
Fait avec un peu de magie et beaucoup d’amitié.<br>
<span style="color:#9fb8ac;">Ce message t’a été envoyé parce qu’un calendrier de l’Avent a été préparé pour toi. Un calendrier privé, juste entre nous.</span>
</td></tr>
</table></td></tr></table></body></html>
""");
        return html.ToString();
    }

    public static string Text(EmailContent content, string displayName, string link)
    {
        var text = new StringBuilder();
        text.AppendLine($"Coucou {displayName},").AppendLine();
        foreach (var paragraph in content.Paragraphs) text.AppendLine(paragraph).AppendLine();
        foreach (var highlight in content.Highlights) text.AppendLine($"  * {highlight}");
        if (content.Highlights.Count > 0) text.AppendLine();
        if (content.Lead.Length > 0) text.AppendLine(content.Lead);
        text.AppendLine($"{content.Action} :").AppendLine(link).AppendLine();
        text.AppendLine(content.Note).AppendLine();
        foreach (var line in content.SignOff) text.AppendLine(line);
        return text.ToString();
    }
}
