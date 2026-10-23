using Autofac;
using FluentValidation;
using MediatR;

namespace Advent.Application;

public sealed class ApplicationModule : Module
{
    protected override void Load(ContainerBuilder builder)
    {
        builder.RegisterType<Mediator>().As<IMediator>().As<ISender>().As<IPublisher>().InstancePerLifetimeScope();
        builder.RegisterAssemblyTypes(typeof(ApplicationModule).Assembly)
            .AsClosedTypesOf(typeof(IRequestHandler<,>)).InstancePerLifetimeScope();
        builder.RegisterAssemblyTypes(typeof(ApplicationModule).Assembly)
            .AsClosedTypesOf(typeof(IRequestHandler<>)).InstancePerLifetimeScope();
        builder.RegisterAssemblyTypes(typeof(ApplicationModule).Assembly)
            .AsClosedTypesOf(typeof(IValidator<>)).InstancePerLifetimeScope();
        builder.RegisterGeneric(typeof(ValidationBehavior<,>)).As(typeof(IPipelineBehavior<,>)).InstancePerLifetimeScope();
        builder.RegisterType<EntryReader>().As<IEntryReader>().InstancePerLifetimeScope();
        builder.RegisterType<GiftMedia>().As<IGiftMedia>().InstancePerLifetimeScope();
        builder.RegisterType<MediaOptimizer>().As<IMediaOptimizer>().InstancePerLifetimeScope();
        builder.RegisterType<PasswordResetLinkService>().InstancePerLifetimeScope();
    }
}

public sealed class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse> where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var context = new ValidationContext<TRequest>(request);
        var failures = new List<FluentValidation.Results.ValidationFailure>();
        foreach (var validator in validators)
            failures.AddRange((await validator.ValidateAsync(context, ct)).Errors);
        if (failures.Count > 0) throw new ValidationException(failures);
        return await next();
    }
}
