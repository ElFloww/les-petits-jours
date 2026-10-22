using Advent.Domain;
using FluentValidation;
using MediatR;

namespace Advent.Application;

public sealed record ForgotPasswordCommand(string Email) : IRequest;
public sealed record SendCalendarInvitationCommand(Guid UserId) : IRequest;
public sealed record ResetPasswordCommand(string Token, string Password) : IRequest;
public sealed record CreateManagedUserCommand(string Email, string DisplayName, string Password) : IRequest<ManagedUserResponse>;
public sealed record UpdateManagedUserCommand(Guid Id, string Email, string DisplayName) : IRequest<ManagedUserResponse>;
public sealed record DeleteManagedUserCommand(Guid Id, Guid ActorId) : IRequest;
public sealed record SetManagedUserPasswordCommand(Guid Id, string Password) : IRequest;
public sealed record SetManagedUserActiveCommand(Guid Id, Guid ActorId, bool IsActive) : IRequest;
public sealed record PromoteAdminCommand(string Username, string Email) : IRequest;
public sealed record InitializeDefaultAdminCommand(string? Email, string? Password) : IRequest;
public sealed record ListManagedUsersQuery : IRequest<IReadOnlyList<ManagedUserResponse>>;
public sealed record ManagedUserResponse(Guid Id, string Username, string? Email, string DisplayName, bool IsActive, bool IsAdmin);

public sealed class ForgotPasswordValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordValidator() =>
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
}

public sealed class SendCalendarInvitationValidator : AbstractValidator<SendCalendarInvitationCommand>
{
    public SendCalendarInvitationValidator() => RuleFor(x => x.UserId).NotEmpty();
}

public sealed class ResetPasswordValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordValidator()
    {
        RuleFor(x => x.Token).Length(64).Matches("^[0-9A-Fa-f]+$");
        RuleFor(x => x.Password).MinimumLength(14).MaximumLength(256);
    }
}

public sealed class CreateManagedUserValidator : AbstractValidator<CreateManagedUserCommand>
{
    public CreateManagedUserValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Password).MinimumLength(14).MaximumLength(256);
    }
}

public sealed class UpdateManagedUserValidator : AbstractValidator<UpdateManagedUserCommand>
{
    public UpdateManagedUserValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(80);
    }
}

public sealed class DeleteManagedUserValidator : AbstractValidator<DeleteManagedUserCommand>
{
    public DeleteManagedUserValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
    }
}

public sealed class SetManagedUserPasswordValidator : AbstractValidator<SetManagedUserPasswordCommand>
{
    public SetManagedUserPasswordValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Password).MinimumLength(14).MaximumLength(256);
    }
}

public sealed class SetManagedUserActiveValidator : AbstractValidator<SetManagedUserActiveCommand>
{
    public SetManagedUserActiveValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
    }
}

public sealed class PromoteAdminValidator : AbstractValidator<PromoteAdminCommand>
{
    public PromoteAdminValidator()
    {
        RuleFor(x => x.Username).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
    }
}

public sealed class InitializeDefaultAdminValidator : AbstractValidator<InitializeDefaultAdminCommand>
{
    public InitializeDefaultAdminValidator()
    {
        RuleFor(x => x).Must(x => string.IsNullOrWhiteSpace(x.Email) == string.IsNullOrWhiteSpace(x.Password))
            .WithMessage("Définissez ensemble INITIAL_ADMIN_EMAIL et INITIAL_ADMIN_PASSWORD.");
        RuleFor(x => x.Email).EmailAddress().MaximumLength(254).When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Password).MinimumLength(14).MaximumLength(256).When(x => !string.IsNullOrWhiteSpace(x.Password));
    }
}

public sealed class PasswordResetLinkService(
    IPasswordResetRepository resetTokens, ISessionTokens tokens, IUnitOfWork uow,
    IEmailSender email, TimeProvider clock)
{
    public async Task<string> Create(Guid userId, CancellationToken ct)
    {
        var baseUrl = email.PasswordResetBaseUrl;
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http"))
            throw new InvalidOperationException("Configurez PasswordReset:BaseUrl avec l'URL publique du site.");

        var now = clock.GetUtcNow();
        await resetTokens.DeleteExpired(now, ct);
        var token = tokens.Create();
        resetTokens.Add(new PasswordResetToken
        {
            TokenHash = tokens.Hash(token),
            UserId = userId,
            ExpiresAt = now.AddMinutes(30)
        });
        await uow.SaveChanges(ct);
        return new Uri(uri, $"?resetToken={Uri.EscapeDataString(token)}").ToString();
    }
}

public sealed class ForgotPasswordHandler(
    IUserRepository users, PasswordResetLinkService resetLinks, IEmailSender email)
    : IRequestHandler<ForgotPasswordCommand>
{
    public async Task Handle(ForgotPasswordCommand request, CancellationToken ct)
    {
        var user = await users.FindByEmail(request.Email.Trim().ToLowerInvariant(), ct);
        if (user is not { IsActive: true, Email: not null }) return;

        var link = await resetLinks.Create(user.Id, ct);
        await email.SendPasswordReset(user.Email, user.DisplayName, link, ct);
    }
}

public sealed class SendCalendarInvitationHandler(
    IUserRepository users, PasswordResetLinkService resetLinks, IEmailSender email)
    : IRequestHandler<SendCalendarInvitationCommand>
{
    public async Task Handle(SendCalendarInvitationCommand request, CancellationToken ct)
    {
        var user = await users.FindById(request.UserId, ct)
            ?? throw new AppException(404, "Compte introuvable.");
        if (!user.IsActive) throw new AppException(400, "Impossible d’envoyer une invitation à un compte désactivé.");
        if (user.Email is null) throw new AppException(400, "Ce compte ne possède pas d’adresse email.");

        var link = await resetLinks.Create(user.Id, ct);
        await email.SendCalendarInvitation(user.Email, user.DisplayName, link, ct);
    }
}

public sealed class ResetPasswordHandler(
    IPasswordResetRepository resetTokens, ISessionTokens tokens, IPasswordService passwords, TimeProvider clock)
    : IRequestHandler<ResetPasswordCommand>
{
    public Task Handle(ResetPasswordCommand request, CancellationToken ct) =>
        resetTokens.ResetPassword(tokens.Hash(request.Token), passwords.Hash(request.Password), clock.GetUtcNow(), ct);
}

public sealed class ListManagedUsersHandler(IUserRepository users)
    : IRequestHandler<ListManagedUsersQuery, IReadOnlyList<ManagedUserResponse>>
{
    public async Task<IReadOnlyList<ManagedUserResponse>> Handle(ListManagedUsersQuery request, CancellationToken ct) =>
        (await users.List(ct)).Select(ToResponse).ToArray();

    internal static ManagedUserResponse ToResponse(User user) =>
        new(user.Id, user.Username, user.Email, user.DisplayName, user.IsActive, user.IsAdmin);
}

public sealed class CreateManagedUserHandler(
    IUserRepository users, IPasswordService passwords, IUnitOfWork uow)
    : IRequestHandler<CreateManagedUserCommand, ManagedUserResponse>
{
    public async Task<ManagedUserResponse> Handle(CreateManagedUserCommand request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await users.EmailExists(email, null, ct)) throw new AppException(409, "Cette adresse email est déjà utilisée.");
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = $"user-{Guid.NewGuid():N}",
            Email = email,
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = passwords.Hash(request.Password),
            IsActive = true
        };
        users.Add(user);
        await uow.SaveChanges(ct);
        return ListManagedUsersHandler.ToResponse(user);
    }
}

public sealed class UpdateManagedUserHandler(IUserRepository users, ISessionRepository sessions, IUnitOfWork uow)
    : IRequestHandler<UpdateManagedUserCommand, ManagedUserResponse>
{
    public async Task<ManagedUserResponse> Handle(UpdateManagedUserCommand request, CancellationToken ct)
    {
        var user = await users.FindById(request.Id, ct) ?? throw new AppException(404, "Compte introuvable.");
        var email = request.Email.Trim().ToLowerInvariant();
        if (await users.EmailExists(email, user.Id, ct)) throw new AppException(409, "Cette adresse email est déjà utilisée.");
        if (user.Email != email) await sessions.RevokeAll(user.Id, ct);
        user.Email = email;
        user.DisplayName = request.DisplayName.Trim();
        await uow.SaveChanges(ct);
        return ListManagedUsersHandler.ToResponse(user);
    }
}

public sealed class DeleteManagedUserHandler(IUserRepository users, IUnitOfWork uow)
    : IRequestHandler<DeleteManagedUserCommand>
{
    public async Task Handle(DeleteManagedUserCommand request, CancellationToken ct)
    {
        if (request.Id == request.ActorId)
            throw new AppException(400, "Vous ne pouvez pas supprimer votre propre compte.");
        var user = await users.FindById(request.Id, ct) ?? throw new AppException(404, "Compte introuvable.");
        if (user.IsAdmin && user.IsActive && await users.CountActiveAdmins(ct) <= 1)
            throw new AppException(400, "Le dernier compte administrateur actif ne peut pas être supprimé.");
        users.Remove(user);
        await uow.SaveChanges(ct);
    }
}

public sealed class SetManagedUserPasswordHandler(
    IUserRepository users, IPasswordService passwords, ISessionRepository sessions, IUnitOfWork uow)
    : IRequestHandler<SetManagedUserPasswordCommand>
{
    public async Task Handle(SetManagedUserPasswordCommand request, CancellationToken ct)
    {
        var user = await users.FindById(request.Id, ct) ?? throw new AppException(404, "Compte introuvable.");
        user.PasswordHash = passwords.Hash(request.Password);
        user.IsActive = true;
        await sessions.RevokeAll(user.Id, ct);
        await uow.SaveChanges(ct);
    }
}

public sealed class SetManagedUserActiveHandler(
    IUserRepository users, ISessionRepository sessions, IUnitOfWork uow)
    : IRequestHandler<SetManagedUserActiveCommand>
{
    public async Task Handle(SetManagedUserActiveCommand request, CancellationToken ct)
    {
        var user = await users.FindById(request.Id, ct) ?? throw new AppException(404, "Compte introuvable.");
        if (user.IsActive == request.IsActive) return;
        if (!request.IsActive && user.Id == request.ActorId) throw new AppException(400, "Vous ne pouvez pas désactiver votre propre compte.");
        if (!request.IsActive && user.IsAdmin && await users.CountActiveAdmins(ct) <= 1)
            throw new AppException(400, "Le dernier compte administrateur ne peut pas être désactivé.");
        user.IsActive = request.IsActive;
        if (!request.IsActive) await sessions.RevokeAll(user.Id, ct);
        await uow.SaveChanges(ct);
    }
}

public sealed class PromoteAdminHandler(IUserRepository users, IUnitOfWork uow)
    : IRequestHandler<PromoteAdminCommand>
{
    public async Task Handle(PromoteAdminCommand request, CancellationToken ct)
    {
        var user = await users.FindByUsername(request.Username.Trim().ToLowerInvariant(), ct)
            ?? throw new AppException(404, "Compte introuvable.");
        var email = request.Email.Trim().ToLowerInvariant();
        if (await users.EmailExists(email, user.Id, ct)) throw new AppException(409, "Cette adresse email est déjà utilisée.");
        user.Email = email;
        user.IsAdmin = true;
        await uow.SaveChanges(ct);
    }
}

public sealed class InitializeDefaultAdminHandler(
    IUserRepository users, IPasswordService passwords, IUnitOfWork uow)
    : IRequestHandler<InitializeDefaultAdminCommand>
{
    public async Task Handle(InitializeDefaultAdminCommand request, CancellationToken ct)
    {
        var user = await users.FindByUsername("admin", ct);
        if (user is { IsAdmin: true, Email: not null, PasswordHash: not null }) return;
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            throw new AppException(400, "Définissez INITIAL_ADMIN_EMAIL et INITIAL_ADMIN_PASSWORD pour initialiser le compte admin.");

        if (user is null)
        {
            if ((await users.List(ct)).Count != 0)
                throw new AppException(409, "Le compte admin initial est absent alors que des comptes existent.");
            user = new User
            {
                Id = Guid.NewGuid(),
                Username = "admin",
                DisplayName = "Administration",
                IsAdmin = true
            };
            users.Add(user);
        }
        else if (!user.IsAdmin || user.IsActive || user.Email is not null || user.PasswordHash is not null)
            throw new AppException(409, "Le compte admin initial est déjà partiellement configuré ; intervention manuelle requise.");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await users.EmailExists(email, user.Id, ct))
            throw new AppException(409, "L’adresse INITIAL_ADMIN_EMAIL est déjà associée à un autre compte.");
        user.Email = email;
        user.PasswordHash = passwords.Hash(request.Password);
        user.IsActive = true;
        await uow.SaveChanges(ct);
    }
}
