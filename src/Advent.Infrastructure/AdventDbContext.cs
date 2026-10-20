using Advent.Application;
using Advent.Domain;
using Microsoft.EntityFrameworkCore;

namespace Advent.Infrastructure;

public sealed class AdventDbContext(DbContextOptions<AdventDbContext> options) : DbContext(options), IUnitOfWork
{
    public DbSet<User> Users => Set<User>();
    public DbSet<CalendarEntry> CalendarEntries => Set<CalendarEntry>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<CalendarMedia> CalendarMedia => Set<CalendarMedia>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasDefaultSchema("dbo");
        model.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.Username).HasMaxLength(40);
            entity.HasIndex(x => x.Username).IsUnique();
            entity.Property(x => x.DisplayName).HasMaxLength(80);
            entity.Property(x => x.PasswordHash).HasMaxLength(512);
        });
        model.Entity<CalendarEntry>(entity =>
        {
            entity.ToTable("CalendarEntries");
            entity.HasKey(x => new { x.UserId, x.Day });
            entity.Property(x => x.Kind).HasMaxLength(20);
            entity.Property(x => x.Title).HasMaxLength(120);
            entity.Property(x => x.Text).HasColumnType("nvarchar(max)");
            entity.Property(x => x.Sticker).HasMaxLength(60);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<CalendarMedia>(entity =>
        {
            entity.ToTable("CalendarMedia");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.ContentType).HasMaxLength(40);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => new { x.UserId, x.Day });
        });
        model.Entity<Session>(entity =>
        {
            entity.ToTable("Sessions");
            entity.HasKey(x => x.TokenHash);
            entity.Property(x => x.TokenHash).HasMaxLength(64).IsUnicode(false).ValueGeneratedNever();
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => x.ExpiresAt);
        });
    }

    public async Task SaveChanges(CancellationToken ct) => await SaveChangesAsync(ct);
}
