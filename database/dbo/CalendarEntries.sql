CREATE TABLE [dbo].[CalendarEntries]
(
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [Day] INT NOT NULL,
    [Kind] NVARCHAR(20) NOT NULL,
    [Title] NVARCHAR(120) NOT NULL,
    [Text] NVARCHAR(MAX) NOT NULL,
    [Sticker] NVARCHAR(60) NOT NULL,
    [BlocksJson] NVARCHAR(MAX) NULL,
    [DraftJson] NVARCHAR(MAX) NULL,
    [IsPublished] BIT NOT NULL CONSTRAINT [DF_CalendarEntries_IsPublished] DEFAULT (0),
    [FirstOpenedAt] DATETIMEOFFSET(7) NULL,
    CONSTRAINT [PK_CalendarEntries] PRIMARY KEY ([UserId], [Day]),
    CONSTRAINT [FK_CalendarEntries_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [CK_CalendarEntries_Day] CHECK ([Day] BETWEEN 1 AND 24),
    CONSTRAINT [CK_CalendarEntries_Kind] CHECK ([Kind] IN (N'blague', N'anecdote', N'activite', N'surprise'))
);
