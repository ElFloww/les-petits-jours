CREATE TABLE [dbo].[PasswordResetTokens]
(
    [TokenHash] VARCHAR(64) NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [ExpiresAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_PasswordResetTokens] PRIMARY KEY ([TokenHash]),
    CONSTRAINT [FK_PasswordResetTokens_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
);
GO
CREATE INDEX [IX_PasswordResetTokens_ExpiresAt] ON [dbo].[PasswordResetTokens] ([ExpiresAt]);
GO
CREATE INDEX [IX_PasswordResetTokens_UserId] ON [dbo].[PasswordResetTokens] ([UserId]);
