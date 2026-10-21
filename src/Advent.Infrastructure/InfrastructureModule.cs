using Advent.Application;
using Autofac;
using Microsoft.EntityFrameworkCore;

namespace Advent.Infrastructure;

public sealed class InfrastructureModule(string connectionString) : Module
{
    protected override void Load(ContainerBuilder builder)
    {
        builder.Register(_ => new DbContextOptionsBuilder<AdventDbContext>()
            .UseSqlServer(connectionString).Options).SingleInstance();
        builder.RegisterType<AdventDbContext>().AsSelf().As<IUnitOfWork>().InstancePerLifetimeScope();
        builder.RegisterType<UserRepository>().As<IUserRepository>().InstancePerLifetimeScope();
        builder.RegisterType<PasswordResetRepository>().As<IPasswordResetRepository>().InstancePerLifetimeScope();
        builder.RegisterType<CalendarRepository>().As<ICalendarRepository>().InstancePerLifetimeScope();
        builder.RegisterType<MediaRepository>().As<IMediaRepository>().InstancePerLifetimeScope();
        builder.RegisterType<SessionRepository>().As<ISessionRepository>().InstancePerLifetimeScope();
        builder.RegisterType<PasswordService>().As<IPasswordService>().SingleInstance();
        builder.RegisterType<SessionTokens>().As<ISessionTokens>().SingleInstance();
    }
}
