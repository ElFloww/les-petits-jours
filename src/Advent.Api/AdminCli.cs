using System.Text.Json;
using Advent.Application;
using Advent.Infrastructure;
using FluentValidation;
using MediatR;

namespace Advent.Api;

public static class AdminCli
{
    public static async Task<int> Run(IServiceProvider services, string[] args, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();
        try
        {
            switch (args)
            {
                case ["provision-db"]:
                    var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
                    await DatabaseProvisioner.Provision(
                        configuration.GetConnectionString("Advent")!,
                        Environment.GetEnvironmentVariable("APP_DB_PASSWORD")
                            ?? throw new AppException(400, "Définissez APP_DB_PASSWORD (24 à 128 caractères)."), ct);
                    Console.WriteLine("Login SQL advent_app configuré, permissions applicatives uniquement.");
                    break;
                case ["import", var path]:
                case ["import", var path2, "--publish"]:
                    var file = args[1];
                    await using (var stream = File.OpenRead(file))
                    {
                        var document = await JsonSerializer.DeserializeAsync<ContentDocument>(stream,
                            new JsonSerializerOptions(JsonSerializerDefaults.Web)
                            {
                                UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
                                RespectRequiredConstructorParameters = true
                            }, ct) ?? throw new AppException(400, "Fichier de contenus vide.");
                        var count = await sender.Send(new ImportContentCommand(document, args.Length == 3), ct);
                        Console.WriteLine($"{count} contenus importés en {(args.Length == 3 ? "publication" : "brouillon")}.");
                    }
                    break;
                case ["set-password", var username]:
                    var password = Environment.GetEnvironmentVariable("ADVENT_PASSWORD")
                        ?? throw new AppException(400, "Définissez ADVENT_PASSWORD (14 caractères minimum).");
                    await sender.Send(new SetPasswordCommand(username, password), ct);
                    Console.WriteLine("Compte activé, mot de passe défini, anciennes sessions révoquées.");
                    break;
                case ["disable", var username]:
                    await sender.Send(new DisableAccountCommand(username), ct);
                    Console.WriteLine("Compte désactivé et sessions révoquées.");
                    break;
                default:
                    Console.Error.WriteLine("admin import <fichier> [--publish] | admin set-password <identifiant> | admin disable <identifiant> | admin provision-db");
                    return 2;
            }
            return 0;
        }
        catch (ValidationException exception)
        {
            foreach (var error in exception.Errors)
                Console.Error.WriteLine($"{error.PropertyName}: {error.ErrorMessage}");
            return 1;
        }
        catch (Exception exception) when (exception is AppException or JsonException or IOException)
        {
            Console.Error.WriteLine(exception.Message);
            return 1;
        }
    }
}
