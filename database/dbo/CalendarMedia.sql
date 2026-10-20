CREATE TABLE [dbo].[CalendarMedia]
(
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [Day] INT NOT NULL,
    [ContentType] NVARCHAR(40) NOT NULL,
    [Data] VARBINARY(MAX) NOT NULL,
    CONSTRAINT [PK_CalendarMedia] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_CalendarMedia_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [CK_CalendarMedia_Day] CHECK ([Day] BETWEEN 1 AND 24),
    CONSTRAINT [CK_CalendarMedia_Size] CHECK (DATALENGTH([Data]) BETWEEN 1 AND 52428800)
);
GO
CREATE INDEX [IX_CalendarMedia_UserId_Day] ON [dbo].[CalendarMedia] ([UserId], [Day]);
