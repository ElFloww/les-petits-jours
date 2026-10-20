CREATE TABLE [dbo].[Sessions]
(
    [TokenHash] VARCHAR(64) NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [ExpiresAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_Sessions] PRIMARY KEY ([TokenHash]),
    CONSTRAINT [FK_Sessions_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
);
GO
CREATE INDEX [IX_Sessions_UserId] ON [dbo].[Sessions] ([UserId]);
GO
CREATE INDEX [IX_Sessions_ExpiresAt] ON [dbo].[Sessions] ([ExpiresAt]);
