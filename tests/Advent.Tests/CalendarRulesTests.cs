using Advent.Domain;

namespace Advent.Tests;

public sealed class CalendarRulesTests
{
    [Theory]
    [InlineData(1, "2026-11-30T22:59:59.999Z", false)]
    [InlineData(1, "2026-11-30T23:00:00Z", true)]
    [InlineData(2, "2026-12-01T22:59:59Z", false)]
    [InlineData(2, "2026-12-01T23:00:00Z", true)]
    [InlineData(24, "2026-12-23T22:59:59Z", false)]
    [InlineData(24, "2026-12-23T23:00:00Z", true)]
    [InlineData(1, "2026-12-20T12:00:00Z", true)]
    [InlineData(24, "2027-07-01T12:00:00Z", true)]
    [InlineData(1, "2025-12-24T12:00:00Z", false)]
    [InlineData(1, "2026-10-25T01:00:00Z", false)]
    [InlineData(0, "2026-12-24T12:00:00Z", false)]
    [InlineData(25, "2026-12-24T12:00:00Z", false)]
    public void AvailabilityUsesParisAndAllowsCatchup(int day, string now, bool expected) =>
        Assert.Equal(expected, CalendarRules.IsAvailable(day, DateTimeOffset.Parse(now)));

    [Fact]
    public void AllUnlockTimesAreParisMidnight()
    {
        foreach (var day in Enumerable.Range(1, 24))
        {
            var date = CalendarRules.UnlocksAt(day);
            Assert.Equal(TimeSpan.FromHours(1), date.Offset);
            Assert.Equal(0, date.Hour);
            Assert.Equal(day, date.Day);
            Assert.Equal(12, date.Month);
            Assert.Equal(2026, date.Year);
        }
    }
}
